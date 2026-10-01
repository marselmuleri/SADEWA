import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.database import Base, engine
from app.services.rag_service import health as ai_health, warmup as ai_warmup

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inisialisasi tabel basis data
    Base.metadata.create_all(bind=engine)
    # Warmup model embedding & ChromaDB di background agar request pertama responsif
    try:
        ai_warmup()
    except Exception as exc:
        logger.warning("AI warmup ditangguhkan atau dilewati: %s", exc)
    yield


app = FastAPI(
    title="SADEWA API",
    description="Sistem Analisis Data Evaluasi Wawancara Akademik (OBE Framework UNDIP)",
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "SADEWA API aktif"}


@app.get("/health/ai", tags=["monitoring"])
def check_ai_health():
    """Endpoint untuk memantau status kesehatan ChromaDB vectorstore dan Qwen LLM."""
    return ai_health()

