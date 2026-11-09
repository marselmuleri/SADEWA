"""
Uji endpoint generate versi streaming (Server-Sent Events):
POST /api/v1/rps/{mk_id}/generate/stream dan POST /api/v1/narasi/generate/{mk_id}/stream.

AI Service tidak dijalankan: ai_client.stream_rps / stream_narasi diganti generator tiruan,
dan ai_client.stream_ai diuji terpisah dengan httpx.MockTransport.
"""

import json

import httpx
import pytest
from fastapi import HTTPException

from app.core.security import create_access_token
from app.models.enums import SemesterEnum, UserRole
from app.models.fakultas import Fakultas
from app.models.kurikulum_version import KurikulumVersion
from app.models.mata_kuliah import MataKuliah
from app.models.narasi_evaluasi import NarasiEvaluasi
from app.models.program_studi import ProgramStudi
from app.models.rps import RPS
from app.models.user import User
from app.services import ai_client, capaian_service
from tests.conftest import TestingSessionLocal


def _baca_sse(teks: str):
    events = []
    for blok in teks.strip().split("\n\n"):
        jenis, data = None, None
        for baris in blok.splitlines():
            if baris.startswith("event: "):
                jenis = baris[7:]
            elif baris.startswith("data: "):
                data = json.loads(baris[6:])
        events.append((jenis, data))
    return events


