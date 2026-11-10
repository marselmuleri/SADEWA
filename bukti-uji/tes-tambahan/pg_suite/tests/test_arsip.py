from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import CPL, CPMK, IK, CPMKIKMap, User
from app.models.enums import UserRole
from tests.test_ui_audit_fixes import audit_data, auth_header, db_session  # noqa: F401 (fixtures)


def _setup_struktur(db_session: Session, audit_data: dict):
    cpl = CPL(kurikulum_version_id=audit_data["kur_a"].id, kode="CPL-01", deskripsi="Awal", program_studi_id=audit_data["prodi_a"].id)
    db_session.add(cpl)
    db_session.flush()
    ik = IK(cpl_id=cpl.id, kode="IK-01.1", deskripsi="Indikator")
    cpmk = CPMK(mata_kuliah_id=audit_data["mk_a"].id, kode="CPMK-1", deskripsi="Algoritma dasar", bobot=100)
    db_session.add_all([ik, cpmk])
    db_session.flush()
    db_session.add(CPMKIKMap(cpmk_id=cpmk.id, ik_id=ik.id, bobot=100))
    db_session.commit()
    return cpl


def test_publish_membuat_arsip_dan_koreksi_tidak_mengubahnya(client: TestClient, audit_data: dict, db_session: Session):
    admin = audit_data["admin_a"]
    h = auth_header(admin)
    kur = audit_data["kur_a"]
    cpl = _setup_struktur(db_session, audit_data)

    assert client.post(f"/api/v1/kurikulum/versions/{kur.id}/publish", headers=h).status_code == 200

    arsip_list = client.get("/api/v1/arsip", headers=h).json()
    assert len(arsip_list) == 1
    ringkas = arsip_list[0]
    assert ringkas["jenis"] == "publish_kurikulum"
    assert ringkas["kurikulum_version_id"] == kur.id
    assert ringkas["ringkasan"] == {"mata_kuliah": 1, "cpmk": 1, "cpl": 1, "ik": 1}
    assert ringkas["dibuat_oleh_nama"] == admin.nama

    # Koreksi salah input setelah publish: Data Current berubah, arsip tetap
    assert client.put(f"/api/v1/cpl/{cpl.id}", json={"deskripsi": "Sudah dikoreksi"}, headers=h).status_code == 200
    detail = client.get(f"/api/v1/arsip/{ringkas['id']}", headers=h).json()
    assert detail["data"]["cpl"][0]["deskripsi"] == "Awal"
    assert detail["data"]["cpl"][0]["ik"][0]["kode"] == "IK-01.1"
    mk = detail["data"]["mata_kuliah"][0]
    assert mk["kode"] == "IF101"
    assert mk["cpmk"][0]["pemetaan_ik"] == [{"ik_kode": "IK-01.1", "bobot": "100"}]

    # Publish ulang tidak menggandakan arsip
    assert client.post(f"/api/v1/kurikulum/versions/{kur.id}/publish", headers=h).status_code == 200
    assert len(client.get("/api/v1/arsip", headers=h).json()) == 1


def test_arsip_semester(client: TestClient, audit_data: dict, db_session: Session):
    admin = audit_data["admin_a"]
    h = auth_header(admin)
    _setup_struktur(db_session, audit_data)
    payload = {"semester": "Ganjil", "tahun_ajaran": "2025/2026"}

    # Hanya Admin Prodi
    assert client.post("/api/v1/arsip/semester", json=payload, headers=auth_header(audit_data["kaprodi_a"])).status_code == 403

    res = client.post("/api/v1/arsip/semester", json=payload, headers=h)
    assert res.status_code == 200, res.text
    arsip = res.json()
    assert arsip["jenis"] == "tutup_semester"
    assert arsip["judul"] == "Semester Ganjil 2025/2026"

    detail = client.get(f"/api/v1/arsip/{arsip['id']}", headers=h).json()
    mk = detail["data"]["mata_kuliah"][0]
    assert mk["kode"] == "IF101"
    assert mk["pengampu"] == [{"nama": "Dosen A", "koordinator": True}]
    assert mk["cpmk"][0]["kode"] == "CPMK-1"

    # Tidak bisa dua kali untuk semester yang sama
    assert client.post("/api/v1/arsip/semester", json=payload, headers=h).status_code == 409
    # Semester tanpa mata kuliah ditolak
    assert client.post("/api/v1/arsip/semester", json={"semester": "Genap", "tahun_ajaran": "2025/2026"}, headers=h).status_code == 400


def test_akses_arsip_per_role(client: TestClient, audit_data: dict, db_session: Session):
    _setup_struktur(db_session, audit_data)
    client.post(f"/api/v1/kurikulum/versions/{audit_data['kur_a'].id}/publish", headers=auth_header(audit_data["admin_a"]))

    for key in ("admin_a", "dosen_a", "kaprodi_a"):
        assert len(client.get("/api/v1/arsip", headers=auth_header(audit_data[key])).json()) == 1
    dekan = auth_header(audit_data["dekan"])
    assert len(client.get("/api/v1/arsip", params={"program_studi_id": audit_data["prodi_a"].id}, headers=dekan).json()) == 1

    # Prodi lain tidak melihat arsip prodi A, termasuk lewat id langsung
    h_b = auth_header(audit_data["dosen_b"])
    assert client.get("/api/v1/arsip", headers=h_b).json() == []
    arsip_id = client.get("/api/v1/arsip", headers=auth_header(audit_data["admin_a"])).json()[0]["id"]
    assert client.get(f"/api/v1/arsip/{arsip_id}", headers=h_b).status_code == 404

    sa = User(nama="SA", email="sa_arsip@test.com", password_hash="x", role=UserRole.super_admin, is_active=True)
    db_session.add(sa)
    db_session.commit()
    assert client.get("/api/v1/arsip", headers=auth_header(sa)).status_code == 403
