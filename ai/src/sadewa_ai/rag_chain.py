"""
Pipeline RAG SADEWA.

Dua keluaran AI sesuai C300 Tabel 25:
1. generate_rps()             -> Draf Kontrak Kuliah + RPS 16 pertemuan
2. generate_narasi_evaluasi() -> Laporan narasi evaluasi kurikulum

Catatan perubahan: fungsi pencarian tren industri dihapus mengikuti revisi
dosen. Fungsi tersebut juga tidak melakukan retrieval sungguhan, hanya meminta
LLM menebak dari pengetahuan internalnya, sehingga bertentangan dengan alasan
pemilihan RAG pada dokumen C100.

Perubahan terbaru:
- generate_rps() kini mencoba ulang otomatis (maks _MAX_RETRIES_RPS kali) bila
  hasil generasi pertama tidak lolos validasi OBE. Pelanggaran dari percobaan
  sebelumnya diumpankan balik ke LLM sebagai pesan koreksi, sehingga percobaan
  berikutnya lebih terarah. Jika setelah semua percobaan masih ada pelanggaran,
  hasil terakhir tetap dikembalikan beserta daftar pelanggaran.
- generate_rps() kini juga mengambil referensi RPS dari universitas lain via
  web search (DuckDuckGo) sebagai konteks tambahan. Referensi ini hanya dipakai
  di dalam prompt, tidak ditampilkan ke pengguna di frontend.
"""

import logging
from typing import Any, Callable, Dict, List, Optional

from . import prompts
from .config import settings
from .llm_client import chat, extract_json
from .retriever import retrieve_context_with_metadata
from .validators import rapikan_rps, validate_evaluasi_cpmk, validate_narasi, validate_rps
from .web_retriever import fetch_web_context

logger = logging.getLogger(__name__)

_MAX_RETRIES_RPS = 2  # jumlah percobaan ulang setelah percobaan pertama gagal

# Callback progres opsional: on_event(jenis, data). Dipakai endpoint streaming
# (service.stream_*) untuk memberi tahu frontend tahap yang sedang berjalan,
# sumber pedoman yang dipakai, dan potongan teks yang sedang ditulis LLM.
# Jenis event:
#   "tahap"    {"id": "konteks"|"web"|"menulis"|"validasi", "status": "mulai"|"selesai", "detail"?, "percobaan"?}
#   "sumber"   {"sumber": [{"file", "page", "snippet"}]}
#   "token"    {"teks": "..."}            potongan JSON mentah dari LLM
#   "ulang"    {"percobaan": n, "pelanggaran": [...]}   teks percobaan sebelumnya dibuang
OnEvent = Optional[Callable[[str, Dict[str, Any]], None]]


def _emit(on_event: OnEvent, jenis: str, **data: Any) -> None:
    """Kirim event progres bila ada pendengar. Kegagalan callback tidak menghentikan pipeline."""
    if on_event is None:
        return
    try:
        on_event(jenis, data)
    except Exception:  # noqa: BLE001
        logger.debug("Callback on_event gagal untuk %s", jenis, exc_info=True)


def _token_callback(on_event: OnEvent) -> Optional[Callable[[str], None]]:
    if on_event is None:
        return None
    return lambda teks: _emit(on_event, "token", teks=teks)