@pytest.fixture
def mk_dan_header():
    db = TestingSessionLocal()
    try:
        fak = Fakultas(nama="Fakultas Teknik", kode="FT")
        db.add(fak)
        db.commit()
        prodi = ProgramStudi(nama="Teknik Komputer", kode="TK", fakultas_id=fak.id)
        db.add(prodi)
        db.commit()
        kur = KurikulumVersion(version_label="Kurikulum 2024", program_studi_id=prodi.id, status="published")
        db.add(kur)
        db.commit()
        mk = MataKuliah(
            kurikulum_version_id=kur.id, kode="TK104", nama="Sistem Operasi", sks=3,
            semester=SemesterEnum.ganjil, program_studi_id=prodi.id, tahun_ajaran="2025/2026",
        )
        user = User(
            nama="Admin Prodi TK", email="admin.stream@undip.ac.id", password_hash="x",
            role=UserRole.admin_prodi, program_studi_id=prodi.id, is_active=True,
        )
        db.add_all([mk, user])
        db.commit()
        token = create_access_token({"sub": user.email, "role": user.role.value})
        return mk.id, {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


def _generator(events):
    async def gen(**kwargs):
        for e in events:
            if isinstance(e, Exception):
                raise e
            yield e
    return gen


def test_stream_rps_meneruskan_progres_dan_menyimpan_draf(client, mk_dan_header, monkeypatch):
    mk_id, headers = mk_dan_header
    hasil_ai = {
        "success": True,
        "data": {"kode_mk": "TK104", "pertemuan": [{"minggu": 1, "materi": "Pengenalan OS", "bobot": 5}]},
        "warnings": [],
        "sumber_dokumen": [{"file": "Pedoman.pdf", "page": 3, "snippet": "..."}],
    }
    monkeypatch.setattr(ai_client, "stream_rps", _generator([
        ("tahap", {"id": "konteks", "status": "mulai"}),
        ("sumber", {"sumber": hasil_ai["sumber_dokumen"]}),
        ("token", {"teks": '{"kode_mk": "TK104"'}),
        ("hasil", hasil_ai),
    ]))

    resp = client.post(
        f"/api/v1/rps/{mk_id}/generate/stream",
        json={"tahun_ajaran": "2025/2026", "semester": "Ganjil", "topik": "Cloud"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    events = _baca_sse(resp.text)
    jenis = [e for e, _ in events]

    assert jenis[0] == "mulai"
    assert events[0][1]["mata_kuliah"]["kode"] == "TK104"
    assert events[0][1]["topik"] == "Cloud"
    assert ["tahap", "sumber", "token"] == jenis[1:4]
    assert "hasil" not in jenis  # hasil mentah AI tidak diteruskan, diganti record tersimpan
    assert jenis[-1] == "selesai"
    selesai = events[-1][1]
    assert selesai["konten"]["kode_mk"] == "TK104"
    assert selesai["sumber_dokumen_rag"][0]["file"] == "Pedoman.pdf"

    db = TestingSessionLocal()
    try:
        tersimpan = db.query(RPS).filter(RPS.id == selesai["id"]).first()
        assert tersimpan is not None and tersimpan.status == "draft"
    finally:
        db.close()


def test_stream_rps_gagal_dikirim_sebagai_event_error(client, mk_dan_header, monkeypatch):
    mk_id, headers = mk_dan_header
    monkeypatch.setattr(ai_client, "stream_rps", _generator([
        ("tahap", {"id": "konteks", "status": "mulai"}),
        HTTPException(status_code=503, detail="AI Service tidak dapat dihubungi."),
    ]))
    resp = client.post(
        f"/api/v1/rps/{mk_id}/generate/stream",
        json={"tahun_ajaran": "2025/2026", "semester": "Ganjil"},
        headers=headers,
    )
    events = _baca_sse(resp.text)
    assert events[-1] == ("error", {"pesan": "AI Service tidak dapat dihubungi.", "status": 503})
    db = TestingSessionLocal()
    try:
        assert db.query(RPS).count() == 0
    finally:
        db.close()


def test_stream_rps_tanpa_akses_tetap_403_biasa(client, mk_dan_header):
    mk_id, _ = mk_dan_header
    resp = client.post(f"/api/v1/rps/{mk_id}/generate/stream", json={"tahun_ajaran": "2025/2026", "semester": "Ganjil"})
    assert resp.status_code in (401, 403)


def test_stream_narasi_mengirim_data_capaian_dan_menyimpan(client, mk_dan_header, monkeypatch):
    mk_id, headers = mk_dan_header
    capaian = [{"kode": "CPMK-1", "deskripsi": "x", "nilai_rata_rata": 64.2, "jumlah_mahasiswa": 40, "jumlah_tercapai": 18}]
    monkeypatch.setattr(capaian_service, "get_capaian_mata_kuliah", lambda db, mid: capaian)
    monkeypatch.setattr(ai_client, "stream_narasi", _generator([
        ("tahap", {"id": "menulis", "status": "mulai", "percobaan": 1}),
        ("token", {"teks": '{"ringkasan_capaian": "Capaian'}),
        ("hasil", {"success": True, "data": {"ringkasan_capaian": "Capaian cukup."}, "warnings": []}),
    ]))
    resp = client.post(f"/api/v1/narasi/generate/{mk_id}/stream", json={"tipe": "rekomendasi_umum"}, headers=headers)
    events = _baca_sse(resp.text)
    assert events[0][0] == "mulai"
    assert events[0][1]["capaian"] == capaian
    assert events[-1][0] == "selesai"
    assert json.loads(events[-1][1]["konten"])["ringkasan_capaian"] == "Capaian cukup."
    db = TestingSessionLocal()
    try:
        assert db.query(NarasiEvaluasi).count() == 1
    finally:
        db.close()


def test_stream_narasi_tanpa_capaian_422_sebelum_stream(client, mk_dan_header, monkeypatch):
    mk_id, headers = mk_dan_header
    monkeypatch.setattr(capaian_service, "get_capaian_mata_kuliah", lambda db, mid: [])
    resp = client.post(f"/api/v1/narasi/generate/{mk_id}/stream", json={"tipe": "rekomendasi_umum"}, headers=headers)
    assert resp.status_code == 422


# --- ai_client.stream_ai -------------------------------------------------------


def _pasang_transport(monkeypatch, handler):
    asli = httpx.AsyncClient

    def buat(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return asli(*args, **kwargs)

    monkeypatch.setattr(ai_client.httpx, "AsyncClient", buat)


@pytest.mark.anyio
async def test_stream_ai_mengurai_sse(monkeypatch):
    badan = (
        'event: tahap\ndata: {"id": "konteks", "status": "mulai"}\n\n'
        'event: token\ndata: {"teks": "{\\"a\\""}\n\n'
        'event: hasil\ndata: {"success": true, "data": {"a": 1}}\n\n'
    )
    _pasang_transport(monkeypatch, lambda req: httpx.Response(200, text=badan, headers={"content-type": "text/event-stream"}))
    events = [e async for e in ai_client.stream_ai("/api/v1/rps/stream", {})]
    assert events == [
        ("tahap", {"id": "konteks", "status": "mulai"}),
        ("token", {"teks": '{"a"'}),
        ("hasil", {"success": True, "data": {"a": 1}}),
    ]


@pytest.mark.anyio
async def test_stream_ai_hasil_gagal_menjadi_http_exception(monkeypatch):
    badan = 'event: hasil\ndata: {"success": false, "error": "Folder vectorstore tidak ditemukan"}\n\n'
    _pasang_transport(monkeypatch, lambda req: httpx.Response(200, text=badan))
    with pytest.raises(HTTPException) as exc:
        [e async for e in ai_client.stream_ai("/api/v1/rps/stream", {})]
    assert exc.value.status_code == 503


@pytest.mark.anyio
async def test_stream_ai_terputus_tanpa_hasil(monkeypatch):
    badan = 'event: tahap\ndata: {"id": "konteks", "status": "mulai"}\n\n'
    _pasang_transport(monkeypatch, lambda req: httpx.Response(200, text=badan))
    with pytest.raises(HTTPException) as exc:
        [e async for e in ai_client.stream_ai("/api/v1/rps/stream", {})]
    assert exc.value.status_code == 502


@pytest.mark.anyio
async def test_stream_ai_tidak_bisa_terhubung(monkeypatch):
    def gagal(req):
        raise httpx.ConnectError("refused")

    _pasang_transport(monkeypatch, gagal)
    with pytest.raises(HTTPException) as exc:
        [e async for e in ai_client.stream_ai("/api/v1/rps/stream", {})]
    assert exc.value.status_code == 503
