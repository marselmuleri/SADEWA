import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]

# Muat variabel lingkungan dari backend/.env
load_dotenv(BACKEND_DIR / ".env")


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sadewa.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # Konfigurasi Koneksi AI Service (Proses terpisah via HTTP REST)
    AI_SERVICE_URL: str = os.getenv("AI_SERVICE_URL", "http://localhost:8001")
    AI_SERVICE_TIMEOUT_SECONDS: int = int(os.getenv("AI_SERVICE_TIMEOUT_SECONDS", "60"))


settings = Settings()
