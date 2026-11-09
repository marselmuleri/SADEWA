"""
HTTP client untuk menghubungkan Backend FastAPI dengan AI Service (proses terpisah).

Sesuai arsitektur PRD:
Frontend -> Backend (port 8000) -> AI Service (port 8001 via REST/JSON).
AI Service berjalan sebagai proses mandiri (`uvicorn sadewa_ai.api:app --port 8001`).
Modul ini menangani panggilan HTTP secara non-blocking menggunakan httpx,
dilengkapi penanganan error komprehensif (Connection Error -> 503, Timeout -> 504).
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_base_url() -> str:
    return settings.AI_SERVICE_URL.rstrip("/")


def _get_timeout() -> float:
    return float(settings.AI_SERVICE_TIMEOUT_SECONDS)


def _error_ke_http(err: Any) -> HTTPException:
    """Terjemahkan pesan error AIResponse menjadi HTTPException dengan status yang sesuai."""
    err_lower = str(err).lower()
    if "vectorstore" in err_lower or "tidak ditemukan" in err_lower:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Knowledge base AI belum siap: {err}",
        )
    if "timeout" in err_lower or "tidak merespons" in err_lower:
        return HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"AI Service timeout: {err}",
        )
    if "api key" in err_lower or "ditolak" in err_lower:
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Autentikasi LLM AI Service gagal: {err}",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"AI Service error: {err}",
    )


def _handle_ai_response(res_json: Dict[str, Any]) -> Dict[str, Any]:
    """Validasi respons AIResponse dari AI Service."""
    if not res_json.get("success", False):
        err = res_json.get("error", "AI Service gagal memproses permintaan.")
        logger.error("AI Service failure response: %s", err)
        raise _error_ke_http(err)

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


async def _post_ai(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """POST ke AI Service dan terjemahkan kegagalan jaringan/HTTP menjadi HTTPException."""
    url = f"{_get_base_url()}{path}"
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


async def generate_rps(
    mk_name: str,
    sks: int,
    semester: str,
    prodi: str,
    deskripsi: str = "",
) -> Dict[str, Any]:
    """Panggil endpoint POST /api/v1/rps pada AI Service."""
    return await _post_ai("/api/v1/rps", {
        "mk_name": mk_name,
        "sks": sks,
        "semester": semester,
        "prodi": prodi,
        "deskripsi": deskripsi,
    })


async def generate_narasi(
    mk_name: str,
    prodi: str,
    semester: str,
    tahun_ajaran: str,
    capaian: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Panggil endpoint POST /api/v1/narasi pada AI Service."""
    return await _post_ai("/api/v1/narasi", {
        "mk_name": mk_name,
        "prodi": prodi,
        "semester": semester,
        "tahun_ajaran": tahun_ajaran,
        "capaian": capaian,
    })


async def stream_ai(path: str, payload: Dict[str, Any]) -> AsyncIterator[Tuple[str, Dict[str, Any]]]:
    """
    POST ke endpoint streaming AI Service dan hasilkan event (jenis, data) dari Server-Sent Events.

    Event progres (tahap, sumber, token, ulang) diteruskan apa adanya. Event penutup
    `hasil` divalidasi seperti versi non-streaming: bila gagal, HTTPException dilempar
    sehingga pemanggil bisa mengubahnya menjadi event error. Kegagalan jaringan juga
    diterjemahkan ke HTTPException (503/504/502) seperti `_post_ai`.

    Timeout baca berlaku per potongan data (bukan untuk seluruh jawaban), sama dengan
    perilaku streaming di sisi LLM.
    """
    url = f"{_get_base_url()}{path}"
    timeout = httpx.Timeout(_get_timeout(), connect=10.0)
    ada_hasil = False
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, json=payload) as resp:
                if resp.status_code != 200:
                    await resp.aread()
                    logger.error("AI Service stream HTTP %s: %s", resp.status_code, resp.text)
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"AI Service mengembalikan status HTTP {resp.status_code}",
                    )
                jenis: Optional[str] = None
                data_baris: List[str] = []
                async for baris in resp.aiter_lines():
                    if baris.startswith("event:"):
                        jenis = baris[6:].strip()
                    elif baris.startswith("data:"):
                        data_baris.append(baris[5:].lstrip())
                    elif baris == "" and jenis:
                        data = json.loads("\n".join(data_baris)) if data_baris else {}
                        if jenis == "hasil":
                            ada_hasil = True
                            yield jenis, _handle_ai_response(data)
                        else:
                            yield jenis, data
                        jenis, data_baris = None, []
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
        logger.error("Gagal terhubung ke AI Service di %s: %s", url, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Service tidak dapat dihubungi. Pastikan AI Service aktif di port 8001.",
        ) from exc
    except httpx.ReadTimeout as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"AI Service tidak mengirim data selama {_get_timeout()} detik.",
        ) from exc
    except Exception as exc:
        logger.error("Error tak terduga saat streaming dari AI Service: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gagal berkomunikasi dengan AI Service: {exc}",
        ) from exc

    if not ada_hasil:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Koneksi ke AI Service terputus sebelum hasil selesai dikirim.",
        )


def stream_rps(mk_name: str, sks: int, semester: str, prodi: str, deskripsi: str = ""):
    """Versi streaming generate_rps(): POST /api/v1/rps/stream."""
    return stream_ai("/api/v1/rps/stream", {
        "mk_name": mk_name, "sks": sks, "semester": semester, "prodi": prodi, "deskripsi": deskripsi,
    })


def stream_narasi(mk_name: str, prodi: str, semester: str, tahun_ajaran: str, capaian: List[Dict[str, Any]]):
    """Versi streaming generate_narasi(): POST /api/v1/narasi/stream."""
    return stream_ai("/api/v1/narasi/stream", {
        "mk_name": mk_name, "prodi": prodi, "semester": semester,
        "tahun_ajaran": tahun_ajaran, "capaian": capaian,
    })


async def generate_evaluasi_cpmk(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Panggil endpoint POST /api/v1/evaluasi-cpmk pada AI Service.
    payload mengikuti EvaluasiCPMKRequest (mk_name, prodi, semester, tahun_ajaran,
    ambang, target_persen, target_rerata_skala, skala_maks, cpmk[]).
    """
    return await _post_ai("/api/v1/evaluasi-cpmk", payload)