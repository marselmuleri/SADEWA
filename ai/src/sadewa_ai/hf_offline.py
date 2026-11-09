"""
Mode offline Hugging Face otomatis.

Saat start, sentence-transformers mengecek versi model ke huggingface.co walaupun
model sudah ada di cache. Bila jaringan memblokir huggingface.co, pengecekan itu
gagal berulang kali (ConnectionResetError, retry 5×) sehingga startup lambat dan
log penuh peringatan.

Bila semua file model sudah ada di cache lokal, modul ini menyalakan
HF_HUB_OFFLINE=1 agar model langsung dimuat dari disk. Bila model belum ada
(komputer baru), tidak ada yang diubah sehingga model tetap diunduh.

HARUS dipanggil sebelum huggingface_hub / transformers diimpor, karena nilai
HF_HUB_OFFLINE dibaca saat library itu diimpor.
Atur SADEWA_HF_OFFLINE=0 untuk mematikan perilaku ini, atau =1 untuk memaksa.
"""
import os
from pathlib import Path

FILE_WAJIB = ("modules.json", "config.json", "config_sentence_transformers.json")
FILE_BOBOT = ("model.safetensors", "pytorch_model.bin")


def _folder_cache_hub() -> Path:
    if os.environ.get("HF_HUB_CACHE"):
        return Path(os.environ["HF_HUB_CACHE"])
    if os.environ.get("HF_HOME"):
        return Path(os.environ["HF_HOME"]) / "hub"
    xdg = os.environ.get("XDG_CACHE_HOME")
    base = Path(xdg) if xdg else Path.home() / ".cache"
    return base / "huggingface" / "hub"


def model_ada_di_cache(model_name: str, cache_dir: Path | None = None) -> bool:
    """True bila snapshot model (sesuai refs/main) lengkap di cache lokal."""
    folder = (cache_dir or _folder_cache_hub()) / ("models--" + model_name.replace("/", "--"))
    try:
        revisi = (folder / "refs" / "main").read_text(encoding="utf-8").strip()
    except OSError:
        return False
    snapshot = folder / "snapshots" / revisi
    return all((snapshot / f).is_file() for f in FILE_WAJIB) and any(
        (snapshot / f).is_file() for f in FILE_BOBOT
    )


def aktifkan_offline_bila_tersedia(model_name: str) -> bool:
    """Nyalakan mode offline HF bila model sudah di cache. Mengembalikan status offline."""
    pilihan = os.environ.get("SADEWA_HF_OFFLINE", "auto").strip().lower()
    if pilihan in ("0", "false", "no"):
        return os.environ.get("HF_HUB_OFFLINE") == "1"
    if pilihan in ("1", "true", "yes") or model_ada_di_cache(model_name):
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    return os.environ.get("HF_HUB_OFFLINE") == "1"
