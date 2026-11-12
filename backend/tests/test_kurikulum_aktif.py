"""Kurikulum aktif prodi: ditetapkan Admin Prodi, dipakai seluruh Analitik OBE tingkat prodi."""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import CPL, MataKuliah
from app.models.cpl_achievement import CPLAchievement
from app.models.enums import SemesterEnum, StatusKurikulum
from app.models.kurikulum_version import KurikulumVersion
from tests.test_ui_audit_fixes import audit_data, auth_header, db_session  # noqa: F401 (fixtures)


def _dua_kurikulum(db_session: Session, audit_data: dict) -> dict:
    """kur_a (2025, published) + kur_baru (2026, published) dengan CPL & MK masing-masing."""
    prodi = audit_data["prodi_a"]
    kur_baru = KurikulumVersion(program_studi_id=prodi.id, version_label="2026-IF", status=StatusKurikulum.published)
    draf = KurikulumVersion(program_studi_id=prodi.id, version_label="2027-IF", status=StatusKurikulum.draft)
    db_session.add_all([kur_baru, draf])
    db_session.flush()
    cpl_lama = CPL(kurikulum_version_id=audit_data["kur_a"].id, program_studi_id=prodi.id, kode="CPL-L", deskripsi="Lama", threshold_capaian=70)
    cpl_baru = CPL(kurikulum_version_id=kur_baru.id, program_studi_id=prodi.id, kode="CPL-B", deskripsi="Baru", threshold_capaian=70)
    mk_baru = MataKuliah(
        kurikulum_version_id=kur_baru.id, kode="IF201", nama="Basis Data", sks=3,
        semester=SemesterEnum.ganjil, tahun_ajaran="2026/2027", program_studi_id=prodi.id,
    )
    db_session.add_all([cpl_lama, cpl_baru, mk_baru])
    db_session.flush()
    mhs = audit_data["mhs_a"]
    db_session.add_all([
        CPLAchievement(mahasiswa_id=mhs.id, cpl_id=cpl_lama.id, mata_kuliah_id=audit_data["mk_a"].id, nilai=80, bobot_cp=10, angkatan=2024, semester=SemesterEnum.ganjil),
        CPLAchievement(mahasiswa_id=mhs.id, cpl_id=cpl_baru.id, mata_kuliah_id=mk_baru.id, nilai=90, bobot_cp=10, angkatan=2024, semester=SemesterEnum.ganjil),
    ])
    db_session.commit()
    return {"kur_baru": kur_baru, "draf": draf, "cpl_lama": cpl_lama, "cpl_baru": cpl_baru, "mk_baru": mk_baru}


def test_admin_prodi_menetapkan_kurikulum_aktif(client: TestClient, audit_data: dict, db_session: Session):
    d = _dua_kurikulum(db_session, audit_data)
    admin = auth_header(audit_data["admin_a"])

    # Draf tidak boleh diaktifkan; hanya Admin Prodi; tidak boleh lintas prodi
    assert client.post(f"/api/v1/kurikulum/versions/{d['draf'].id}/aktifkan", headers=admin).status_code == 400
    assert client.post(f"/api/v1/kurikulum/versions/{d['kur_baru'].id}/aktifkan", headers=auth_header(audit_data["kaprodi_a"])).status_code == 403
    assert client.post(f"/api/v1/kurikulum/versions/{audit_data['kur_b'].id}/aktifkan", headers=admin).status_code == 403

    res = client.post(f"/api/v1/kurikulum/versions/{audit_data['kur_a'].id}/aktifkan", headers=admin)
    assert res.status_code == 200, res.text
    assert res.json()["is_aktif"] is True and res.json()["aktif_ditetapkan"] is True

    versi = {v["id"]: v for v in client.get("/api/v1/kurikulum/versions", headers=admin).json()}
    assert versi[audit_data["kur_a"].id]["is_aktif"] is True
    assert versi[d["kur_baru"].id]["is_aktif"] is False

    for key in ("kaprodi_a", "dosen_a"):
        aktif = client.get("/api/v1/kurikulum/versions/aktif", headers=auth_header(audit_data[key])).json()
        assert aktif["kurikulum"]["id"] == audit_data["kur_a"].id and aktif["ditetapkan"] is True
    dekan = auth_header(audit_data["dekan"])
    assert client.get("/api/v1/kurikulum/versions/aktif", headers=dekan).status_code == 400
    aktif = client.get("/api/v1/kurikulum/versions/aktif", params={"program_studi_id": audit_data["prodi_a"].id}, headers=dekan).json()
    assert aktif["kurikulum"]["id"] == audit_data["kur_a"].id


def test_analitik_hanya_memakai_kurikulum_aktif(client: TestClient, audit_data: dict, db_session: Session):
    d = _dua_kurikulum(db_session, audit_data)
    admin = auth_header(audit_data["admin_a"])
    kaprodi = auth_header(audit_data["kaprodi_a"])

    def cpl_analitik():
        data = client.get("/api/v1/analitik/prodi", headers=kaprodi).json()
        return {c["kode"] for c in data["cpl"]}, data["kurikulum_aktif"]

    # Belum ditetapkan: versi published terbaru (2026), ditandai belum ditetapkan
    kode, info = cpl_analitik()
    assert kode == {"CPL-B"} and info["ditetapkan"] is False

    # Admin menetapkan 2025 -> hanya CPL 2025
    client.post(f"/api/v1/kurikulum/versions/{audit_data['kur_a'].id}/aktifkan", headers=admin)
    kode, info = cpl_analitik()
    assert kode == {"CPL-L"} and info == {"id": audit_data["kur_a"].id, "label": "2025-IF", "tahun": None, "ditetapkan": True}

    overview = client.get("/api/v1/dashboard/cpl-overview", headers=kaprodi).json()
    assert {c["kode"] for c in overview} == {"CPL-L"}
    trend = client.get("/api/v1/trending/cpl-by-angkatan", headers=kaprodi).json()
    assert {t["cpl_kode"] for t in trend} == {"CPL-L"}

    # Analitik per mahasiswa: MK dari kurikulum lain di luar cakupan
    res = client.get("/api/v1/analitik/mahasiswa", params={"mata_kuliah_id": d["mk_baru"].id}, headers=kaprodi)
    assert res.status_code == 403
    assert client.get("/api/v1/analitik/mahasiswa", params={"mata_kuliah_id": audit_data["mk_a"].id}, headers=kaprodi).status_code == 200
