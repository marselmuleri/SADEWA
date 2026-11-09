"""Uji deteksi model di cache lokal untuk mode offline Hugging Face otomatis."""
from sadewa_ai import hf_offline

MODEL = "org/model-uji"


def _buat_cache(root, lengkap=True):
    folder = root / "models--org--model-uji"
    (folder / "refs").mkdir(parents=True)
    (folder / "refs" / "main").write_text("abc123")
    snap = folder / "snapshots" / "abc123"
    snap.mkdir(parents=True)
    for f in hf_offline.FILE_WAJIB:
        (snap / f).write_text("{}")
    if lengkap:
        (snap / "model.safetensors").write_bytes(b"x")


def test_model_lengkap_terdeteksi(tmp_path):
    _buat_cache(tmp_path)
    assert hf_offline.model_ada_di_cache(MODEL, tmp_path) is True


def test_model_tanpa_bobot_atau_belum_ada(tmp_path):
    assert hf_offline.model_ada_di_cache(MODEL, tmp_path) is False
    _buat_cache(tmp_path, lengkap=False)
    assert hf_offline.model_ada_di_cache(MODEL, tmp_path) is False


def test_offline_hanya_bila_model_ada(tmp_path, monkeypatch):
    for v in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "SADEWA_HF_OFFLINE", "HF_HUB_CACHE"):
        monkeypatch.delenv(v, raising=False)
    monkeypatch.setenv("HF_HOME", str(tmp_path))

    assert hf_offline.aktifkan_offline_bila_tersedia(MODEL) is False

    _buat_cache(tmp_path / "hub")
    assert hf_offline.aktifkan_offline_bila_tersedia(MODEL) is True


def test_bisa_dimatikan(tmp_path, monkeypatch):
    for v in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE"):
        monkeypatch.delenv(v, raising=False)
    monkeypatch.setenv("HF_HUB_CACHE", str(tmp_path))
    _buat_cache(tmp_path)
    monkeypatch.setenv("SADEWA_HF_OFFLINE", "0")
    assert hf_offline.aktifkan_offline_bila_tersedia(MODEL) is False
