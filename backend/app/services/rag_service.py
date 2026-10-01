"""
Service layer untuk integrasi modul AI (RAG pipeline) dengan backend SADEWA.

File ini memisahkan logika orkestrasi AI dari route handler (separation of concerns).
Alur data:
    FastAPI Route Handler -> rag_service -> sadewa_ai (RAG chain)
    -> ChromaDB retrieval -> Qwen LLM inference -> Validasi & Respon JSON

Mendukung eksekusi asinkron (async def) agar tidak memblokir event loop FastAPI,
serta penanganan error komprehensif untuk:
    - ChromaDB belum di-ingest / kosong (VectorstoreNotFoundError)
    - LLM timeout / API key error (LLMError)
    - Parsing schema gagal (JSONExtractionError / ValidationError)
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

# Pastikan path modul sadewa_ai dapat ditemukan jika belum diinstall via pip
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parents[2]
AI_SRC_DIR = PROJECT_ROOT / "ai" / "src"
if str(AI_SRC_DIR) not in sys.path and AI_SRC_DIR.exists():
    sys.path.insert(0, str(AI_SRC_DIR))

AIResponse = None
ConfigError = None
HealthStatus = None
JSONExtractionError = None
LLMError = None
VectorstoreNotFoundError = None
generate_narasi_service_async = None
generate_rps_service_async = None
ai_health_check = None
ai_settings = None
ai_warmup = None

try:
    from sadewa_ai import (
        AIResponse,
        ConfigError,
        HealthStatus,
        JSONExtractionError,
        LLMError,
        VectorstoreNotFoundError,
        generate_narasi_service_async,
        generate_rps_service_async,
        health_check as ai_health_check,
        settings as ai_settings,
        warmup as ai_warmup,
    )
except ImportError as exc:
    logging.getLogger(__name__).warning("Modul sadewa_ai atau dependensinya belum lengkap: %s", exc)

from app.models.mata_kuliah import MataKuliah

logger = logging.getLogger(__name__)


def _semester_label(mk: MataKuliah) -> str:
    """Konversi nilai semester enum/string dari DB ke label yang diterima RAG."""
    raw = mk.semester
    if hasattr(raw, "value"):
        return str(raw.value)
    return str(raw) if raw else "Ganjil"


def _handle_ai_error(result: Any) -> None:
    """
    Validasi hasil pemanggilan pipeline AI dan konversi ke HTTP status yang sesuai.
    Menangani kasus ChromaDB kosong, timeout LLM, ataupun respons tidak sesuai skema.
    """
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Modul AI tidak menghasilkan respons.",
        )

    if not getattr(result, "success", False):
        err_msg = getattr(result, "error", "") or "Terjadi kesalahan internal pada pipeline AI."
        logger.error("AI pipeline error: %s", err_msg)

        # ChromaDB belum di-ingest / folder tidak ada
        if "tidak ditemukan" in err_msg.lower() or "sadewa-ingest" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Knowledge base ChromaDB belum siap atau belum di-index. "
                    f"Detail: {err_msg}"
                ),
            )

        # Timeout LLM
        if "tidak merespons" in err_msg.lower() or "timeout" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=f"Permintaan ke Qwen LLM melebihi batas waktu (timeout): {err_msg}",
            )

        # API Key / Autentikasi
        if "api key" in err_msg.lower() or "ditolak" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Autentikasi LLM gagal. Periksa QWEN_API_KEY: {err_msg}",
            )

        # Parsing JSON gagal atau skema tidak cocok
        if "json" in err_msg.lower() or "ekstrak" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Respons LLM tidak memenuhi skema JSON yang diharapkan: {err_msg}",
            )

        # Error umum
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memproses data melalui modul AI: {err_msg}",
        )


async def generate_rps(
    mk: MataKuliah,
    deskripsi: str = "",
) -> Dict[str, Any]:
    """
    Eksekusi pipeline RAG untuk pembuatan draf RPS secara non-blocking (async).

    Alur:
    FastAPI -> sadewa_ai.generate_rps_service_async -> ChromaDB similarity search
    -> Qwen LLM -> Pydantic validator -> Dictionary data terstruktur.
    """
    if generate_rps_service_async is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Paket sadewa_ai belum terpasang dengan benar di lingkungan runtime.",
        )

    prodi_nama = mk.program_studi.nama if mk.program_studi else "Program Studi"
    sks_val = mk.sks if mk.sks in (1, 2, 3, 4, 6) else 3
    semester_val = _semester_label(mk)
    if semester_val not in ("Ganjil", "Genap"):
        semester_val = "Ganjil"

    result = await generate_rps_service_async(
        mk_name=mk.nama or f"Mata Kuliah {mk.kode}",
        sks=sks_val,
        semester=semester_val,
        prodi=prodi_nama,
        deskripsi=deskripsi or "",
    )

    _handle_ai_error(result)
    return {
        "data": getattr(result, "data", {}),
        "duration_seconds": getattr(result, "duration_seconds", 0.0),
        "warnings": getattr(result, "warnings", []),
    }


async def generate_narasi(
    mk: MataKuliah,
    capaian: List[Dict[str, Any]],
    tahun_ajaran: Optional[str] = None,
    transkrip_tambahan: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Eksekusi pipeline RAG untuk narasi evaluasi kurikulum/wawancara secara non-blocking (async).

    Alur:
    FastAPI -> sadewa_ai.generate_narasi_service_async -> ChromaDB similarity search
    -> Qwen LLM -> Pydantic validator -> Dictionary data narasi terstruktur.
    """
    if generate_narasi_service_async is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Paket sadewa_ai belum terpasang dengan benar di lingkungan runtime.",
        )

    prodi_nama = mk.program_studi.nama if mk.program_studi else "Program Studi"
    semester_val = _semester_label(mk)
    if semester_val not in ("Ganjil", "Genap"):
        semester_val = "Ganjil"
    thn_ajaran = tahun_ajaran or mk.tahun_ajaran or "2025/2026"

    # Pastikan data capaian valid dan memiliki minimal 1 item
    formatted_capaian = []
    for item in capaian:
        formatted_capaian.append({
            "kode": str(item.get("kode", "CPL")),
            "deskripsi": str(item.get("deskripsi", "")),
            "nilai_rata_rata": float(item.get("nilai_rata_rata", 0.0)),
            "jumlah_mahasiswa": item.get("jumlah_mahasiswa"),
            "jumlah_tercapai": item.get("jumlah_tercapai"),
        })

    if not formatted_capaian:
        formatted_capaian = [{
            "kode": "CPL Evaluasi",
            "deskripsi": transkrip_tambahan or "Data evaluasi akademik",
            "nilai_rata_rata": 70.0,
            "jumlah_mahasiswa": 30,
            "jumlah_tercapai": 25,
        }]
    elif transkrip_tambahan:
        # Sisipkan konteks transkrip wawancara ke deskripsi capaian pertama bila ada
        formatted_capaian[0]["deskripsi"] = (
            f"{formatted_capaian[0]['deskripsi']} | Catatan Wawancara/Evaluasi: {transkrip_tambahan}"
        )

    result = await generate_narasi_service_async(
        mk_name=mk.nama or f"Mata Kuliah {mk.kode}",
        prodi=prodi_nama,
        semester=semester_val,
        tahun_ajaran=thn_ajaran,
        capaian=formatted_capaian,
    )

    _handle_ai_error(result)
    return {
        "data": getattr(result, "data", {}),
        "duration_seconds": getattr(result, "duration_seconds", 0.0),
        "warnings": getattr(result, "warnings", []),
    }


def health() -> Dict[str, Any]:
    """Cek status kesehatan dan kesiapan ChromaDB serta LLM."""
    if ai_health_check is None:
        return {
            "status": "unhealthy",
            "detail": "Modul sadewa_ai tidak terpasang.",
        }
    status_obj = ai_health_check()
    return {
        "status": "healthy" if status_obj.vectorstore_siap and status_obj.api_key_terisi else "degraded",
        "api_key_terisi": status_obj.api_key_terisi,
        "model": status_obj.model,
        "base_url": status_obj.base_url,
        "jumlah_chunk": status_obj.jumlah_chunk,
        "vectorstore_siap": status_obj.vectorstore_siap,
    }


def warmup() -> None:
    """Pre-load embedding dan ChromaDB saat aplikasi startup agar request pertama cepat."""
    if ai_warmup:
        try:
            ai_warmup()
            logger.info("RAG pipeline warmup berhasil dijalankan.")
        except Exception as exc:
            logger.warning("RAG pipeline warmup gagal atau ditunda: %s", exc)
