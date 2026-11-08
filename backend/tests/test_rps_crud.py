from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.rps import RPS
from app.models.enums import SemesterEnum
from tests.test_ui_audit_fixes import audit_data, auth_header, db_session  # noqa: F401 (fixtures)

KONTEN = {
    "kode_mk": "IF101",
    "deskripsi_mk": "Draf AI",
    "cpl": [{"kode": "CPL-01", "deskripsi": "x"}],
    "cpmk": [{"kode": "CPMK-1", "deskripsi": "y"}],
    "pertemuan": [{"minggu": 1, "cpmk": "CPMK-1", "sub_cpmk": "a", "materi": "b", "metode": "c", "bobot": 100}],
}


def _rps(db_session: Session, audit_data: dict) -> RPS:
    rps = RPS(mata_kuliah_id=audit_data["mk_a"].id, tahun_ajaran="2025/2026", semester=SemesterEnum.ganjil,
              status="draft", konten=KONTEN, created_by=audit_data["dosen_a"].id)
    db_session.add(rps)
    db_session.commit()
    return rps


def test_dosen_pengampu_edit_dan_hapus_rps(client: TestClient, audit_data: dict, db_session: Session):
    rps = _rps(db_session, audit_data)
    h = auth_header(audit_data["dosen_a"])

    baru = {**KONTEN, "deskripsi_mk": "Sudah diedit dosen"}
    res = client.put(f"/api/v1/rps/{rps.id}", json={"konten": baru, "tahun_ajaran": "2026/2027", "semester": "Genap"}, headers=h)
    assert res.status_code == 200, res.text
    assert res.json()["konten"]["deskripsi_mk"] == "Sudah diedit dosen"
    assert res.json()["tahun_ajaran"] == "2026/2027"
    assert res.json()["semester"] == "Genap"

    assert client.get(f"/api/v1/rps/{audit_data['mk_a'].id}", headers=h).json()[0]["konten"]["deskripsi_mk"] == "Sudah diedit dosen"

    assert client.delete(f"/api/v1/rps/{rps.id}", headers=h).status_code == 200
    assert client.get(f"/api/v1/rps/{audit_data['mk_a'].id}", headers=h).json() == []
    assert client.delete(f"/api/v1/rps/{rps.id}", headers=h).status_code == 404


def test_rps_hanya_bisa_diubah_pengampu(client: TestClient, audit_data: dict, db_session: Session):
    rps = _rps(db_session, audit_data)
    for key in ("dosen_b", "kaprodi_a"):
        h = auth_header(audit_data[key])
        assert client.put(f"/api/v1/rps/{rps.id}", json={"konten": KONTEN}, headers=h).status_code == 403
        assert client.delete(f"/api/v1/rps/{rps.id}", headers=h).status_code == 403


def test_buat_laporan_dengan_isi_narasi(client: TestClient, audit_data: dict):
    h = auth_header(audit_data["dosen_a"])
    res = client.post(f"/api/v1/laporan/generate/{audit_data['mk_a'].id}",
                      json={"semester": "Ganjil", "konten": "RINGKASAN CAPAIAN\nIsi narasi"}, headers=h)
    assert res.status_code == 200, res.text
    assert res.json()["konten"] == "RINGKASAN CAPAIAN\nIsi narasi"
    assert res.json()["status"] == "draft"

    # Tanpa konten tetap boleh (draf kosong seperti sebelumnya)
    kosong = client.post(f"/api/v1/laporan/generate/{audit_data['mk_a'].id}", json={"semester": "Ganjil"}, headers=h)
    assert kosong.status_code == 200
    assert kosong.json()["konten"] == ""
