import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

from app.api.v1.router import api_v1_router
from app.core.database import Base, engine
from app.services import ai_client

logger = logging.getLogger(__name__)


def auto_sync_schema(db_engine):
    """
    Menyelaraskan kolom-kolom baru pada model ke tabel fisik yang sudah ada di database.
    Base.metadata.create_all() hanya membuat tabel yang belum ada, sehingga kolom baru
    pada tabel yang sudah ada perlu di-patch secara idempotent jika belum ada.
    """
    if db_engine.dialect.name == "postgresql":
        statements = [
            "ALTER TABLE rps ADD COLUMN IF NOT EXISTS konten JSON;",
            "ALTER TABLE rps ADD COLUMN IF NOT EXISTS sumber_dokumen_rag JSON;",
            "ALTER TABLE jenis_evaluasi ADD COLUMN IF NOT EXISTS bobot NUMERIC(5, 2);",
            "ALTER TABLE mahasiswa ADD COLUMN IF NOT EXISTS angkatan SMALLINT;",
            "ALTER TABLE cpl_achievement ADD COLUMN IF NOT EXISTS angkatan INTEGER;",
            "ALTER TABLE cpl_achievement ADD COLUMN IF NOT EXISTS mata_kuliah_id BIGINT REFERENCES mata_kuliah(id);",
            "ALTER TABLE cpl_achievement ADD COLUMN IF NOT EXISTS bobot_cp NUMERIC;",
            "CREATE INDEX IF NOT EXISTS ix_cpl_achievement_mata_kuliah_id ON cpl_achievement (mata_kuliah_id);",
            "ALTER TABLE hasil_evaluasi ADD COLUMN IF NOT EXISTS kurikulum_version_id BIGINT;",
            "ALTER TABLE hasil_evaluasi ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE hasil_evaluasi ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP;",
            "ALTER TABLE hasil_evaluasi ADD COLUMN IF NOT EXISTS finalized_by BIGINT;",
            "ALTER TABLE hasil_evaluasi ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP;",
            "ALTER TABLE hasil_evaluasi ADD COLUMN IF NOT EXISTS unlocked_by BIGINT;",
            "ALTER TABLE hasil_evaluasi ADD COLUMN IF NOT EXISTS alasan_buka VARCHAR(255);",
            "ALTER TABLE nilai_bentuk_penilaian ADD COLUMN IF NOT EXISTS ik_id BIGINT;",
            "ALTER TABLE kurikulum_versions DROP COLUMN IF EXISTS semester;",
            "ALTER TABLE kurikulum_versions ADD COLUMN IF NOT EXISTS deskripsi TEXT;",
            "ALTER TABLE kurikulum_versions ADD COLUMN IF NOT EXISTS tahun INTEGER;",
        ]
        # Satu transaksi per perintah: di PostgreSQL satu perintah yang gagal
        # membatalkan seluruh transaksi, jadi perintah lain tidak boleh ikut batal.
        for stmt in statements:
            try:
                with db_engine.begin() as conn:
                    conn.execute(sa.text(stmt))
            except Exception as e:
                logger.warning("Auto-sync schema notice: %s (%s)", stmt, e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inisialisasi tabel basis data PostgreSQL
    Base.metadata.create_all(bind=engine)
    auto_sync_schema(engine)
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

@app.exception_handler(IntegrityError)
async def integrity_exception_handler(request: Request, exc: IntegrityError):
    logger.warning("Database IntegrityError: %s", exc)
    return JSONResponse(
        status_code=409,
        content={"detail": "Operasi gagal karena konflik integritas data atau data masih digunakan relasi lain."},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Terjadi kesalahan internal pada server.", "error": str(exc)},
    )

app.include_router(api_v1_router)

@app.get("/")
def root():
    return {"message": "SADEWA API aktif"}


@app.get("/health/ai", tags=["monitoring"])
async def check_ai_health():
    """Endpoint untuk memantau status kesehatan proses terpisah AI Service (port 8001)."""
    return await ai_client.check_health()
