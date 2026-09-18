"""
Wrapper REST API opsional untuk modul AI SADEWA.

Kalau backend utama SADEWA (FastAPI/Laravel/Express/dsb) ada di repo/bahasa
lain, cara terbaik untuk "nyambungin" modul AI ini adalah lewat HTTP — bukan
minta semua orang install Python + dependensi RAG di mesin masing-masing.
File ini membungkus service.py menjadi tiga endpoint kecil:

    GET  /health              -> status vectorstore & konfigurasi LLM
    POST /api/v1/rps          -> generate draf RPS
    POST /api/v1/narasi       -> generate narasi evaluasi kurikulum

Kalau backend justru satu repo Python yang sama dengan modul ini, endpoint ini
TIDAK wajib dipakai — import langsung `sadewa_ai.service` juga tetap didukung
dan lebih cepat (tidak ada overhead HTTP).

Jalankan lokal:
    uvicorn sadewa_ai.api:app --reload --port 8001

Dokumentasi interaktif otomatis tersedia di /docs (Swagger) dan /redoc.
"""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .logging_config import setup_logging
from .schemas import AIResponse, HealthStatus, NarasiRequest, RPSRequest
from .service import (
    generate_narasi_service_async,
    generate_rps_service_async,
    health_check,
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
