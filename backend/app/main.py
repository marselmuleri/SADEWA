import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.database import Base, engine
from app.services import ai_client

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inisialisasi tabel basis data PostgreSQL
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="SADEWA API",
    description="Sistem Analisis Data Evaluasi Wawancara Akademik (OBE Framework UNDIP)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: Izinkan origin spesifik frontend agar kompatibel dengan allow_credentials=True
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "SADEWA API aktif"}


@app.get("/health/ai", tags=["monitoring"])
async def check_ai_health():
    """Endpoint untuk memantau status kesehatan proses terpisah AI Service (port 8001)."""
    return await ai_client.check_health()


app.include_router(api_v1_router)