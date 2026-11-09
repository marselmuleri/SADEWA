"""Uji saran Evaluasi CPMK (sheet Evaluasi portofolio) tanpa memanggil LLM sungguhan."""
import json

import pytest

from sadewa_ai import prompts, rag_chain
from sadewa_ai.validators import validate_evaluasi_cpmk

CPMK = [
    {"kode": "CPMK1", "deskripsi": "Mendesain jaringan", "rata_rata": 66.4, "rerata_skala": 2.83,
     "persen_tercapai": 72.1, "jumlah_mahasiswa": 201, "jumlah_tercapai": 145, "memenuhi": True},
    {"kode": "CPMK2", "deskripsi": "Menganalisis topologi", "rata_rata": 55.0, "rerata_skala": 1.9,
     "persen_tercapai": 40.0, "jumlah_mahasiswa": 201, "jumlah_tercapai": 80, "memenuhi": False},
]

LENGKAP = {"evaluasi": [
    {"kode": "CPMK1", "analisis": "Ketercapaian 72,1% ...", "rencana_perbaikan": "Pertahankan ..."},
    {"kode": "CPMK2", "analisis": "Baru 40% ...", "rencana_perbaikan": "Tambah studi kasus ..."},
]}


def test_validator_menerima_data_lengkap():
    assert validate_evaluasi_cpmk(LENGKAP, ["CPMK1", "CPMK2"]) == (True, [])


def test_validator_menolak_cpmk_terlewat_dan_teks_kosong():
    data = {"evaluasi": [{"kode": "CPMK1", "analisis": "ok", "rencana_perbaikan": " "}]}
    valid, errors = validate_evaluasi_cpmk(data, ["CPMK1", "CPMK2"])
    assert not valid
    assert any("CPMK2" in e for e in errors)
    assert any("rencana_perbaikan" in e for e in errors)
    assert validate_evaluasi_cpmk({}, ["CPMK1"])[0] is False


def test_prompt_memuat_angka_dan_status():
    p = prompts.build_evaluasi_cpmk_prompt(
        mk_name="Switching", prodi="Teknik Komputer", semester="Ganjil", tahun_ajaran="2025/2026",
        ambang=60, target_persen=60, cpmk=CPMK, context_kurikulum="(konteks)",
        target_rerata_skala=2.6, skala_maks=4,
    )
    assert "CPMK1" in p and "CPMK2" in p
    assert "145 dari 201" in p
    assert "BELUM MEMENUHI" in p
    assert "Target rerata skala: 2.6 (skala 1-4)" in p


def test_pipeline_mengulang_bila_cpmk_terlewat(monkeypatch):
    jawaban = [
        json.dumps({"evaluasi": LENGKAP["evaluasi"][:1]}),
        json.dumps(LENGKAP),
    ]
    panggilan = []

    def fake_chat(messages, **kwargs):
        panggilan.append(messages)
        return jawaban[len(panggilan) - 1]

    monkeypatch.setattr(rag_chain, "retrieve_context_with_metadata", lambda q: ("konteks", []))
    monkeypatch.setattr(rag_chain, "chat", fake_chat)

    hasil = rag_chain.generate_evaluasi_cpmk(
        mk_name="Switching", prodi="TK", semester="Ganjil", tahun_ajaran="2025/2026", cpmk=CPMK,
    )
    assert len(panggilan) == 2
    assert "CPMK2" in panggilan[1][-1]["content"]
    assert hasil["valid"] is True
    assert [e["kode"] for e in hasil["data"]["evaluasi"]] == ["CPMK1", "CPMK2"]


def test_endpoint_evaluasi_cpmk(monkeypatch):
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient

    from sadewa_ai import api
    from sadewa_ai.schemas import AIResponse

    monkeypatch.setattr(api, "warmup", lambda: None)

    async def fake(**kwargs):
        assert kwargs["cpmk"][0]["kode"] == "CPMK1"
        return AIResponse(success=True, data=LENGKAP, duration_seconds=0.1)

    monkeypatch.setattr(api, "generate_evaluasi_cpmk_service_async", fake)
    with TestClient(api.app) as c:
        res = c.post("/api/v1/evaluasi-cpmk", json={
            "mk_name": "Switching", "prodi": "TK", "semester": "Ganjil",
            "tahun_ajaran": "2025/2026", "cpmk": CPMK,
        })
        assert res.status_code == 200
        assert res.json()["data"]["evaluasi"][1]["kode"] == "CPMK2"

        kosong = c.post("/api/v1/evaluasi-cpmk", json={
            "mk_name": "x", "prodi": "y", "semester": "Ganjil", "tahun_ajaran": "z", "cpmk": [],
        })
        assert kosong.status_code == 422
