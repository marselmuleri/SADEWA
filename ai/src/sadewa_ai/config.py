"""
Konfigurasi terpusat untuk modul AI SADEWA.

Dipakai lewat singleton `settings` di bawah, bukan konstanta modul-level lepas.
Alasan pindah ke pydantic-settings (bukan `os.getenv` manual):

- Validasi tipe terjadi otomatis (mis. LLM_TIMEOUT_SECONDS langsung jadi int),
  bukan string mentah yang bisa lolos begitu saja ke tempat yang mengharapkan
  angka.
- Satu sumber kebenaran yang mudah di-mock di test (`Settings(qwen_api_key=...)`)
  tanpa harus utak-atik environment variable proses.
- `validate_llm_config()` tetap dipanggil eksplisit sebelum request ke LLM,
  supaya pesan error untuk QWEN_API_KEY yang kosong tetap ramah, bukan
  traceback mentah dari client OpenAI.

Nilai default mengikuti Tabel 23, 24, dan 26 pada dokumen C300.
"""

from functools import lru_cache
from pathlib import Path
from typing import Tuple

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfigError(RuntimeError):
    """Konfigurasi wajib tidak terpenuhi."""


class Settings(BaseSettings):
    """Seluruh konfigurasi modul AI, dibaca dari environment variable / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # --- Path & koleksi ------------------------------------------------
    docs_dir: str = Field(default="./docs", alias="SADEWA_DOCS_DIR")
    vectorstore_dir: str = Field(default="./vectorstore", alias="SADEWA_VECTORSTORE_DIR")
    collection_name: str = "sadewa_kurikulum"

    # --- Embedding & chunking (C300 Tabel 24) ---------------------------
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    chunk_size: int = 500
    chunk_overlap: int = 100
    top_k_chunks: int = 4

    # --- LLM Qwen --------------------------------------------------------
    # Sengaja tidak diberi default agar terlihat jelas saat kosong lewat
    # validate_llm_config(), dipanggil sebelum request pertama ke LLM.
    qwen_api_key: str = Field(default="", alias="QWEN_API_KEY")
    # Endpoint internasional (Singapore) secara default. Untuk region China
    # Beijing gunakan https://dashscope.aliyuncs.com/compatible-mode/v1
    qwen_base_url: str = Field(
        default="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        alias="QWEN_BASE_URL",
    )
    # Snapshot bertanggal, bukan alias generik "qwen-plus", agar perilaku
    # model konsisten dan kuota yang dipakai jelas versinya.
    qwen_model: str = Field(default="qwen-plus-2025-07-28", alias="QWEN_MODEL")

    llm_timeout_seconds: int = 120
    llm_max_retries: int = 2

    # Parameter generasi
    rps_max_tokens: int = 3000
    rps_temperature: float = 0.4
    narasi_max_tokens: int = 2500
    narasi_temperature: float = 0.5

    # --- Aturan validasi RPS --------------------------------------------
    jumlah_pertemuan: int = 16
    minggu_uts: int = 8
    minggu_uas: int = 16
    bobot_total: int = 100
    sks_valid: Tuple[int, ...] = (1, 2, 3, 4, 6)
    semester_valid: Tuple[str, ...] = ("Ganjil", "Genap")

    # Ambang ketercapaian CPL/CPMK (skala 0-100)
    ambang_tercapai: float = 70.0

    @field_validator("docs_dir", "vectorstore_dir")
    @classmethod
    def _normalisasi_path(cls, v: str) -> str:
        return str(Path(v))

    @property
    def ingest_manifest_path(self) -> str:
        return str(Path(self.vectorstore_dir) / "ingest_manifest.json")

    def validate_llm_config(self) -> None:
        """Dipanggil sebelum memakai LLM agar pesan error jelas, bukan error mentah."""
        if not self.qwen_api_key:
            raise ConfigError(
                "QWEN_API_KEY belum diisi. Buat file .env di root proyek "
                "(contoh ada di .env.example) lalu isi QWEN_API_KEY=sk-xxxx"
            )


@lru_cache
def get_settings() -> Settings:
    """Singleton settings — dibaca sekali, dipakai ulang di seluruh modul."""
    return Settings()


# Instance siap-pakai untuk pemakaian biasa: `from sadewa_ai.config import settings`.
# Test yang butuh konfigurasi berbeda bisa memakai Settings(...) langsung tanpa
# menyentuh singleton ini, atau me-reset cache dengan `get_settings.cache_clear()`.
settings = get_settings()
