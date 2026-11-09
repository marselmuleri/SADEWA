"""
Wrapper REST API opsional untuk modul AI SADEWA.

Kalau backend utama SADEWA (FastAPI/Laravel/Express/dsb) ada di repo/bahasa
lain, cara terbaik untuk "nyambungin" modul AI ini adalah lewat HTTP — bukan
minta semua orang install Python + dependensi RAG di mesin masing-masing.
File ini membungkus service.py menjadi tiga endpoint kecil:

    GET  /health              -> status vectorstore & konfigurasi LLM
    POST /api/v1/rps          -> generate draf RPS
    POST /api/v1/narasi       -> generate narasi evaluasi kurikulum
    POST /api/v1/evaluasi-cpmk -> saran analisis & rencana perbaikan per CPMK
    POST /api/v1/rps/stream    -> generate RPS + progres langsung (Server-Sent Events)
    POST /api/v1/narasi/stream -> generate narasi + progres langsung (Server-Sent Events)

Kalau backend justru satu repo Python yang sama dengan modul ini, endpoint ini
TIDAK wajib dipakai — import langsung `sadewa_ai.service` juga tetap didukung
dan lebih cepat (tidak ada overhead HTTP).

Jalankan lokal:
    uvicorn sadewa_ai.api:app --reload --port 8001

Dokumentasi interaktif otomatis tersedia di /docs (Swagger) dan /redoc.
"""

import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Dict, Tuple

from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse

from .logging_config import setup_logging
from .schemas import AIResponse, EvaluasiCPMKRequest, HealthStatus, NarasiRequest, RPSRequest
from .service import (
    generate_evaluasi_cpmk_service_async,
    generate_narasi_service_async,
    generate_rps_service_async,
    health_check,
    stream_narasi_service,
    stream_rps_service,
    warmup,
)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    # Memuat model embedding & koneksi ChromaDB sekali di awal, supaya request
    # pertama dari pengguna tidak ikut menanggung waktu loading (beberapa detik).
    warmup()
    yield


app = FastAPI(
    title="SADEWA AI Service",
    description="Layanan generate RPS dan narasi evaluasi kurikulum (RAG + Qwen).",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthStatus, tags=["monitoring"])
async def get_health() -> HealthStatus:
    """Cek kesiapan modul: vectorstore terisi dan API key LLM tersedia."""
    return health_check()


@app.post("/api/v1/rps", response_model=AIResponse, tags=["rps"])
async def post_generate_rps(payload: RPSRequest) -> AIResponse:
    """Bangkitkan draf RPS 16 pertemuan untuk satu mata kuliah."""
    return await generate_rps_service_async(**payload.model_dump())


@app.post("/api/v1/narasi", response_model=AIResponse, tags=["narasi"])
async def post_generate_narasi(payload: NarasiRequest) -> AIResponse:
    """Bangkitkan laporan narasi evaluasi kurikulum (endpoint SADEWA-21)."""
    kwargs = payload.model_dump()
    return await generate_narasi_service_async(**kwargs)


def _sse(events: AsyncIterator[Tuple[str, Dict[str, Any]]]) -> StreamingResponse:
    """Bungkus event (jenis, data) menjadi Server-Sent Events."""

    async def badan() -> AsyncIterator[str]:
        async for jenis, data in events:
            yield f"event: {jenis}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        badan(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/v1/rps/stream", tags=["rps"])
async def post_stream_rps(payload: RPSRequest) -> StreamingResponse:
    """
    Sama seperti /api/v1/rps, tetapi mengalirkan progres sebagai Server-Sent Events:
    tahap, sumber, token (teks JSON bertahap), ulang, lalu satu event `hasil` (AIResponse).
    """
    return _sse(stream_rps_service(**payload.model_dump()))


@app.post("/api/v1/narasi/stream", tags=["narasi"])
async def post_stream_narasi(payload: NarasiRequest) -> StreamingResponse:
    """Versi streaming /api/v1/narasi. Format event sama dengan /api/v1/rps/stream."""
    return _sse(stream_narasi_service(**payload.model_dump()))


@app.post("/api/v1/evaluasi-cpmk", response_model=AIResponse, tags=["evaluasi"])
async def post_generate_evaluasi_cpmk(payload: EvaluasiCPMKRequest) -> AIResponse:
    """Saran analisis pelaksanaan & rencana perbaikan per CPMK (sheet Evaluasi portofolio)."""
    return await generate_evaluasi_cpmk_service_async(**payload.model_dump())


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request, exc: Exception) -> JSONResponse:
    """
    Jaring pengaman terakhir. service.py sudah menangkap error yang diketahui
    dan mengembalikannya sebagai AIResponse(success=False, ...); handler ini
    hanya untuk error benar-benar tak terduga (bug, dependensi crash, dst)
    supaya API tetap balas JSON yang rapi, bukan traceback mentah ke client.
    """
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": f"Kesalahan internal server: {exc}"},
    )
