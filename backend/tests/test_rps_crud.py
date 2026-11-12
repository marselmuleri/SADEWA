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


KONTEN_V2 = {
    "format": 2,
    "kode_mk": "IF101",
    "deskripsi_mk": "Draf AI format baru",
    "cpl": [{"kode": "CPL 2", "deskripsi": "x", "label": "ENGINEERING DESIGN"}],
    "cpmk": [{"kode": "CPMK 2.1", "deskripsi": "y"}, {"kode": "CPMK 5.1", "deskripsi": "z"}],
    "penilaian": [
        {"poin": "Tugas", "komponen": "Tugas", "rincian": ["Tugas harian"], "bobot": 70, "cpmk": ["CPMK 2.1"]},
        {"poin": "Kognitif / Pengetahuan", "komponen": "UTS", "rincian": [], "bobot": 15, "cpmk": ["CPMK 2.1"]},
        {"poin": "Kognitif / Pengetahuan", "komponen": "UAS", "rincian": [], "bobot": 15, "cpmk": ["CPMK 5.1"]},
    ],
    "pertemuan": [
        {"minggu": 1, "jenis": "kuliah", "kemampuan_akhir": "Mahasiswa mampu (C3)", "bahan_kajian_judul": "VLAN",
         "bahan_kajian": "trunk, DTP", "metode": "Praktikum", "waktu": "3 x 50 menit",
         "pengalaman_belajar": ["Membuat VLAN", "Menguji trunk"], "target_cpmk": ["CPMK 2.1", "CPMK 5.1"],
         "kriteria_indikator": ["VLAN berhasil dibuat"], "bobot": None},
        {"minggu": 8, "jenis": "UTS", "bobot": 15},
    ],
    "referensi": ["Cisco Networking Academy"],
}


def test_rps_format_baru_dibaca_seragam():
    from app.services.rps_format import baris_pertemuan, daftar_pertemuan

    baru = daftar_pertemuan(KONTEN_V2)
    assert baru[0]["cpmk"] == "CPMK 2.1, 5.1"
    assert baru[0]["materi"] == "VLAN: trunk, DTP"
    assert baru[0]["pengalaman_belajar"] == "Membuat VLAN\nMenguji trunk"
    assert (baru[1]["jenis"], baru[1]["materi"], baru[1]["bobot"]) == ("UTS", "UJIAN TENGAH SEMESTER", 15)

    lama = baris_pertemuan(KONTEN["pertemuan"][0])
    assert (lama["cpmk"], lama["kemampuan_akhir"], lama["materi"]) == ("CPMK-1", "a", "b")


def test_identitas_dokumen_rps(client: TestClient, audit_data: dict):
    url = f"/api/v1/rps/identitas/{audit_data['mk_a'].id}"
    res = client.get(url, headers=auth_header(audit_data["dosen_a"]))
    assert res.status_code == 200, res.text
    data = res.json()
    assert (data["kode"], data["nama"], data["sks"]) == ("IF101", "Algoritma", 3)
    assert data["program_studi"] == "Informatika" and data["fakultas"] == "Fakultas Teknik"
    assert data["dosen"] == ["Dosen A"]
    assert client.get(url, headers=auth_header(audit_data["dosen_b"])).status_code == 403


def test_export_portofolio_membaca_rps_format_baru(client: TestClient, audit_data: dict, db_session: Session):
    import io

    import openpyxl

    db_session.add(RPS(mata_kuliah_id=audit_data["mk_a"].id, tahun_ajaran="2025/2026", semester=SemesterEnum.ganjil,
                       status="draft", konten=KONTEN_V2, created_by=audit_data["dosen_a"].id))
    db_session.commit()
    res = client.get(f"/api/v1/portofolio/{audit_data['mk_a'].id}/export", headers=auth_header(audit_data["dosen_a"]))
    assert res.status_code == 200, res.text
    ws = openpyxl.load_workbook(io.BytesIO(res.content))["RPS"]
    nilai = [c.value for row in ws.iter_rows() for c in row if c.value is not None]
    assert "VLAN: trunk, DTP" in nilai and "CPMK 2.1, 5.1" in nilai and "UJIAN TENGAH SEMESTER" in nilai