def generate_rps(
    mk_name: str,
    sks: int,
    semester: str,
    prodi: str,
    deskripsi: str,
    on_event: OnEvent = None,
) -> Dict[str, Any]:
    """
    Bangkitkan draf RPS. Mengembalikan dict berisi:
      - data                : JSON RPS hasil generasi
      - valid               : bool hasil validasi aturan OBE
      - pelanggaran_validasi: list peringatan bila ada

    Percobaan ulang otomatis (maks _MAX_RETRIES_RPS kali) bila hasil generasi
    pertama tidak lolos validasi OBE. Pelanggaran diumpankan balik ke LLM
    sebagai pesan koreksi pada percobaan berikutnya.
    """
    logger.info("Memulai RAG pipeline RPS untuk: %s", mk_name)

    # Topik dari dosen ikut masuk query retrieval supaya konteks dokumen yang
    # diambil relevan dengan permintaan, bukan selalu sama untuk mata kuliah yang sama.
    topik = (deskripsi or "").strip()
    query = f"RPS {mk_name} {prodi} {topik} CPL CPMK capaian pembelajaran OBE".replace("  ", " ")
    _emit(on_event, "tahap", id="konteks", status="mulai")
    context_kurikulum, sources = retrieve_context_with_metadata(query)
    logger.info("Konteks lokal diambil (%d karakter)", len(context_kurikulum))
    _emit(on_event, "sumber", sumber=sources)
    _emit(on_event, "tahap", id="konteks", status="selesai", detail=f"{len(sources)} potongan pedoman ditemukan")

    # Ambil referensi RPS dari universitas lain via web search.
    # Berjalan paralel dengan proses lain agar tidak memperlambat.
    # Bila gagal (timeout/no internet), context_web = "" dan pipeline tetap jalan.
    _emit(on_event, "tahap", id="web", status="mulai")
    context_web = fetch_web_context(mk_name=mk_name, prodi=prodi)
    if context_web:
        logger.info("Konteks web diambil (%d karakter)", len(context_web))
        _emit(on_event, "tahap", id="web", status="selesai", detail="Referensi RPS sejenis ditemukan")
    else:
        logger.info("Konteks web tidak tersedia, lanjut dengan konteks lokal saja.")
        _emit(on_event, "tahap", id="web", status="selesai", detail="Tidak tersedia, lanjut dengan pedoman lokal")

    prompt = prompts.build_rps_prompt(
        mk_name=mk_name,
        sks=sks,
        semester=semester,
        prodi=prodi,
        deskripsi=deskripsi,
        context_kurikulum=context_kurikulum,
        context_web=context_web,
    )

    messages = [
        {"role": "system", "content": prompts.SYSTEM_RPS},
        {"role": "user", "content": prompt},
    ]

    data: Dict[str, Any] = {}
    valid = False
    errors: List[str] = []
    raw = ""

    for attempt in range(_MAX_RETRIES_RPS + 1):
        if attempt > 0:
            # Umpan balik pelanggaran ke LLM sebagai pesan koreksi
            koreksi = (
                "JSON yang kamu hasilkan melanggar aturan OBE berikut:\n"
                + "\n".join(f"- {e}" for e in errors)
                + "\n\nPerbaiki seluruh pelanggaran di atas dan kembalikan "
                "JSON yang valid dan lengkap. Jangan tambahkan teks lain."
            )
            messages = messages + [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": koreksi},
            ]
            logger.info(
                "Percobaan %d/%d: RPS belum valid (%d pelanggaran). Mencoba ulang...",
                attempt, _MAX_RETRIES_RPS, len(errors),
            )
            _emit(on_event, "ulang", percobaan=attempt + 1, pelanggaran=errors)

        _emit(
            on_event, "tahap", id="menulis", status="mulai", percobaan=attempt + 1,
            detail=None if attempt == 0 else f"Percobaan {attempt + 1}: memperbaiki {len(errors)} pelanggaran",
        )
        raw = chat(
            messages=messages,
            max_tokens=settings.rps_max_tokens,
            temperature=settings.rps_temperature,
            on_token=_token_callback(on_event),
        )
        _emit(on_event, "tahap", id="menulis", status="selesai", percobaan=attempt + 1)

        _emit(on_event, "tahap", id="validasi", status="mulai", percobaan=attempt + 1)
        data = extract_json(raw)
        # Rapikan bagian yang bisa dipastikan tanpa LLM (kode CPMK, waktu dari SKS,
        # bobot UTS/UAS dari tabel penilaian) agar tidak membuang retry.
        data = rapikan_rps(data, sks)
        valid, errors = validate_rps(data)
        _emit(
            on_event, "tahap", id="validasi", status="selesai", percobaan=attempt + 1,
            detail="Lolos aturan OBE" if valid else f"{len(errors)} pelanggaran ditemukan",
        )

        if valid:
            if attempt > 0:
                logger.info("RPS valid setelah %d percobaan ulang.", attempt)
            break

    if not valid:
        logger.warning(
            "RPS tetap tidak valid setelah %d percobaan: %s",
            _MAX_RETRIES_RPS + 1, errors,
        )

    return {
        "data": data,
        "valid": valid,
        "pelanggaran_validasi": errors,
        "sumber_dokumen": sources,
    }


