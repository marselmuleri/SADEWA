"""
Modul AI SADEWA — pipeline RAG untuk generate RPS dan narasi evaluasi kurikulum.

Pemakaian umum (sebagai library Python, mis. dari backend FastAPI lain di repo
yang sama):

    from sadewa_ai import generate_rps_service, generate_narasi_service

    hasil = generate_rps_service(
        mk_name="Machine Learning", sks=3, semester="Ganjil",
        prodi="Teknik Komputer", deskripsi="...",
    )
    if hasil.success:
        ...

Untuk integrasi lintas bahasa/repo, lihat `sadewa_ai.api` — wrapper FastAPI
yang membungkus fungsi-fungsi ini menjadi endpoint HTTP biasa.

Catatan desain -- lazy import (PEP 562):
Versi sebelumnya mengimpor semua submodule (termasuk `service` dan
`retriever`) langsung di baris atas file ini. Karena Python selalu
menjalankan `__init__.py` sebuah package sebelum submodule apa pun bisa
diakses, akibatnya `from sadewa_ai.config import settings` pun ikut memaksa
loading ChromaDB + PyTorch lewat retriever.py, padahal config.py sendiri
sama sekali tidak butuh itu. Ini juga membuat modul ringan (config, schemas,
validators) tidak bisa dites atau dipakai sendirian tanpa menginstal seluruh
stack RAG.

Dengan `__getattr__` di bawah, `import sadewa_ai` sendiri menjadi ringan.
Beban impor berat hanya terjadi tepat saat atribut yang bersangkutan benar-
benar diakses (mis. `sadewa_ai.generate_rps_service`), bukan saat modul
diimpor.
"""

from typing import TYPE_CHECKING

__version__ = "1.0.0"

__all__ = [
    "__version__",
    # Layanan utama
    "generate_rps_service",
    "generate_rps_service_async",
    "generate_narasi_service",
    "generate_narasi_service_async",
    "health_check",
    "warmup",
    # Skema
    "AIResponse",
    "RPSRequest",
    "RPSData",
    "NarasiRequest",
    "NarasiData",
    "CapaianItem",
    "HealthStatus",
    # Konfigurasi
    "Settings",
    "settings",
    # Error
    "ConfigError",
    "LLMError",
    "JSONExtractionError",
    "VectorstoreNotFoundError",
]

# Peta nama publik -> submodule. Dipakai __getattr__ di bawah untuk mengimpor
# submodule yang tepat hanya saat atributnya diakses.
_LAZY_MAP = {
    "generate_rps_service": ".service",
    "generate_rps_service_async": ".service",
    "generate_narasi_service": ".service",
    "generate_narasi_service_async": ".service",
    "health_check": ".service",
    "warmup": ".service",
    "AIResponse": ".schemas",
    "RPSRequest": ".schemas",
    "RPSData": ".schemas",
    "NarasiRequest": ".schemas",
    "NarasiData": ".schemas",
    "CapaianItem": ".schemas",
    "HealthStatus": ".schemas",
    "Settings": ".config",
    "settings": ".config",
    "ConfigError": ".config",
    "LLMError": ".llm_client",
    "JSONExtractionError": ".llm_client",
    "VectorstoreNotFoundError": ".retriever",
}


def __getattr__(name: str):  # PEP 562
    """Diam-diam mengimpor submodule yang tepat baru saat atributnya dipakai."""
    submodule = _LAZY_MAP.get(name)
    if submodule is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    import importlib

    mod = importlib.import_module(submodule, __name__)
    value = getattr(mod, name)
    globals()[name] = value  # cache supaya akses berikutnya tidak re-import
    return value


def __dir__():
    return sorted(__all__)


if TYPE_CHECKING:  # pragma: no cover - hanya untuk type checker/IDE, tidak dieksekusi
    from .config import ConfigError, Settings, settings
    from .llm_client import JSONExtractionError, LLMError
    from .retriever import VectorstoreNotFoundError
    from .schemas import (
        AIResponse,
        CapaianItem,
        HealthStatus,
        NarasiData,
        NarasiRequest,
        RPSData,
        RPSRequest,
    )
    from .service import (
        generate_narasi_service,
        generate_narasi_service_async,
        generate_rps_service,
        generate_rps_service_async,
        health_check,
        warmup,
    )