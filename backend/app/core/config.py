import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sadewa.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")


settings = Settings()
