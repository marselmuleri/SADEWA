from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import CPL, CPMK, HasilEvaluasi
from app.models.cpl_achievement import CPLAchievement
from app.models.cpmk_achievement import CPMKAchievement
from app.models.enums import SemesterEnum, StatusOutcome
from tests.test_ui_audit_fixes import audit_data, auth_header, db_session  # noqa: F401 (fixtures)


@pytest.fixture(autouse=True)
def upload_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    return tmp_path


def _unggah(client, mk_id, headers, jenis="rps", nama="rps.pdf", isi=b"%PDF-1.4 isi"):
    return client.post(
        f"/api/v1/portofolio/{mk_id}/berkas",
        data={"jenis": jenis, "judul": "RPS Algoritma"},
        files={"file": (nama, isi, "application/pdf")},
        headers=headers,
    )


def test_daftar_mk_sesuai_peran(client: TestClient, audit_data: dict):
    mk_a = audit_data["mk_a"].id
    dosen = client.get("/api/v1/portofolio/mata-kuliah", headers=auth_header(audit_data["dosen_a"]))
    assert dosen.status_code == 200, dosen.text
    assert [m["id"] for m in dosen.json()] == [mk_a]
    assert dosen.json()[0]["is_pengampu"] is True
    assert dosen.json()[0]["pengampu"] == ["Dosen A"]
    assert dosen.json()[0]["jumlah_peserta"] == 1

    kaprodi = client.get("/api/v1/portofolio/mata-kuliah", headers=auth_header(audit_data["kaprodi_a"]))
    assert [m["id"] for m in kaprodi.json()] == [mk_a]

    dekan = client.get("/api/v1/portofolio/mata-kuliah", headers=auth_header(audit_data["dekan"]))
    assert len(dekan.json()) == 2
    dekan_if = client.get(
        "/api/v1/portofolio/mata-kuliah",
        params={"program_studi_id": audit_data["prodi_a"].id},
        headers=auth_header(audit_data["dekan"]),
    )
    assert [m["id"] for m in dekan_if.json()] == [mk_a]

    admin = client.get("/api/v1/portofolio/mata-kuliah", headers=auth_header(audit_data["admin_a"]))
    assert admin.status_code == 403


def test_unggah_unduh_hapus_rps(client: TestClient, audit_data: dict, upload_dir):
    mk_a = audit_data["mk_a"].id
    h = auth_header(audit_data["dosen_a"])

    res = _unggah(client, mk_a, h)
    assert res.status_code == 200, res.text
    berkas = res.json()
    assert berkas["jenis"] == "rps"
    assert berkas["nama_file"] == "rps.pdf"
    assert berkas["uploader_nama"] == "Dosen A"
    assert len(list(upload_dir.rglob("*.pdf"))) == 1

    # Kaprodi & Dekan boleh melihat dan mengunduh
    for key in ("kaprodi_a", "dekan"):
        lihat = client.get(f"/api/v1/portofolio/{mk_a}/berkas", params={"jenis": "rps"}, headers=auth_header(audit_data[key]))
        assert [b["id"] for b in lihat.json()] == [berkas["id"]]
        unduh = client.get(f"/api/v1/portofolio/berkas/{berkas['id']}/unduh", headers=auth_header(audit_data[key]))
        assert unduh.status_code == 200
        assert unduh.content == b"%PDF-1.4 isi"

    # tapi tidak boleh menghapus atau mengunggah
    assert client.delete(f"/api/v1/portofolio/berkas/{berkas['id']}", headers=auth_header(audit_data["kaprodi_a"])).status_code == 403
    assert _unggah(client, mk_a, auth_header(audit_data["kaprodi_a"])).status_code == 403

    assert client.delete(f"/api/v1/portofolio/berkas/{berkas['id']}", headers=h).status_code == 200
    assert client.get(f"/api/v1/portofolio/{mk_a}/berkas", headers=h).json() == []
    assert list(upload_dir.rglob("*.pdf")) == []


def test_unggah_ditolak_bukan_pengampu_atau_format_salah(client: TestClient, audit_data: dict, monkeypatch):
    mk_a = audit_data["mk_a"].id
    assert _unggah(client, mk_a, auth_header(audit_data["dosen_b"])).status_code == 403
    assert client.get(f"/api/v1/portofolio/{mk_a}/berkas", headers=auth_header(audit_data["dosen_b"])).status_code == 403

    h = auth_header(audit_data["dosen_a"])
    assert _unggah(client, mk_a, h, nama="virus.exe").status_code == 400
    assert _unggah(client, mk_a, h, nama="rps.png").status_code == 400  # png hanya untuk lampiran
    assert _unggah(client, mk_a, h, jenis="lampiran", nama="foto.png").status_code == 200
    assert _unggah(client, mk_a, h, jenis="lainnya").status_code == 400
    assert _unggah(client, mk_a, h, isi=b"").status_code == 400

    monkeypatch.setattr(settings, "UPLOAD_MAX_MB", 0)
    assert _unggah(client, mk_a, h).status_code == 413