def generate_narasi_evaluasi(
    mk_name: str,
    prodi: str,
    semester: str,
    tahun_ajaran: str,
    capaian: List[Dict[str, Any]],
    on_event: OnEvent = None,
) -> Dict[str, Any]:
    """
    Bangkitkan laporan narasi evaluasi kurikulum (endpoint SADEWA-21).

    Parameter `capaian` adalah hasil kalkulasi ketercapaian dari backend,
    berisi daftar dict seperti:
        {
            "kode": "CPL 3",
            "deskripsi": "Mampu merancang sistem...",
            "nilai_rata_rata": 68.4,
            "jumlah_mahasiswa": 40,
            "jumlah_tercapai": 22
        }

    Mengembalikan dict dengan bentuk yang sama seperti generate_rps().
    """
    logger.info("Memulai RAG pipeline narasi evaluasi untuk: %s", mk_name)

    query = (
        f"evaluasi ketercapaian CPL CPMK {mk_name} {prodi} "
        "laporan borang akreditasi rekomendasi perbaikan"
    )
    _emit(on_event, "tahap", id="konteks", status="mulai")
    context_kurikulum, sources = retrieve_context_with_metadata(query)
    logger.info("Konteks diambil (%d karakter)", len(context_kurikulum))
    _emit(on_event, "sumber", sumber=sources)
    _emit(on_event, "tahap", id="konteks", status="selesai", detail=f"{len(sources)} potongan pedoman ditemukan")

    prompt = prompts.build_narasi_prompt(
        mk_name=mk_name,
        prodi=prodi,
        semester=semester,
        tahun_ajaran=tahun_ajaran,
        capaian=capaian,
        context_kurikulum=context_kurikulum,
    )

    _emit(on_event, "tahap", id="menulis", status="mulai", percobaan=1)
    raw = chat(
        messages=[
            {"role": "system", "content": prompts.SYSTEM_NARASI},
            {"role": "user", "content": prompt},
        ],
        max_tokens=settings.narasi_max_tokens,
        temperature=settings.narasi_temperature,
        on_token=_token_callback(on_event),
    )
    _emit(on_event, "tahap", id="menulis", status="selesai", percobaan=1)

    _emit(on_event, "tahap", id="validasi", status="mulai", percobaan=1)
    data = extract_json(raw)
    valid, errors = validate_narasi(data)
    _emit(
        on_event, "tahap", id="validasi", status="selesai", percobaan=1,
        detail="Semua bagian lengkap" if valid else f"{len(errors)} bagian perlu diperiksa",
    )

    if not valid:
        logger.warning("Narasi lolos parsing tetapi tidak lengkap: %s", errors)

    return {
        "data": data,
        "valid": valid,
        "pelanggaran_validasi": errors,
        "sumber_dokumen": sources,
    }


def generate_evaluasi_cpmk(
    mk_name: str,
    prodi: str,
    semester: str,
    tahun_ajaran: str,
    cpmk: List[Dict[str, Any]],
    ambang: float = 70.0,
    target_persen: float = 60.0,
    target_rerata_skala: Any = None,
    skala_maks: Any = None,
) -> Dict[str, Any]:
    """
    Saran teks sheet Evaluasi portofolio: analisis pelaksanaan pembelajaran dan
    rencana perbaikan semester depan untuk setiap CPMK.

    Data dikembalikan sebagai {"evaluasi": [{"kode", "analisis", "rencana_perbaikan"}]}.
    Bila ada CPMK yang terlewat, LLM diminta mengulang sekali dengan daftar kekurangannya.
    """
    logger.info("Memulai RAG pipeline evaluasi CPMK untuk: %s", mk_name)
    query = (
        f"evaluasi pemenuhan CPMK {mk_name} {prodi} analisis pelaksanaan pembelajaran "
        "rencana perbaikan semester depan"
    )
    context_kurikulum, sources = retrieve_context_with_metadata(query)

    prompt = prompts.build_evaluasi_cpmk_prompt(
        mk_name=mk_name,
        prodi=prodi,
        semester=semester,
        tahun_ajaran=tahun_ajaran,
        ambang=ambang,
        target_persen=target_persen,
        cpmk=cpmk,
        context_kurikulum=context_kurikulum,
        target_rerata_skala=target_rerata_skala,
        skala_maks=skala_maks,
    )
    messages = [
        {"role": "system", "content": prompts.SYSTEM_EVALUASI_CPMK},
        {"role": "user", "content": prompt},
    ]
    kode_wajib = [str(c.get("kode", "")).strip() for c in cpmk]

    data: Dict[str, Any] = {}
    errors: List[str] = []
    for percobaan in range(2):
        raw = chat(
            messages=messages,
            max_tokens=settings.narasi_max_tokens,
            temperature=settings.narasi_temperature,
        )
        data = extract_json(raw)
        valid, errors = validate_evaluasi_cpmk(data, kode_wajib)
        if valid:
            break
        logger.warning("Evaluasi CPMK percobaan %d belum lengkap: %s", percobaan + 1, errors)
        messages = messages + [
            {"role": "assistant", "content": raw},
            {"role": "user", "content": "Perbaiki JSON agar memenuhi aturan. Kekurangan: " + "; ".join(errors)},
        ]

    return {
        "data": data,
        "valid": not errors,
        "pelanggaran_validasi": errors,
        "sumber_dokumen": sources,
    }
