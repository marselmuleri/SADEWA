"""
Uji endpoint streaming /api/v1/rps/stream dan /api/v1/narasi/stream.

LLM dan retriever di-mock: yang diuji adalah urutan event progres (tahap, sumber,
token, ulang) dan event penutup `hasil`, bukan kualitas isi RPS.
"""

import json

import pytest

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from sadewa_ai import api, rag_chain  # noqa: E402

RPS_VALID = {
    "kode_mk": "TKK1234",
    "deskripsi_mk": "Deskripsi.",
    "cpl": [{"kode": "CPL 1", "deskripsi": "x", "label": "ENGINEERING DESIGN"}],
    "cpmk": [{"kode": "CPMK 1.1", "deskripsi": "y"}],
    "penilaian": [
        {"poin": "Tugas", "komponen": "Tugas", "rincian": ["Tugas harian"], "bobot": 70, "cpmk": ["CPMK 1.1"]},
        {"poin": "Kognitif / Pengetahuan", "komponen": "UTS", "bobot": 15, "cpmk": ["CPMK 1.1"]},
        {"poin": "Kognitif / Pengetahuan", "komponen": "UAS", "bobot": 15, "cpmk": ["CPMK 1.1"]},
    ],
    "pertemuan": [
        {"minggu": i, "jenis": "UTS"} if i == 8 else {"minggu": i, "jenis": "UAS"} if i == 16 else {
            "minggu": i, "kemampuan_akhir": "Mahasiswa mampu (C3)", "bahan_kajian_judul": f"Materi {i}",
            "bahan_kajian": "rincian", "metode": "Ceramah", "pengalaman_belajar": ["belajar"],
            "target_cpmk": ["CPMK 1.1"], "kriteria_indikator": ["indikator"],
        }
        for i in range(1, 17)
    ],
    "referensi": ["Buku teks"],
}


def _baca_sse(teks: str):
    """Pecah badan SSE menjadi daftar (event, data)."""
    hasil = []
    for blok in teks.strip().split("\n\n"):
        jenis, data = None, None
        for baris in blok.splitlines():
            if baris.startswith("event: "):
                jenis = baris[7:]
            elif baris.startswith("data: "):
                data = json.loads(baris[6:])
        hasil.append((jenis, data))
    return hasil


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(api, "warmup", lambda: None)
    monkeypatch.setattr(
        rag_chain, "retrieve_context_with_metadata",
        lambda q: ("konteks", [{"file": "Pedoman.pdf", "page": 12, "snippet": "CPL prodi"}]),
    )
    monkeypatch.setattr(rag_chain, "fetch_web_context", lambda **kw: "")
    with TestClient(api.app) as c:
        yield c


def _chat_bertahap(teks_list):
    """Tiruan chat(): setiap panggilan mengalirkan teks berikutnya per 20 karakter."""
    sisa = list(teks_list)

    def chat(messages, max_tokens, temperature, model=None, on_token=None):
        teks = sisa.pop(0)
        for i in range(0, len(teks), 20):
            if on_token:
                on_token(teks[i:i + 20])
        return teks

    return chat


def test_stream_rps_mengirim_tahap_token_dan_hasil(client, monkeypatch):
    monkeypatch.setattr(rag_chain, "chat", _chat_bertahap([json.dumps(RPS_VALID)]))
    resp = client.post("/api/v1/rps/stream", json={
        "mk_name": "Basis Data", "sks": 3, "semester": "Ganjil", "prodi": "Teknik Komputer",
    })
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")

    events = _baca_sse(resp.text)
    jenis = [e for e, _ in events]
    assert jenis[0] == "tahap" and events[0][1] == {"id": "konteks", "status": "mulai"}
    assert ("sumber", {"sumber": [{"file": "Pedoman.pdf", "page": 12, "snippet": "CPL prodi"}]}) in events
    assert "token" in jenis
    teks = "".join(d["teks"] for e, d in events if e == "token")
    assert json.loads(teks)["kode_mk"] == "TKK1234"
    tahap_web = [d for e, d in events if e == "tahap" and d["id"] == "web" and d["status"] == "selesai"]
    assert "pedoman lokal" in tahap_web[0]["detail"]
    assert jenis[-1] == "hasil"
    assert events[-1][1]["success"] is True
    assert events[-1][1]["sumber_dokumen"][0]["file"] == "Pedoman.pdf"


def test_stream_rps_mengirim_ulang_saat_validasi_gagal(client, monkeypatch):
    salah = dict(RPS_VALID, pertemuan=RPS_VALID["pertemuan"][:10])
    monkeypatch.setattr(rag_chain, "chat", _chat_bertahap([json.dumps(salah), json.dumps(RPS_VALID)]))
    resp = client.post("/api/v1/rps/stream", json={
        "mk_name": "Basis Data", "sks": 3, "semester": "Ganjil", "prodi": "Teknik Komputer",
    })
    events = _baca_sse(resp.text)
    ulang = [d for e, d in events if e == "ulang"]
    assert len(ulang) == 1 and ulang[0]["percobaan"] == 2 and ulang[0]["pelanggaran"]
    menulis = [d for e, d in events if e == "tahap" and d["id"] == "menulis" and d["status"] == "mulai"]
    assert [m["percobaan"] for m in menulis] == [1, 2]
    assert "memperbaiki" in menulis[1]["detail"]
    assert events[-1][1]["success"] is True


def test_stream_narasi_gagal_tetap_ditutup_event_hasil(client, monkeypatch):
    def chat_gagal(**kwargs):
        from sadewa_ai.llm_client import LLMError
        raise LLMError("API key ditolak.")

    monkeypatch.setattr(rag_chain, "chat", chat_gagal)
    resp = client.post("/api/v1/narasi/stream", json={
        "mk_name": "Basis Data", "prodi": "Teknik Komputer", "semester": "Ganjil",
        "tahun_ajaran": "2025/2026", "capaian": [{"kode": "CPL 1", "nilai_rata_rata": 70}],
    })
    events = _baca_sse(resp.text)
    assert events[-1][0] == "hasil"
    assert events[-1][1]["success"] is False
    assert "API key" in events[-1][1]["error"]


def test_stream_rps_input_tidak_valid(client):
    resp = client.post("/api/v1/rps/stream", json={
        "mk_name": "Basis Data", "sks": 3, "semester": "Pendek", "prodi": "TK",
    })
    # Validasi pydantic di level FastAPI menolak sebelum stream dimulai.
    assert resp.status_code == 422
