"""Tahap 2-4 Portofolio: aturan penilaian prodi, skala huruf per angkatan, Data Portofolio."""
import io

import openpyxl
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import CPMKAchievement, HasilEvaluasi, Mahasiswa, MataKuliah, PesertaMataKuliah
from app.models.enums import SemesterEnum
from app.services.calculation.engine import run_kalkulasi
from tests.test_portofolio_export import obe  # noqa: F401 (fixture)
from tests.test_ui_audit_fixes import audit_data, auth_header, db_session  # noqa: F401 (fixtures)

KELOMPOK = [
    {"angkatan_min": 2024, "angkatan_max": None, "skala": [
        {"huruf": "A", "batas_min": 85}, {"huruf": "AB", "batas_min": 80}, {"huruf": "B", "batas_min": 75},
        {"huruf": "BC", "batas_min": 70}, {"huruf": "C", "batas_min": 60}, {"huruf": "D", "batas_min": 40},
        {"huruf": "E", "batas_min": 0},
    ]},
    {"angkatan_min": None, "angkatan_max": 2023, "skala": [
        {"huruf": "A", "batas_min": 80}, {"huruf": "B", "batas_min": 70}, {"huruf": "C", "batas_min": 60},
        {"huruf": "D", "batas_min": 51}, {"huruf": "E", "batas_min": 0},
    ]},
]


def _hasil(db: Session, mk_id: int) -> dict[str, HasilEvaluasi]:
    db.expire_all()
    rows = (
        db.query(HasilEvaluasi, Mahasiswa)
        .join(PesertaMataKuliah, PesertaMataKuliah.id == HasilEvaluasi.peserta_mata_kuliah_id)
        .join(Mahasiswa, Mahasiswa.id == PesertaMataKuliah.mahasiswa_id)
        .filter(PesertaMataKuliah.mata_kuliah_id == mk_id)
    )
    return {m.nama: h for h, m in rows}


def _export(client, obe, key="dosen_a"):
    res = client.get(f"/api/v1/portofolio/{obe['mk'].id}/export", headers=auth_header(obe[key]))
    assert res.status_code == 200, res.text
    return openpyxl.load_workbook(io.BytesIO(res.content))


# --- Tahap 2: aturan penilaian prodi -------------------------------------------------

def test_aturan_default_simpan_dan_hak_akses(client: TestClient, audit_data):
    admin = auth_header(audit_data["admin_a"])
    awal = client.get("/api/v1/aturan-penilaian", headers=admin).json()
    assert (awal["ambang"], awal["target_rerata_skala"], awal["target_persen"]) == (70.0, 2.6, 60.0)
    assert awal["tersimpan"] is False and awal["rubrik_bawaan"] is True and awal["skala_maks"] == 4

    baru = {"ambang": 60, "target_rerata_skala": 2.6, "target_persen": 60,
            "gpm_nama": "Patricia, M.Cs.", "gpm_nip": "H.7.1992"}
    res = client.put("/api/v1/aturan-penilaian", json=baru, headers=admin)
    assert res.status_code == 200, res.text
    assert res.json()["ambang"] == 60.0 and res.json()["tersimpan"] is True
    assert client.put("/api/v1/aturan-penilaian", json=baru, headers=auth_header(audit_data["kaprodi_a"])).status_code == 200

    assert client.put("/api/v1/aturan-penilaian", json=baru, headers=auth_header(audit_data["dosen_a"])).status_code == 403
    assert client.put("/api/v1/aturan-penilaian", json={**baru, "target_rerata_skala": 5},
                      headers=admin).status_code == 400  # > skor maks rubrik (4)
    assert client.put("/api/v1/aturan-penilaian", json={**baru, "ambang": 120}, headers=admin).status_code == 422

    # Dosen boleh membaca; Dekan wajib memilih prodi di fakultasnya
    assert client.get("/api/v1/aturan-penilaian", headers=auth_header(audit_data["dosen_a"])).json()["ambang"] == 60.0
    dekan = auth_header(audit_data["dekan"])
    assert client.get("/api/v1/aturan-penilaian", headers=dekan).status_code == 400
    lihat = client.get("/api/v1/aturan-penilaian", params={"program_studi_id": audit_data["prodi_a"].id}, headers=dekan)
    assert lihat.json()["gpm_nama"] == "Patricia, M.Cs."
    # Prodi lain tidak terpengaruh
    assert client.get("/api/v1/aturan-penilaian", params={"program_studi_id": audit_data["prodi_b"].id},
                      headers=dekan).json()["ambang"] == 70.0


