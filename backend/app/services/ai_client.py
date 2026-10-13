"""
HTTP client untuk menghubungkan Backend FastAPI dengan AI Service (proses terpisah).

Sesuai arsitektur PRD:
Frontend -> Backend (port 8000) -> AI Service (port 8001 via REST/JSON).
AI Service berjalan sebagai proses mandiri (`uvicorn sadewa_ai.api:app --port 8001`).
Modul ini menangani panggilan HTTP secara non-blocking menggunakan httpx,
dilengkapi penanganan error komprehensif (Connection Error -> 503, Timeout -> 504).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_base_url() -> str:
    return settings.AI_SERVICE_URL.rstrip("/")


def _get_timeout() -> float:
    return float(settings.AI_SERVICE_TIMEOUT_SECONDS)


def _handle_ai_response(res_json: Dict[str, Any]) -> Dict[str, Any]:
    """Validasi respons AIResponse dari AI Service."""
    if not res_json.get("success", False):
        err = res_json.get("error", "AI Service gagal memproses permintaan.")
        logger.error("AI Service failure response: %s", err)

        err_lower = str(err).lower()
        if "vectorstore" in err_lower or "tidak ditemukan" in err_lower:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Knowledge base AI belum siap: {err}",
            )
        if "timeout" in err_lower or "tidak merespons" in err_lower:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=f"AI Service timeout: {err}",
            )
        if "api key" in err_lower or "ditolak" in err_lower:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Autentikasi LLM AI Service gagal: {err}",
            )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Service error: {err}",
        )

    return res_json


async def check_health() -> Dict[str, Any]:
    """Cek kesehatan AI Service (GET /health)."""
    url = f"{_get_base_url()}/health"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.json()
            return {
                "status": "degraded",
                "detail": f"AI Service merespons status code {resp.status_code}",
            }
    except (httpx.ConnectError, httpx.ConnectTimeout):
        return {
            "status": "unhealthy",
            "detail": f"Tidak dapat terhubung ke AI Service di {url}. Pastikan proses AI Service berjalan.",
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "detail": f"Gagal menghubungi AI Service: {exc}",
        }


async def generate_rps(
    mk_name: str,
    sks: int,
    semester: str,
    prodi: str,
    deskripsi: str = "",
) -> Dict[str, Any]:
    """
    Panggil endpoint POST /api/v1/rps pada AI Service.
    """
    url = f"{_get_base_url()}/api/v1/rps"
    payload = {
        "mk_name": mk_name,
        "sks": sks,
        "semester": semester,
        "prodi": prodi,
        "deskripsi": deskripsi,
    }

    try:
        async with httpx.AsyncClient(timeout=_get_timeout()) as client:
            resp = await client.post(url, json=payload)
    except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
        logger.error("Gagal terhubung ke AI Service di %s: %s", url, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Service tidak dapat dihubungi. Pastikan AI Service aktif di port 8001.",
        ) from exc
    except httpx.ReadTimeout as exc:
        logger.error("Timeout membaca respons dari AI Service (%ss)", _get_timeout())
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"AI Service melebihi batas waktu {_get_timeout()} detik.",
        ) from exc
    except Exception as exc:
        logger.error("Error tak terduga saat memanggil AI Service: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gagal berkomunikasi dengan AI Service: {exc}",
        ) from exc

    if resp.status_code != 200:
        logger.error("AI Service HTTP %s: %s", resp.status_code, resp.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Service mengembalikan status HTTP {resp.status_code}",
        )

    return _handle_ai_response(resp.json())


async def generate_narasi(
    mk_name: str,
    prodi: str,
    semester: str,
    tahun_ajaran: str,
    capaian: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Panggil endpoint POST /api/v1/narasi pada AI Service.
    """
    url = f"{_get_base_url()}/api/v1/narasi"
    payload = {
        "mk_name": mk_name,
        "prodi": prodi,
        "semester": semester,
        "tahun_ajaran": tahun_ajaran,
        "capaian": capaian,
    }

    try:
        async with httpx.AsyncClient(timeout=_get_timeout()) as client:
            resp = await client.post(url, json=payload)
    except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
        logger.error("Gagal terhubung ke AI Service di %s: %s", url, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Service tidak dapat dihubungi. Pastikan AI Service aktif di port 8001.",
        ) from exc
    except httpx.ReadTimeout as exc:
        logger.error("Timeout membaca respons dari AI Service (%ss)", _get_timeout())
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"AI Service melebihi batas waktu {_get_timeout()} detik.",
        ) from exc
    except Exception as exc:
        logger.error("Error tak terduga saat memanggil AI Service: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gagal berkomunikasi dengan AI Service: {exc}",
        ) from exc

    if resp.status_code != 200:
        logger.error("AI Service HTTP %s: %s", resp.status_code, resp.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Service mengembalikan status HTTP {resp.status_code}",
        )

    return _handle_ai_response(resp.json())

