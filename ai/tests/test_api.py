"""
Uji endpoint FastAPI di sadewa_ai/api.py.

Pipeline RAG (LLM + ChromaDB) di-mock sepenuhnya di sini — tujuannya menguji
routing, validasi request, dan bentuk response API, bukan mengulang uji
pipeline RAG (sudah dicakup test_validators.py dan test_llm_parsing.py).

Membutuhkan extra `api` dan `dev`: pip install -e ".[api,dev]"
"""

import pytest

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from sadewa_ai import api  # noqa: E402
from sadewa_ai.schemas import AIResponse, HealthStatus  # noqa: E402


@pytest.fixture()
def client(monkeypatch):
    # Lewati warmup() sungguhan (butuh vectorstore & model embedding asli)
    # supaya test tidak butuh koneksi internet atau knowledge base ter-build.
    monkeypatch.setattr(api, "warmup", lambda: None)

    async def _fake_rps(**kwargs):
        return AIResponse(success=True, data={"kode_mk": "TKK1234"}, duration_seconds=0.1)

    async def _fake_narasi(**kwargs):
        return AIResponse(success=True, data={"ringkasan_capaian": "ok"}, duration_seconds=0.1)

    monkeypatch.setattr(api, "generate_rps_service_async", _fake_rps)
    monkeypatch.setattr(api, "generate_narasi_service_async", _fake_narasi)
    monkeypatch.setattr(
        api,
        "health_check",
        lambda: HealthStatus(
            api_key_terisi=True, model="qwen-plus-2025-07-28",
            base_url="https://example.com", jumlah_chunk=42, vectorstore_siap=True,
        ),
    )

    with TestClient(api.app) as c:
        yield c


def test_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["vectorstore_siap"] is True


def test_generate_rps_endpoint_sukses(client):
    resp = client.post("/api/v1/rps", json={
        "mk_name": "Machine Learning", "sks": 3, "semester": "Ganjil",
        "prodi": "Teknik Komputer", "deskripsi": "Deskripsi",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["kode_mk"] == "TKK1234"


def test_generate_rps_endpoint_validasi_gagal(client):
    resp = client.post("/api/v1/rps", json={
        "mk_name": "Machine Learning", "sks": 99, "semester": "Ganjil",
        "prodi": "Teknik Komputer",
    })
    # SKS di luar SKS_VALID ditolak pydantic sebelum masuk service -> 422
    assert resp.status_code == 422


def test_generate_narasi_endpoint_sukses(client):
    resp = client.post("/api/v1/narasi", json={
        "mk_name": "ML", "prodi": "Teknik Komputer", "semester": "Ganjil",
        "tahun_ajaran": "2025/2026",
        "capaian": [{"kode": "CPL 3", "nilai_rata_rata": 64.5}],
    })
    assert resp.status_code == 200
    assert resp.json()["success"] is True