def test_ambang_prodi_dipakai_kalkulasi_dan_export(client: TestClient, obe, db_session: Session):
    mk_id = obe["mk"].id
    # Bawaan 70: Budi (75) tercapai
    assert _hasil(db_session, mk_id)["Budi"].status_outcome.value == "Tercapai"

    client.put("/api/v1/aturan-penilaian", headers=auth_header(obe["admin_a"]),
               json={"ambang": 80, "target_rerata_skala": 3, "target_persen": 75, "gpm_nama": "GPM IF"})
    run_kalkulasi(db_session, mk_id)
    hasil = _hasil(db_session, mk_id)
    assert hasil["Mhs IF"].status_outcome.value == "Tercapai"        # 84 >= 80
    assert hasil["Budi"].status_outcome.value == "Tidak Tercapai"     # 75 < 80
    # CPMK2 Mhs IF = 77.5 -> tidak tercapai pada ambang 80
    cpmk2 = db_session.query(CPMKAchievement).filter_by(
        cpmk_id=obe["c2"].id, peserta_mata_kuliah_id=hasil["Mhs IF"].peserta_mata_kuliah_id).one()
    assert (cpmk2.status_tercapai, cpmk2.nilai_kriteria) == (0, 80)

    ev = client.get(f"/api/v1/portofolio/{mk_id}/evaluasi", headers=auth_header(obe["dosen_a"])).json()
    assert (ev["ambang_cpmk"], ev["target_rerata_skala"], ev["target_persen"]) == (80.0, 3.0, 75.0)

    wb = _export(client, obe)
    p = wb["PARAMETER"]
    assert (p["B4"].value, p["B5"].value, p["B6"].value) == (80.0, 3.0, 0.75)
    assert wb["COVER"]["B22"].value == "GPM IF"
    assert "Ambang ketercapaian CPMK dan kelulusan nilai akhir: 80." in [
        c.value for row in wb["KONTRAK"].iter_rows() for c in row if isinstance(c.value, str)
    ]


# --- Tahap 4: skala huruf per angkatan -----------------------------------------------

def test_skala_per_angkatan_api_dan_kalkulasi(client: TestClient, obe, db_session: Session):
    kur_id = obe["kur_a"].id
    url = f"/api/v1/kurikulum/versions/{kur_id}/skala-nilai"
    admin = auth_header(obe["admin_a"])

    res = client.post(url, json={"kelompok": KELOMPOK}, headers=admin)
    assert res.status_code == 200, res.text
    labels = [k["label"] for k in res.json()["kelompok"]]
    assert labels == ["Angkatan 2024 dan sesudahnya", "Angkatan 2023 dan sebelumnya"]
    assert res.json()["skala"] == []  # belum ada skala bawaan

    # Angkatan: Mhs IF 2024 (84 -> AB), Budi 2023 (75 -> B), Citra tanpa angkatan -> tanpa huruf
    for nama, angkatan in (("Mhs IF", 2024), ("Budi", 2023)):
        db_session.query(Mahasiswa).filter_by(nama=nama).update({"angkatan": angkatan})
    db_session.commit()
    run_kalkulasi(db_session, obe["mk"].id)
    hasil = _hasil(db_session, obe["mk"].id)
    assert (hasil["Mhs IF"].nilai_huruf, hasil["Budi"].nilai_huruf, hasil["Citra"].nilai_huruf) == ("AB", "B", None)

    # Format lama `skala` hanya mengganti skala bawaan; kelompok angkatan tetap
    client.post(url, json={"skala": [{"huruf": "L", "batas_min": 60}, {"huruf": "TL", "batas_min": 0}]}, headers=admin)
    kelompok = client.get(url, headers=admin).json()["kelompok"]
    assert len(kelompok) == 3 and kelompok[-1]["label"] == "Semua angkatan (bawaan)"
    run_kalkulasi(db_session, obe["mk"].id)
    assert _hasil(db_session, obe["mk"].id)["Citra"].nilai_huruf == "TL"  # 54, bawaan

    # Excel: tiap mahasiswa memakai tabel skala angkatannya
    wb = _export(client, obe)
    f = wb["FORM NILAI"]
    rumus = {f[f"C{r}"].value: f[f"I{r}"].value for r in range(10, 13)}
    angkatan = {f[f"C{r}"].value: f[f"E{r}"].value for r in range(10, 13)}
    assert angkatan == {"Mhs IF": 2024, "Budi": 2023, "Citra": None}
    assert len({rumus["Mhs IF"], rumus["Budi"], rumus["Citra"]}) == 3
    judul = [c.value for c in wb["PARAMETER"]["A"] if isinstance(c.value, str) and c.value.startswith("Skala nilai huruf")]
    assert len(judul) == 3


