"""
Lapisan layanan untuk backend engineer.

Backend cukup memanggil fungsi di file ini — tidak perlu tahu isi rag_chain.py,
prompts.py, atau retriever.py sama sekali. Tersedia dua pasang fungsi:

- generate_rps_service() / generate_rps_service_async()
- generate_narasi_service() / generate_narasi_service_async()

Varian *_async penting karena backend SADEWA memakai FastAPI. Panggilan ke LLM
bersifat blocking dan bisa memakan puluhan detik; bila dijalankan langsung di
dalam endpoint async, event loop ikut terblokir sehingga seluruh request lain
ikut tertahan. Varian async menjalankan pekerjaan di thread terpisah.

Semua fungsi mengembalikan `AIResponse` (lihat schemas.py) — bentuknya selalu
sama baik sukses maupun gagal, sehingga backend tidak perlu try/except
terpisah untuk tiap jenis error dari pipeline AI.
"""

import asyncio
import logging
import time
from typing import Any, AsyncIterator, Callable, Dict, Tuple

from pydantic import ValidationError

from . import rag_chain
from .config import ConfigError, settings
from .llm_client import JSONExtractionError, LLMError
from .retriever import VectorstoreNotFoundError, count_chunks, warmup as _warmup
from .schemas import AIResponse, EvaluasiCPMKRequest, HealthStatus, NarasiRequest, RPSRequest

logger = logging.getLogger(__name__)


def _pesan_validasi(exc: ValidationError) -> str:
    """Ubah ValidationError pydantic jadi satu baris pesan yang mudah dibaca."""
    bagian = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()]
    return "Input tidak valid — " + "; ".join(bagian)


def _jalankan(fungsi: Callable[..., Dict[str, Any]], **kwargs: Any) -> AIResponse:
    """Bungkus pemanggilan pipeline dengan pengukuran waktu dan penanganan error."""
    mulai = time.time()
    try:
        hasil = fungsi(**kwargs)
        durasi = time.time() - mulai
        return AIResponse(
            success=True,
            data=hasil["data"],
            duration_seconds=round(durasi, 2),
            warnings=hasil.get("pelanggaran_validasi", []),
            sumber_dokumen=hasil.get("sumber_dokumen"),
        )
    except (ConfigError, VectorstoreNotFoundError, LLMError, JSONExtractionError) as exc:
        return AIResponse(success=False, error=str(exc), duration_seconds=round(time.time() - mulai, 2))
    except Exception as exc:  # noqa: BLE001 - jaring pengaman terakhir
        logger.exception("Kesalahan tak terduga pada pipeline AI")
        return AIResponse(
            success=False,
            error=f"Kesalahan tak terduga: {exc}",
            duration_seconds=round(time.time() - mulai, 2),
        )


# --- Layanan RPS --------------------------------------------------------------


def generate_rps_service(**kwargs: Any) -> AIResponse:
    """
    Bangkitkan draf RPS. Dipakai endpoint SADEWA generate RPS.

    Terima keyword argument sesuai field `RPSRequest` (mk_name, sks, semester,
    prodi, deskripsi). Validasi input dilakukan otomatis oleh pydantic.
    """
    try:
        req = RPSRequest(**kwargs)
    except ValidationError as exc:
        return AIResponse(success=False, error=_pesan_validasi(exc))

    return _jalankan(rag_chain.generate_rps, **req.model_dump())


async def generate_rps_service_async(**kwargs: Any) -> AIResponse:
    """Versi async-safe untuk dipanggil dari endpoint FastAPI."""
    return await asyncio.to_thread(generate_rps_service, **kwargs)


# --- Layanan Narasi Evaluasi (SADEWA-21) --------------------------------------


def generate_narasi_service(**kwargs: Any) -> AIResponse:
    """
    Bangkitkan laporan narasi evaluasi kurikulum.
    Dipakai endpoint SADEWA-21 POST /narasi/generate/{matkul_id}.

    Terima keyword argument sesuai field `NarasiRequest` (mk_name, prodi,
    semester, tahun_ajaran, capaian — daftar hasil kalkulasi ketercapaian dari
    backend). Hasil pada field `data` siap disimpan ke tabel narasi_evaluasi
    (kolom `konten`, dengan `tipe` diisi oleh backend).
    """
    try:
        req = NarasiRequest(**kwargs)
    except ValidationError as exc:
        return AIResponse(success=False, error=_pesan_validasi(exc))

    payload = req.model_dump()
    payload["capaian"] = [c for c in payload["capaian"]]
    return _jalankan(rag_chain.generate_narasi_evaluasi, **payload)