def test_rpp_simpan_dan_lihat(client: TestClient, audit_data: dict):
    mk_a = audit_data["mk_a"].id
    h = auth_header(audit_data["dosen_a"])
    payload = {"pertemuan": [
        {"pertemuan_ke": 2, "materi": "Rekursi", "tanggal": ""},
        {"pertemuan_ke": 1, "materi": "Pengantar", "cpmk": "CPMK-1", "tanggal": "2025-09-01", "realisasi": "Sesuai"},
    ]}
    res = client.put(f"/api/v1/portofolio/{mk_a}/rpp", json=payload, headers=h)
    assert res.status_code == 200, res.text
    assert [p["pertemuan_ke"] for p in res.json()["pertemuan"]] == [1, 2]
    assert res.json()["pertemuan"][0]["tanggal"] == "2025-09-01"

    # Simpan ulang mengganti seluruh isi
    res = client.put(f"/api/v1/portofolio/{mk_a}/rpp", json={"pertemuan": [{"pertemuan_ke": 3, "materi": "x"}]}, headers=h)
    assert [p["pertemuan_ke"] for p in res.json()["pertemuan"]] == [3]

    ganda = {"pertemuan": [{"pertemuan_ke": 1}, {"pertemuan_ke": 1}]}
    assert client.put(f"/api/v1/portofolio/{mk_a}/rpp", json=ganda, headers=h).status_code == 400

    lihat = client.get(f"/api/v1/portofolio/{mk_a}/rpp", headers=auth_header(audit_data["kaprodi_a"]))
    assert lihat.status_code == 200
    assert lihat.json()["pertemuan"][0]["materi"] == "x"
    assert client.put(f"/api/v1/portofolio/{mk_a}/rpp", json=payload, headers=auth_header(audit_data["kaprodi_a"])).status_code == 403

    daftar = client.get("/api/v1/portofolio/mata-kuliah", headers=h).json()
    assert daftar[0]["jumlah_rpp"] == 1


def test_capaian_nilai_cp_dan_sebaran(client: TestClient, audit_data: dict, db_session: Session):
    mk = audit_data["mk_a"]
    db_session.refresh(mk)
    peserta = mk.peserta[0]

    cpmk = CPMK(mata_kuliah_id=mk.id, kode="CPMK-1", deskripsi="Memahami algoritma", bobot=100)
    cpl = CPL(kurikulum_version_id=audit_data["kur_a"].id, kode="CPL-01", deskripsi="Analisis",
              program_studi_id=audit_data["prodi_a"].id, threshold_capaian=Decimal("70"))
    db_session.add_all([cpmk, cpl])
    db_session.flush()
    db_session.add_all([
        CPMKAchievement(peserta_mata_kuliah_id=peserta.id, cpmk_id=cpmk.id, nilai=Decimal("82.5"), status_tercapai=1),
        CPLAchievement(mahasiswa_id=peserta.mahasiswa_id, cpl_id=cpl.id, mata_kuliah_id=mk.id,
                       semester=SemesterEnum.ganjil, nilai=Decimal("65"), bobot_cp=Decimal("1")),
        HasilEvaluasi(peserta_mata_kuliah_id=peserta.id, nilai_akhir=Decimal("82.5"), nilai_huruf="A",
                      status_outcome=StatusOutcome.tercapai),
    ])
    db_session.commit()

    res = client.get(f"/api/v1/portofolio/{mk.id}/capaian", headers=auth_header(audit_data["dekan"]))
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["jumlah_peserta"] == 1
    assert data["jumlah_dinilai"] == 1
    assert data["mahasiswa"][0]["nim"] == "2201001"
    assert data["mahasiswa"][0]["cpmk"][str(cpmk.id)] == 82.5
    assert data["mahasiswa"][0]["cpl"][str(cpl.id)] == 65.0
    assert data["cpmk"][0]["persen_tercapai"] == 100.0
    assert data["cpl"][0]["persen_tercapai"] == 0.0
    assert data["sebaran"]["huruf"] == [{"huruf": "A", "jumlah": 1}]
    assert next(r for r in data["sebaran"]["rentang"] if r["bawah"] == 80)["jumlah"] == 1
    assert data["sebaran"]["statistik"]["jumlah_lulus"] == 1

    assert client.get(f"/api/v1/portofolio/{mk.id}/capaian", headers=auth_header(audit_data["dosen_b"])).status_code == 403
    assert client.get(f"/api/v1/portofolio/{mk.id}/capaian", headers=auth_header(audit_data["admin_a"])).status_code == 403
