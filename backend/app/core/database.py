import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base  # re-export supaya bisa diimpor dari sini juga

if not settings.DATABASE_URL:
    if "pytest" in sys.modules or (len(sys.argv) > 0 and "pytest" in sys.argv[0]):
        db_url = "sqlite:///:memory:"
    else:
        raise RuntimeError(
            "Variabel lingkungan DATABASE_URL belum diatur! "
            "Jangan gunakan SQLite default yang usang. Salin backend/.env.example ke backend/.env "
            "dan isi konfigurasi PostgreSQL yang valid (contoh: postgresql://postgres:postgres@localhost:5432/sadewa)."
        )
else:
    db_url = settings.DATABASE_URL

engine = create_engine(db_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()