async def generate_narasi_service_async(**kwargs: Any) -> AIResponse:
    """Versi async-safe untuk dipanggil dari endpoint FastAPI."""
    return await asyncio.to_thread(generate_narasi_service, **kwargs)


# --- Layanan Evaluasi CPMK (sheet Evaluasi portofolio) -------------------------


def generate_evaluasi_cpmk_service(**kwargs: Any) -> AIResponse:
    """
    Saran Analisis Pelaksanaan Pembelajaran & Rencana Perbaikan per CPMK.
    Terima keyword argument sesuai field `EvaluasiCPMKRequest`.
    """
    try:
        req = EvaluasiCPMKRequest(**kwargs)
    except ValidationError as exc:
        return AIResponse(success=False, error=_pesan_validasi(exc))

    return _jalankan(rag_chain.generate_evaluasi_cpmk, **req.model_dump())


async def generate_evaluasi_cpmk_service_async(**kwargs: Any) -> AIResponse:
    """Versi async-safe untuk dipanggil dari endpoint FastAPI."""
    return await asyncio.to_thread(generate_evaluasi_cpmk_service, **kwargs)


# --- Versi streaming (progres + teks bertahap) -----------------------------------

Event = Tuple[str, Dict[str, Any]]


async def _stream(fungsi: Callable[..., Dict[str, Any]], **kwargs: Any) -> AsyncIterator[Event]:
    """
    Jalankan pipeline di thread terpisah dan alirkan event progresnya.

    Menghasilkan pasangan (jenis, data): event dari rag_chain ("tahap", "sumber",
    "token", "ulang") lalu tepat satu event penutup "hasil" berisi AIResponse
    (sukses maupun gagal, bentuknya sama dengan versi non-streaming).
    """
    loop = asyncio.get_running_loop()
    antrean: "asyncio.Queue[Event | None]" = asyncio.Queue()

    def kirim(jenis: str, data: Dict[str, Any]) -> None:
        loop.call_soon_threadsafe(antrean.put_nowait, (jenis, data))

    def kerja() -> None:
        try:
            hasil = _jalankan(fungsi, on_event=kirim, **kwargs)
            kirim("hasil", hasil.model_dump())
        finally:
            loop.call_soon_threadsafe(antrean.put_nowait, None)

    tugas = loop.run_in_executor(None, kerja)
    try:
        while True:
            item = await antrean.get()
            if item is None:
                break
            yield item
    finally:
        # Klien bisa memutus koneksi di tengah jalan. Thread LLM tidak bisa dihentikan
        # paksa, jadi biarkan selesai di belakang tanpa ditunggu.
        if not tugas.done():
            tugas.add_done_callback(lambda t: t.exception())


async def _stream_validasi(model: Any, fungsi: Callable[..., Dict[str, Any]], kwargs: Dict[str, Any]) -> AsyncIterator[Event]:
    try:
        req = model(**kwargs)
    except ValidationError as exc:
        yield "hasil", AIResponse(success=False, error=_pesan_validasi(exc)).model_dump()
        return
    async for event in _stream(fungsi, **req.model_dump()):
        yield event


def stream_rps_service(**kwargs: Any) -> AsyncIterator[Event]:
    """Generate RPS sambil mengalirkan progres. Parameter sama dengan generate_rps_service()."""
    return _stream_validasi(RPSRequest, rag_chain.generate_rps, kwargs)


def stream_narasi_service(**kwargs: Any) -> AsyncIterator[Event]:
    """Generate narasi sambil mengalirkan progres. Parameter sama dengan generate_narasi_service()."""
    return _stream_validasi(NarasiRequest, rag_chain.generate_narasi_evaluasi, kwargs)


# --- Utilitas untuk backend ----------------------------------------------------


def warmup() -> None:
    """
    Panggil sekali saat aplikasi FastAPI start agar model embedding dan koneksi
    ChromaDB sudah siap sebelum request pertama masuk.
    """
    _warmup()


def health_check() -> HealthStatus:
    """Status kesiapan modul AI, berguna untuk endpoint /health."""
    jumlah = count_chunks()
    return HealthStatus(
        api_key_terisi=bool(settings.qwen_api_key),
        model=settings.qwen_model,
        base_url=settings.qwen_base_url,
        jumlah_chunk=jumlah,
        vectorstore_siap=jumlah > 0,
    )