def test_validasi_kelompok_skala(client: TestClient, audit_data):
    url = f"/api/v1/kurikulum/versions/{audit_data['kur_a'].id}/skala-nilai"
    admin = auth_header(audit_data["admin_a"])
    skala = [{"huruf": "A", "batas_min": 80}, {"huruf": "E", "batas_min": 0}]
    tumpang = [{"angkatan_min": 2020, "angkatan_max": 2024, "skala": skala},
               {"angkatan_min": 2023, "angkatan_max": None, "skala": skala}]
    res = client.post(url, json={"kelompok": tumpang}, headers=admin)
    assert res.status_code == 400 and "tumpang tindih" in res.json()["detail"]

    dua_bawaan = [{"skala": skala}, {"skala": skala}]
    assert client.post(url, json={"kelompok": dua_bawaan}, headers=admin).status_code == 400

    terbalik = [{"angkatan_min": 2025, "angkatan_max": 2020, "skala": skala}]
    assert client.post(url, json={"kelompok": terbalik}, headers=admin).status_code == 400

    tanpa_nol = [{"angkatan_min": 2024, "skala": [{"huruf": "A", "batas_min": 80}]}]
    assert client.post(url, json={"kelompok": tanpa_nol}, headers=admin).status_code == 400


# --- Tahap 3: Data Portofolio & kolom RPP tambahan -------------------------------------

def test_data_portofolio_saran_semester_lalu_dan_export(client: TestClient, obe, db_session: Session):
    mk = obe["mk"]
    dosen = auth_header(obe["dosen_a"])

    # Mata kuliah yang sama tahun lalu (kode sama, prodi sama) sudah punya data portofolio
    lama = MataKuliah(kurikulum_version_id=mk.kurikulum_version_id, kode=mk.kode, nama=mk.nama, sks=3,
                      semester=SemesterEnum.ganjil, tahun_ajaran="2024/2025", program_studi_id=mk.program_studi_id)
    db_session.add(lama)
    db_session.commit()
    from app.models import PengampuMataKuliah
    db_session.add(PengampuMataKuliah(mata_kuliah_id=lama.id, user_id=obe["dosen_a"].id, is_koordinator=True))
    db_session.commit()
    isi_lama = {"no_dokumen": "PFM/LAMA/1", "manfaat": "Manfaat lama", "tata_tertib": "Tata tertib lama",
                "prasyarat": "Pemrograman Dasar"}
    assert client.put(f"/api/v1/portofolio/{lama.id}/info", json=isi_lama, headers=dosen).status_code == 200

    info = client.get(f"/api/v1/portofolio/{mk.id}/info", headers=dosen).json()
    assert info["data"] is None
    assert info["saran"]["manfaat"] == "Manfaat lama"
    assert info["saran"]["no_dokumen"] is None  # nomor dokumen tidak ikut disarankan
    assert info["saran_sumber"] == "IF101 2024/2025 Ganjil"

    baru = {**info["saran"], "no_dokumen": "PFM/S1.IF/6243", "revisi": "02", "tanggal_terbit": "2025-12-30",
            "strategi": "Ceramah, diskusi", "referensi": "Netacad Cisco Academy"}
    res = client.put(f"/api/v1/portofolio/{mk.id}/info", json=baru, headers=dosen)
    assert res.status_code == 200, res.text
    assert res.json()["data"]["no_dokumen"] == "PFM/S1.IF/6243" and res.json()["saran"] is None
    assert client.put(f"/api/v1/portofolio/{mk.id}/info", json=baru,
                      headers=auth_header(obe["kaprodi_a"])).status_code == 403
    assert client.get(f"/api/v1/portofolio/{mk.id}/info", headers=auth_header(obe["kaprodi_a"])).status_code == 200

    # RPP dengan kolom tambahan
    rpp = {"pertemuan": [{"pertemuan_ke": 1, "materi": "Pengantar", "waktu": "2 x 50 menit",
                          "pengalaman_belajar": "Diskusi topik", "indikator_kriteria": "Ketepatan minimal 60%"}]}
    res = client.put(f"/api/v1/portofolio/{mk.id}/rpp", json=rpp, headers=dosen)
    assert res.json()["pertemuan"][0]["indikator_kriteria"] == "Ketepatan minimal 60%"

    wb = _export(client, obe)
    cover = wb["COVER"]
    assert cover["D10"].value == "Pemrograman Dasar"
    assert (cover["D34"].value, cover["D35"].value, cover["D36"].value) == ("PFM/S1.IF/6243", "02", "30-12-2025")
    teks_kontrak = [c.value for row in wb["KONTRAK"].iter_rows() for c in row if isinstance(c.value, str)]
    assert "Manfaat lama" in teks_kontrak and "Ceramah, diskusi" in teks_kontrak
    rps = wb["RPS"]
    assert [rps["F7"].value, rps["G7"].value, rps["H7"].value] == [
        "Waktu", "Pengalaman Belajar Mahasiswa", "Indikator & Kriteria Penilaian"]
    assert [rps["F8"].value, rps["G8"].value, rps["H8"].value] == [
        "2 x 50 menit", "Diskusi topik", "Ketepatan minimal 60%"]
