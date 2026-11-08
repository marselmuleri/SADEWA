"""
Pipeline RAG SADEWA.

Dua keluaran AI sesuai C300 Tabel 25:
1. generate_rps()             -> Draf RPS 16 pertemuan
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
from typing import Any, Dict, List

from . import prompts
from .config import settings
from .llm_client import chat, extract_json
from .retriever import retrieve_context_with_metadata
from .validators import validate_narasi, validate_rps
from .web_retriever import fetch_web_context

logger = logging.getLogger(__name__)

_MAX_RETRIES_RPS = 2  # jumlah percobaan ulang setelah percobaan pertama gagal


def _fix_bobot(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Auto-koreksi bobot pertemuan agar totalnya tepat 100.

    LLM kadang menghasilkan total bobot > atau < 100 (paling umum: 14×4=56
    ditambah UTS 20 + UAS 30 = 106). Fungsi ini memeriksa selisih dan
    mendistribusikan koreksi ke pertemuan reguler (bukan UTS/UAS) secara merata,
    satu per satu dari pertemuan terakhir ke pertama (agar perubahan tidak
    terpusat di satu pertemuan saja).

    Dipanggil SETELAH setiap percobaan generasi, sebelum validasi,
    sehingga retry loop tidak membuang percobaan hanya karena bobot meleset.
    """
    pertemuan = data.get("pertemuan")
    if not isinstance(pertemuan, list) or not pertemuan:
        return data

    target = settings.bobot_total
    uts_minggu = settings.minggu_uts
    uas_minggu = settings.minggu_uas

    total_saat_ini = sum(
        float(p.get("bobot", 0)) for p in pertemuan if isinstance(p, dict)
    )
    selisih = round(total_saat_ini - target)  # positif = kelebihan, negatif = kurang

    if selisih == 0:
        return data  # sudah benar, tidak perlu apa-apa

    # Kumpulkan indeks pertemuan reguler (bukan UTS/UAS) dalam urutan terbalik
    reguler_idx = [
        i for i, p in enumerate(pertemuan)
        if isinstance(p, dict) and p.get("minggu") not in (uts_minggu, uas_minggu)
    ][::-1]  # dari belakang agar pertemuan awal tidak terganggu

    for i in reguler_idx:
        if selisih == 0:
            break
        bobot_lama = float(pertemuan[i].get("bobot", 0))
        if selisih > 0:
            # Kurangi bobot satu per satu
            koreksi = min(selisih, bobot_lama - 1)  # minimal bobot = 1
            if koreksi > 0:
                pertemuan[i]["bobot"] = int(bobot_lama - koreksi)
                selisih -= koreksi
        else:
            # Tambah bobot satu per satu
            pertemuan[i]["bobot"] = int(bobot_lama + 1)
            selisih += 1

    if selisih != 0:
        logger.warning(
            "[rag_chain] _fix_bobot: masih ada selisih %d setelah koreksi "
            "(pertemuan reguler tidak cukup untuk mengakomodasi selisih).",
            selisih,
        )
    else:
        logger.info("[rag_chain] _fix_bobot: bobot dikoreksi otomatis → total 100.")

    data["pertemuan"] = pertemuan
    return data


def generate_rps(
    mk_name: str,
    sks: int,
    semester: str,
    prodi: str,
    deskripsi: str,
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
    context_kurikulum, sources = retrieve_context_with_metadata(query)
    logger.info("Konteks lokal diambil (%d karakter)", len(context_kurikulum))

    # Ambil referensi RPS dari universitas lain via web search.
    # Berjalan paralel dengan proses lain agar tidak memperlambat.
    # Bila gagal (timeout/no internet), context_web = "" dan pipeline tetap jalan.
    context_web = fetch_web_context(mk_name=mk_name, prodi=prodi)
    if context_web:
        logger.info("Konteks web diambil (%d karakter)", len(context_web))
    else:
        logger.info("Konteks web tidak tersedia, lanjut dengan konteks lokal saja.")

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

        raw = chat(
            messages=messages,
            max_tokens=settings.rps_max_tokens,
            temperature=settings.rps_temperature,
        )

        data = extract_json(raw)
        # Auto-koreksi bobot sebelum validasi agar tidak membuang retry
        # hanya karena LLM salah menghitung distribusi bobot.
        data = _fix_bobot(data)
        valid, errors = validate_rps(data)

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
    context_kurikulum, sources = retrieve_context_with_metadata(query)
    logger.info("Konteks diambil (%d karakter)", len(context_kurikulum))

    prompt = prompts.build_narasi_prompt(
        mk_name=mk_name,
        prodi=prodi,
        semester=semester,
        tahun_ajaran=tahun_ajaran,
        capaian=capaian,
        context_kurikulum=context_kurikulum,
    )

    raw = chat(
        messages=[
            {"role": "system", "content": prompts.SYSTEM_NARASI},
            {"role": "user", "content": prompt},
        ],
        max_tokens=settings.narasi_max_tokens,
        temperature=settings.narasi_temperature,
    )

    data = extract_json(raw)
    valid, errors = validate_narasi(data)

    if not valid:
        logger.warning("Narasi lolos parsing tetapi tidak lengkap: %s", errors)

    return {
        "data": data,
        "valid": valid,
        "pelanggaran_validasi": errors,
        "sumber_dokumen": sources,
    }
