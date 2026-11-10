import json
import pytest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
import httpx

from app.services import ai_client, capaian_service
from app.models.mata_kuliah import MataKuliah
from app.models.program_studi import ProgramStudi
from app.models.fakultas import Fakultas
from app.models.kurikulum_version import KurikulumVersion
from app.models.user import User
from app.models.enums import UserRole, SemesterEnum
from app.core.security import create_access_token
from tests.conftest import TestingSessionLocal


def _auth_headers(user: User) -> dict:
    token = create_access_token({"sub": user.email, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.anyio
async def test_ai_client_health_offline():
    """Saat AI Service mati, check_health() mengembalikan status unhealthy tanpa crash."""
    with patch("httpx.AsyncClient.get", side_effect=httpx.ConnectError("Connection refused")):
        res = await ai_client.check_health()
        assert res["status"] == "unhealthy"
        assert "AI Service" in res["detail"]


@pytest.mark.anyio
async def test_ai_client_generate_rps_success():
    """Panggilan HTTP ke AI Service untuk RPS mengembalikan data terstruktur."""
    mock_response = httpx.Response(
        200,
        json={
            "success": True,
            "data": {"kode_mk": "KOMP101", "pertemuan": []},
            "duration_seconds": 1.5,
        },
        request=httpx.Request("POST", "http://localhost:8001/api/v1/rps"),
    )

    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_response)):
        res = await ai_client.generate_rps(
            mk_name="Jaringan Komputer",
            sks=3,
            semester="Ganjil",
            prodi="Teknik Komputer",
        )
        assert res["success"] is True
        assert res["data"]["kode_mk"] == "KOMP101"


@pytest.mark.anyio
async def test_ai_client_connection_error_raises_503():
    """Saat AI Service mati / port 8001 tidak aktif, raise HTTP 503."""
    with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("Connection refused")):
        with pytest.raises(HTTPException) as exc_info:
            await ai_client.generate_rps(
                mk_name="Jaringan Komputer",
                sks=3,
                semester="Ganjil",
                prodi="Teknik Komputer",
            )
        assert exc_info.value.status_code == 503
        assert "8001" in exc_info.value.detail


@pytest.mark.anyio
async def test_ai_client_timeout_raises_504():
    """Saat AI Service timeout, raise HTTP 504."""
    with patch("httpx.AsyncClient.post", side_effect=httpx.ReadTimeout("Timeout reading")):
        with pytest.raises(HTTPException) as exc_info:
            await ai_client.generate_rps(
                mk_name="Jaringan Komputer",
                sks=3,
                semester="Ganjil",
                prodi="Teknik Komputer",
            )
        assert exc_info.value.status_code == 504
        assert "timeout" in exc_info.value.detail.lower() or "batas waktu" in exc_info.value.detail.lower()


def test_narasi_empty_calculation_raises_422(client):
    """PRD Wajib: Endpoint narasi wajib menolak dengan HTTP 422 jika mata kuliah belum ada nilai/kalkulasi."""
    db = TestingSessionLocal()
    try:
        fak = Fakultas(nama="Fakultas Teknik", kode="FT")
        db.add(fak)
        db.commit()
        db.refresh(fak)

        prodi = ProgramStudi(nama="Teknik Komputer", kode="TK", fakultas_id=fak.id)
        db.add(prodi)
        db.commit()
        db.refresh(prodi)

        kur = KurikulumVersion(version_label="Kurikulum 2024", program_studi_id=prodi.id, status="published")
        db.add(kur)
        db.commit()
        db.refresh(kur)

        mk = MataKuliah(
            kurikulum_version_id=kur.id,
            kode="TK103",
            nama="Basis Data",
            sks=3,
            semester=SemesterEnum.ganjil,
            program_studi_id=prodi.id,
            tahun_ajaran="2025/2026",
        )
        db.add(mk)

        user = User(
            nama="Admin Prodi TK",
            email="admin.tk@undip.ac.id",
            password_hash="fakehash",
            role=UserRole.admin_prodi,
            program_studi_id=prodi.id,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(mk)
        db.refresh(user)

        mk_id = mk.id
        headers = _auth_headers(user)
    finally:
        db.close()

    # Request tanpa data capaian di DB dan tanpa payload.capaian -> WAJIB 422
    resp = client.post(
        f"/api/v1/narasi/generate/{mk_id}",
        json={"tipe": "rekomendasi_umum"},
        headers=headers,
    )
    assert resp.status_code == 422
    assert "belum memiliki data nilai" in resp.json()["detail"]


def test_rps_generate_prd_path_saves_konten(client):
    """PRD Wajib: Endpoint POST /api/v1/rps/{mata_kuliah_id}/generate menyimpan ke rps.konten."""
    db = TestingSessionLocal()
    try:
        fak = Fakultas(nama="Fakultas Teknik", kode="FT")
        db.add(fak)
        db.commit()
        db.refresh(fak)

        prodi = ProgramStudi(nama="Teknik Komputer", kode="TK", fakultas_id=fak.id)
        db.add(prodi)
        db.commit()
        db.refresh(prodi)

        kur = KurikulumVersion(version_label="Kurikulum 2024", program_studi_id=prodi.id, status="published")
        db.add(kur)
        db.commit()
        db.refresh(kur)

        mk = MataKuliah(
            kurikulum_version_id=kur.id,
            kode="TK104",
            nama="Sistem Operasi",
            sks=3,
            semester=SemesterEnum.ganjil,
            program_studi_id=prodi.id,
            tahun_ajaran="2025/2026",
        )
        db.add(mk)

        user = User(
            nama="Admin Prodi TK",
            email="admin.tk2@undip.ac.id",
            password_hash="fakehash",
            role=UserRole.admin_prodi,
            program_studi_id=prodi.id,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(mk)
        db.refresh(user)

        mk_id = mk.id
        headers = _auth_headers(user)
    finally:
        db.close()

    mock_ai_rps = {
        "success": True,
        "data": {
            "kode_mk": "TK104",
            "pertemuan": [{"minggu": 1, "materi": "Pengenalan OS", "bobot": 5}],
        },
        "duration_seconds": 1.8,
    }

    with patch("app.services.ai_client.generate_rps", new=AsyncMock(return_value=mock_ai_rps)):
        resp = client.post(
            f"/api/v1/rps/{mk_id}/generate",
            json={
                "tahun_ajaran": "2025/2026",
                "semester": "Ganjil",
                "topik": "Sistem Operasi Modern",
            },
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mata_kuliah_id"] == mk_id
        assert data["status"] == "draft"
        assert data["konten"]["kode_mk"] == "TK104"

