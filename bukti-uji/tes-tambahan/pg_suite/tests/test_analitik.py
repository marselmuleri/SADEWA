from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    CPL, CPMK, IK, CPMKIKMap, MKBentukPenilaian, MKBentukPenilaianIKMap, Mahasiswa,
    NilaiBentukPenilaian, PesertaMataKuliah,
)
from app.models.cpmk_achievement import CPMKAchievement
from app.models.enums import SemesterEnum, StatusMasuk
from app.services.calculation.obe_formula import persen_cpmk, persen_ik
from tests.test_ui_audit_fixes import audit_data, auth_header, db_session  # noqa: F401 (fixtures)


def test_rumus_persen_ik_dan_cpmk():
    assert persen_ik(Decimal("16"), Decimal("20")) == Decimal("80.00")
    assert persen_ik(Decimal("5"), 0) == Decimal("0.00")
    # IK1 bobot 60 poin 60 (100%), IK2 bobot 40 poin 20 (50%) -> (100*60 + 50*40) / 100 = 80
    assert persen_cpmk({1: 60, 2: 40}, {1: Decimal("60"), 2: Decimal("20")}, {1: Decimal("60"), 2: Decimal("40")}) == Decimal("80.00")


def _siapkan_mk(db_session: Session, audit_data: dict):
    """1 CPL, 2 IK, 1 CPMK (IK1 60 / IK2 40), 1 bentuk penilaian bobot 100, 2 mahasiswa."""
    mk = audit_data["mk_a"]
    cpl = CPL(kurikulum_version_id=audit_data["kur_a"].id, kode="CPL-01", deskripsi="Analisis", program_studi_id=audit_data["prodi_a"].id, threshold_capaian=70)
    db_session.add(cpl)
    db_session.flush()
    ik1, ik2 = IK(cpl_id=cpl.id, kode="IK-01.1", deskripsi="a"), IK(cpl_id=cpl.id, kode="IK-01.2", deskripsi="b")
    cpmk = CPMK(mata_kuliah_id=mk.id, kode="CPMK-1", deskripsi="c", bobot=100)
    db_session.add_all([ik1, ik2, cpmk])
    db_session.flush()
    db_session.add_all([CPMKIKMap(cpmk_id=cpmk.id, ik_id=ik1.id, bobot=60), CPMKIKMap(cpmk_id=cpmk.id, ik_id=ik2.id, bobot=40)])
    mbp = MKBentukPenilaian(mata_kuliah_id=mk.id, bentuk_penilaian_id=audit_data["bp_a"].id, bobot=100, semester=SemesterEnum.ganjil)
    db_session.add(mbp)
    db_session.flush()
    db_session.add_all([
        MKBentukPenilaianIKMap(mk_bentuk_penilaian_id=mbp.id, ik_id=ik1.id, bobot=60),
        MKBentukPenilaianIKMap(mk_bentuk_penilaian_id=mbp.id, ik_id=ik2.id, bobot=40),
    ])

    mhs_a = audit_data["mhs_a"]
    mhs_a.angkatan = 2024
    mhs_b = Mahasiswa(nim="2301002", nama="Mhs B", semester_aktif=3, angkatan=2023, program_studi_id=audit_data["prodi_a"].id, status_masuk=StatusMasuk.reguler)
    db_session.add(mhs_b)
    db_session.flush()
    peserta_a = db_session.query(PesertaMataKuliah).filter_by(mata_kuliah_id=mk.id, mahasiswa_id=mhs_a.id).first()
    peserta_b = PesertaMataKuliah(mata_kuliah_id=mk.id, mahasiswa_id=mhs_b.id, kelas="A")
    db_session.add(peserta_b)
    db_session.flush()

    # mhs_a sempurna; mhs_b: IK1 100, IK2 50
    for peserta, n1, n2 in ((peserta_a, 100, 100), (peserta_b, 100, 50)):
        db_session.add_all([
            NilaiBentukPenilaian(peserta_mata_kuliah_id=peserta.id, mk_bentuk_penilaian_id=mbp.id, ik_id=ik1.id, nilai=n1, semester=SemesterEnum.ganjil),
            NilaiBentukPenilaian(peserta_mata_kuliah_id=peserta.id, mk_bentuk_penilaian_id=mbp.id, ik_id=ik2.id, nilai=n2, semester=SemesterEnum.ganjil),
        ])
    db_session.commit()
    return {"cpl": cpl, "ik1": ik1, "ik2": ik2, "cpmk": cpmk, "peserta_a": peserta_a, "peserta_b": peserta_b}


