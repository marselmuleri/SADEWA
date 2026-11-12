"""Regresi temuan audit: snapshot nilai final, validasi run, scope hasil & dosen, error handler, batch."""
import asyncio
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from app.models.hasil_evaluasi import HasilEvaluasi
from app.models.user import User
from tests.test_portofolio_export import obe  # noqa: F401 (fixture)
from tests.test_ui_audit_fixes import audit_data, auth_header, db_session  # noqa: F401 (fixtures)


def test_run_ditolak_bila_bobot_belum_lengkap(client: TestClient, audit_data: dict):
    # mk_a pada fixture dasar belum punya CPMK maupun bentuk penilaian berbobot 100
    res = client.post(f"/api/v1/kalkulasi/run/{audit_data['mk_a'].id}", headers=auth_header(audit_data["dosen_a"]))
    assert res.status_code == 400
    assert "belum siap dinilai" in res.json()["detail"]


def test_nilai_final_tidak_ditimpa_kalkulasi_ulang(client: TestClient, obe: dict, db_session: Session):
    h = auth_header(obe["dosen_a"])
    hasil = db_session.query(HasilEvaluasi).order_by(HasilEvaluasi.id).first()
    res = client.post(f"/api/v1/kalkulasi/peserta/{hasil.peserta_mata_kuliah_id}/finalize", headers=h)
    assert res.status_code == 200, res.text

    # Simulasikan snapshot lama yang berbeda dari hasil hitung sekarang (mis. skala huruf sudah diubah)
    db_session.expire_all()
    hasil = db_session.get(HasilEvaluasi, hasil.id)
    hasil.nilai_akhir, hasil.nilai_huruf = Decimal("12.34"), "Z"
    db_session.commit()

    res = client.post(f"/api/v1/kalkulasi/run/{obe['mk'].id}", headers=h)
    assert res.status_code == 200, res.text
    assert res.json()["jumlah_nilai_final_dilewati"] == 1
    db_session.expire_all()
    hasil = db_session.get(HasilEvaluasi, hasil.id)
    assert (float(hasil.nilai_akhir), hasil.nilai_huruf, hasil.is_final) == (12.34, "Z", True)


def test_detail_hasil_dibatasi_scope(client: TestClient, obe: dict, db_session: Session):
    hasil = db_session.query(HasilEvaluasi).order_by(HasilEvaluasi.id).first()
    url = f"/api/v1/kalkulasi/hasil/{hasil.id}"
    assert client.get(url, headers=auth_header(obe["dosen_a"])).status_code == 200
    assert client.get(url, headers=auth_header(obe["kaprodi_a"])).status_code == 200
    assert client.get(url, headers=auth_header(obe["dekan"])).status_code == 200
    assert client.get(url, headers=auth_header(obe["dosen_b"])).status_code == 403  # prodi lain


def test_dosen_tanpa_prodi_tidak_melihat_data_semua_prodi(client: TestClient, audit_data: dict, db_session: Session):
    dosen = User(nama="Dosen Lepas", email="lepas@test.com", password_hash="x", role=UserRole.dosen, is_active=True)
    db_session.add(dosen)
    db_session.commit()
    for url in ("/api/v1/mahasiswa", "/api/v1/kurikulum/versions", "/api/v1/mata-kuliah"):
        res = client.get(url, headers=auth_header(dosen))
        assert res.status_code == 400, (url, res.status_code, res.text)


def test_error_internal_tidak_dikirim_ke_client():
    from app.main import global_exception_handler

    res = asyncio.run(global_exception_handler(None, RuntimeError("SELECT password_hash FROM users /srv/app")))
    assert res.status_code == 500
    assert b"password_hash" not in res.body and b"/srv/app" not in res.body


def test_batch_memperbarui_mahasiswa_lama(client: TestClient, audit_data: dict):
    h = auth_header(audit_data["admin_a"])
    rec = {"nim": "2301099", "nama": "Batch Ulang", "semester_aktif": 1, "status_masuk": "Reguler"}
    res = client.post("/api/v1/mahasiswa/batch", json={"records": [rec]}, headers=h)
    assert res.status_code == 200 and res.headers["X-Jumlah-Ditambah"] == "1"

    res = client.post("/api/v1/mahasiswa/batch", json={"records": [{**rec, "semester_aktif": 3, "status_akademik": "Cuti"}]}, headers=h)
    assert res.status_code == 200 and res.json() == []
    assert (res.headers["X-Jumlah-Diperbarui"], res.headers["X-Jumlah-Dilewati"]) == ("1", "0")
    mhs = [m for m in client.get("/api/v1/mahasiswa", headers=h).json() if m["nim"] == "2301099"][0]
    assert (mhs["semester_aktif"], mhs["status_akademik"]) == (3, "Cuti")

    res = client.post("/api/v1/mahasiswa/batch", json={"records": [{**rec, "semester_aktif": 3, "status_akademik": "Cuti"}]}, headers=h)
    assert (res.headers["X-Jumlah-Diperbarui"], res.headers["X-Jumlah-Dilewati"]) == ("0", "1")
