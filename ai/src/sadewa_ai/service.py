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
from typing import Any, Callable, Dict

from pydantic import ValidationError

from . import rag_chain
from .config import ConfigError, settings
from .llm_client import JSONExtractionError, LLMError
from .retriever import VectorstoreNotFoundError, count_chunks, warmup as _warmup
from .schemas import AIResponse, HealthStatus, NarasiRequest, RPSRequest

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