def test_kalkulasi_cpmk_dalam_persen_dan_analitik_prodi(client: TestClient, audit_data: dict, db_session: Session):
    s = _siapkan_mk(db_session, audit_data)
    res = client.post(f"/api/v1/kalkulasi/run/{audit_data['mk_a'].id}", headers=auth_header(audit_data["dosen_a"]))
    assert res.status_code == 200, res.text

    # Mahasiswa sempurna -> CPMK 100 (sebelumnya 52), status tercapai
    db_session.expire_all()
    ach_a = db_session.query(CPMKAchievement).filter_by(peserta_mata_kuliah_id=s["peserta_a"].id).one()
    ach_b = db_session.query(CPMKAchievement).filter_by(peserta_mata_kuliah_id=s["peserta_b"].id).one()
    assert Decimal(str(ach_a.nilai)) == Decimal("100")
    assert ach_a.status_tercapai == 1
    assert Decimal(str(ach_b.nilai)) == Decimal("80")  # (100*60 + 50*40) / 100

    data = client.get("/api/v1/analitik/prodi", headers=auth_header(audit_data["kaprodi_a"])).json()

    # CPL gabungan per angkatan: mhs_a 100 (2024), mhs_b (60+20)/100 = 80 (2023)
    per_angkatan = {c["angkatan"]: c["nilai"] for c in data["capaian_cpl"] if c["cpl_id"] == s["cpl"].id}
    assert per_angkatan == {2023: [80.0], 2024: [100.0]}

    # IK dalam persen: IK1 100 untuk keduanya, IK2 rata-rata (100 + 50) / 2 = 75
    ik = {i["kode"]: i for i in data["ik"]}
    assert ik["IK-01.1"]["rata_rata"] == 100.0
    assert ik["IK-01.2"]["rata_rata"] == 75.0
    assert ik["IK-01.2"]["persen_tercapai"] == 50.0  # 1 dari 2 >= 70

    cpmk = data["cpmk"][0]
    assert cpmk["rata_rata"] == 90.0 and cpmk["jumlah_tercapai"] == 2
    assert {m["ik_id"] for m in cpmk["ik"]} == {s["ik1"].id, s["ik2"].id}

    peta = [p for p in data["capaian_cpl_mk"] if p["cpl_id"] == s["cpl"].id]
    assert peta == [{
        "cpl_id": s["cpl"].id, "mk_id": audit_data["mk_a"].id, "bobot_cp": 100.0,
        "rata_rata": 90.0, "jumlah_mahasiswa": 2, "persen_tercapai": 100.0,
    }]
    assert data["cpl"][0]["threshold"] == 70.0

    # Drill-down Level 2 lama kini juga dalam persen
    lvl2 = client.get(f"/api/v1/dashboard/ik-breakdown/{s['cpl'].id}", headers=auth_header(audit_data["kaprodi_a"])).json()
    assert {i["kode"]: float(i["rata_rata"]) for i in lvl2} == {"IK-01.1": 100.0, "IK-01.2": 75.0}


def test_akses_analitik_prodi(client: TestClient, audit_data: dict):
    url = "/api/v1/analitik/prodi"
    for key in ("admin_a", "dosen_a"):
        assert client.get(url, headers=auth_header(audit_data[key])).status_code == 403
    assert client.get(url, headers=auth_header(audit_data["kaprodi_a"])).status_code == 200
    dekan = auth_header(audit_data["dekan"])
    assert client.get(url, headers=dekan).status_code == 400
    assert client.get(url, params={"program_studi_id": audit_data["prodi_a"].id}, headers=dekan).status_code == 200
    assert client.get(url, params={"program_studi_id": 99999}, headers=dekan).status_code == 403


def test_analitik_mata_kuliah_untuk_dosen(client: TestClient, audit_data: dict, db_session: Session):
    s = _siapkan_mk(db_session, audit_data)
    mk_id = audit_data["mk_a"].id
    assert client.post(f"/api/v1/kalkulasi/run/{mk_id}", headers=auth_header(audit_data["dosen_a"])).status_code == 200

    url = f"/api/v1/analitik/mata-kuliah/{mk_id}"
    data = client.get(url, headers=auth_header(audit_data["dosen_a"])).json()
    assert data["scope"] == "mata_kuliah"
    assert [m["mk_id"] for m in data["mata_kuliah"]] == [mk_id]
    # Hanya CPL & IK yang diukur MK ini
    assert [c["cpl_id"] for c in data["cpl"]] == [s["cpl"].id]
    assert {i["kode"] for i in data["ik"]} == {"IK-01.1", "IK-01.2"}
    # Capaian CPL di MK ini per angkatan, dan CPMK per angkatan
    assert {c["angkatan"]: c["nilai"] for c in data["capaian_cpl"]} == {2023: [80.0], 2024: [100.0]}
    assert {c["angkatan"]: c["nilai"] for c in data["capaian_cpmk"]} == {2023: [80.0], 2024: [100.0]}

    # Akses: dosen bukan pengampu & admin prodi ditolak; kaprodi & dekan boleh
    assert client.get(url, headers=auth_header(audit_data["dosen_b"])).status_code == 403
    assert client.get(url, headers=auth_header(audit_data["admin_a"])).status_code == 403
    assert client.get(url, headers=auth_header(audit_data["kaprodi_a"])).status_code == 200
    assert client.get(url, headers=auth_header(audit_data["dekan"])).status_code == 200
    assert client.get("/api/v1/analitik/mata-kuliah/99999", headers=auth_header(audit_data["dosen_a"])).status_code == 404
