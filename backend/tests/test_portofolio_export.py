import io
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import openpyxl
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    CPL, CPMK, IK, BentukPenilaian, CPMKIKMap, JenisEvaluasi, Mahasiswa, MKBentukPenilaian,
    MKBentukPenilaianIKMap, NilaiBentukPenilaian, PesertaMataKuliah, SkalaNilai,
)
from app.models.enums import SemesterEnum, StatusMasuk
from app.models.portofolio import RPPPertemuan
from app.services.calculation.engine import run_kalkulasi
from tests.test_ui_audit_fixes import audit_data, auth_header, db_session  # noqa: F401 (fixtures)

# (nim, nama, {(bentuk, ik): nilai})
NILAI = [
    ("2201001", "Mhs IF", {("tugas", 1): 90, ("tugas", 2): 80, ("uts", 1): 85, ("uts", 2): 75}),
    # Nilai akhir 75 (lulus) tetapi CPMK1 = (24 + 11) / 60 = 58.3 -> REMIDI
    ("2201002", "Budi", {("tugas", 1): 60, ("tugas", 2): 100, ("uts", 1): 55, ("uts", 2): 100}),
    ("2201003", "Citra", {("tugas", 1): 60, ("tugas", 2): 50, ("uts", 1): 55, ("uts", 2): 45}),
]


@pytest.fixture
def obe(audit_data, db_session: Session):
    d = audit_data
    mk = d["mk_a"]
    cpl = CPL(kurikulum_version_id=d["kur_a"].id, kode="CPL-02", deskripsi="Perancangan sistem",
              program_studi_id=d["prodi_a"].id, threshold_capaian=Decimal("70"))
    db_session.add(cpl)
    db_session.flush()
    ik1 = IK(cpl_id=cpl.id, kode="PI-2-1", deskripsi="Merancang komponen")
    ik2 = IK(cpl_id=cpl.id, kode="PI-2-2", deskripsi="Mempertimbangkan batasan")
    db_session.add_all([ik1, ik2])
    db_session.flush()
    c1 = CPMK(mata_kuliah_id=mk.id, kode="CPMK1", deskripsi="Mendesain jaringan", bobot=60, level_taksonomi="C6")
    c2 = CPMK(mata_kuliah_id=mk.id, kode="CPMK2", deskripsi="Menganalisis topologi", bobot=40, level_taksonomi="C4")
    db_session.add_all([c1, c2])
    db_session.flush()
    db_session.add_all([CPMKIKMap(cpmk_id=c1.id, ik_id=ik1.id, bobot=60), CPMKIKMap(cpmk_id=c2.id, ik_id=ik2.id, bobot=40)])

    je_uts = JenisEvaluasi(program_studi_id=d["prodi_a"].id, nama="UTS", urutan=2)
    db_session.add(je_uts)
    db_session.flush()
    bp_uts = BentukPenilaian(jenis_evaluasi_id=je_uts.id, nama="UTS Tertulis")
    db_session.add(bp_uts)
    db_session.flush()
    tugas_bp = db_session.query(BentukPenilaian).filter(BentukPenilaian.nama == "Tugas 1 IF").one()
    mbp_t = MKBentukPenilaian(mata_kuliah_id=mk.id, bentuk_penilaian_id=tugas_bp.id, bobot=60, semester=SemesterEnum.ganjil)
    mbp_u = MKBentukPenilaian(mata_kuliah_id=mk.id, bentuk_penilaian_id=bp_uts.id, bobot=40, semester=SemesterEnum.ganjil)
    db_session.add_all([mbp_t, mbp_u])
    db_session.flush()
    db_session.add_all([
        MKBentukPenilaianIKMap(mk_bentuk_penilaian_id=mbp_t.id, ik_id=ik1.id, bobot=40),
        MKBentukPenilaianIKMap(mk_bentuk_penilaian_id=mbp_t.id, ik_id=ik2.id, bobot=20),
        MKBentukPenilaianIKMap(mk_bentuk_penilaian_id=mbp_u.id, ik_id=ik1.id, bobot=20),
        MKBentukPenilaianIKMap(mk_bentuk_penilaian_id=mbp_u.id, ik_id=ik2.id, bobot=20),
    ])
    db_session.add_all([
        SkalaNilai(kurikulum_version_id=d["kur_a"].id, huruf=h, batas_min=b)
        for h, b in [("A", 85), ("AB", 80), ("B", 70), ("BC", 65), ("C", 60), ("D", 50), ("E", 0)]
    ])

    peserta = {p.mahasiswa.nim: p for p in db_session.query(PesertaMataKuliah).filter_by(mata_kuliah_id=mk.id)}
    for nim, nama, _ in NILAI[1:]:
        m = Mahasiswa(nim=nim, nama=nama, semester_aktif=3, program_studi_id=d["prodi_a"].id, status_masuk=StatusMasuk.reguler)
        db_session.add(m)
        db_session.flush()
        p = PesertaMataKuliah(mata_kuliah_id=mk.id, mahasiswa_id=m.id, kelas="A")
        db_session.add(p)
        db_session.flush()
        peserta[nim] = p
    mbp = {"tugas": mbp_t, "uts": mbp_u}
    ik = {1: ik1, 2: ik2}
    for nim, _, nilai in NILAI:
        for (b, i), v in nilai.items():
            db_session.add(NilaiBentukPenilaian(peserta_mata_kuliah_id=peserta[nim].id, mk_bentuk_penilaian_id=mbp[b].id,
                                                ik_id=ik[i].id, nilai=v, semester=SemesterEnum.ganjil))
    db_session.add(RPPPertemuan(mata_kuliah_id=mk.id, pertemuan_ke=1, materi="Pengantar", realisasi="Sesuai"))
    db_session.commit()
    run_kalkulasi(db_session, mk.id)
    return {**d, "c1": c1, "c2": c2, "mk": mk}


def _unduh(client, obe, key="dosen_a"):
    res = client.get(f"/api/v1/portofolio/{obe['mk'].id}/export", headers=auth_header(obe[key]))
    assert res.status_code == 200, res.text
    assert "spreadsheetml" in res.headers["content-type"]
    assert "Portofolio IF101" in res.headers["content-disposition"]
    return openpyxl.load_workbook(io.BytesIO(res.content))


def test_export_berisi_semua_sheet_dan_rumus(client: TestClient, obe):
    wb = _unduh(client, obe)
    assert wb.sheetnames == [
        "COVER", "CPMK-CPL", "RPS", "KONTRAK", "NILAI TUGAS IF", "NILAI UTS", "FORM NILAI",
        "CPMK", "PI-CPL", "CPL", "REMIDI", "EVALUASI", "PARAMETER",
    ]
    assert wb["COVER"]["D9"].value == "IF101 - Algoritma"

    p = wb["PARAMETER"]
    assert (p["B4"].value, p["B5"].value, p["B6"].value) == (70.0, 2.6, 0.6)

    # NILAI TUGAS: bobot poin di baris 9, nilai mentah mulai baris 10, nilai jenis = rumus
    t = wb["NILAI TUGAS IF"]
    assert [t["D8"].value, t["E8"].value] == ["PI-2-1", "PI-2-2"]
    assert [t["D9"].value, t["E9"].value] == [40, 20]
    assert [t["B10"].value, t["D10"].value, t["E10"].value] == ["2201001", 90, 80]
    assert t["F10"].value.startswith("=IF(COUNT(D10:E10)=0")

    f = wb["FORM NILAI"]
    assert f["E7"].value == "Angkatan"
    assert f["F7"].value == "Nilai Tugas IF (0-100)"
    assert f["F10"].value == "='NILAI TUGAS IF'!F10"
    assert f["G10"].value == "='NILAI UTS'!F10"
    assert f["F9"].value.startswith("=SUM('NILAI TUGAS IF'!$D$9")
    assert "SUMPRODUCT(F10:G10,F$9:G$9)/100" in f["H10"].value
    assert "LOOKUP(H10,PARAMETER!" in f["I10"].value
    assert '"REMIDI CPMK"' in f["J10"].value and "PARAMETER!$B$4" in f["J10"].value

    e = wb["EVALUASI"]
    assert e["B8"].value == "CPMK1"
    assert e["D8"].value.startswith("=IF('CPMK'!")
    assert e["G8"].value is None  # belum ada teks evaluasi


def test_nilai_export_cocok_dengan_kalkulasi_sadewa(client: TestClient, obe, db_session: Session):
    """Rumus Excel memakai bobot & nilai yang sama dengan mesin kalkulasi: hitung ulang di Python."""
    wb = _unduh(client, obe)
    f, t, u = wb["FORM NILAI"], wb["NILAI TUGAS IF"], wb["NILAI UTS"]
    from app.models.hasil_evaluasi import HasilEvaluasi

    hasil = {h.peserta_mata_kuliah.mahasiswa.nim: float(h.nilai_akhir) for h in db_session.query(HasilEvaluasi)}
    for row in range(10, 13):
        nim = f[f"B{row}"].value

        def jenis(ws):
            bobot = [ws["D9"].value, ws["E9"].value]
            nilai = [ws[f"D{row}"].value or 0, ws[f"E{row}"].value or 0]
            return sum(b * n for b, n in zip(bobot, nilai)) / sum(bobot), sum(bobot)

        (nt, bt), (nu, bu) = jenis(t), jenis(u)
        assert round((nt * bt + nu * bu) / 100, 2) == hasil[nim]
    # CPMK per mahasiswa ditulis dari hasil kalkulasi
    assert f["K7"].value == "Capaian CPMK (0-100)"
    assert (f["K8"].value, f["L8"].value) == ("CPMK1", "CPMK2")
    assert isinstance(f["K10"].value, float) and isinstance(f["L10"].value, float)


def test_remidi_dan_ringkasan_cpmk(client: TestClient, obe):
    wb = _unduh(client, obe)
    r = wb["REMIDI"]
    nama = [r[f"C{i}"].value for i in range(8, 12) if r[f"C{i}"].value]
    # Budi: nilai akhir >= 70 tetapi CPMK1 < 70 -> remidi; Citra < 70 -> tidak lulus, bukan remidi
    assert "Budi" in nama and "Citra" not in nama

    c = wb["CPMK"]
    assert c["D10"].value == "=IF('FORM NILAI'!K10=\"\",\"\",'FORM NILAI'!K10)"
    assert c["G10"].value.startswith("=IF(D10=\"\",\"\",LOOKUP(D10,PARAMETER!$B$9:$B$12,PARAMETER!$C$9:$C$12))")
    assert c["J8"].value == "CPMK1"
    assert c["L8"].value == '=IFERROR(AVERAGE($G$10:$G$12),"")'
    assert len(c._charts) == 2


def test_export_hak_akses(client: TestClient, obe):
    _unduh(client, obe, "kaprodi_a")
    _unduh(client, obe, "dekan")
    url = f"/api/v1/portofolio/{obe['mk'].id}/export"
    assert client.get(url, headers=auth_header(obe["dosen_b"])).status_code == 403
    assert client.get(url, headers=auth_header(obe["admin_a"])).status_code == 403


def test_evaluasi_simpan_saran_dan_masuk_export(client: TestClient, obe):
    mk_id = obe["mk"].id
    h = auth_header(obe["dosen_a"])
    data = client.get(f"/api/v1/portofolio/{mk_id}/evaluasi", headers=h).json()
    assert data["target_persen"] == 60.0 and data["skala_maks"] == 4
    item = {i["kode"]: i for i in data["items"]}
    assert item["CPMK1"]["jumlah_dinilai"] == 3

    ai_data = {"success": True, "data": {"evaluasi": [
        {"kode": "CPMK1", "analisis": "Analisis AI 1", "rencana_perbaikan": "Rencana AI 1"},
        {"kode": "CPMK2", "analisis": "Analisis AI 2", "rencana_perbaikan": "Rencana AI 2"},
    ]}}
    with patch("app.services.ai_client.generate_evaluasi_cpmk", new=AsyncMock(return_value=ai_data)) as mock:
        saran = client.post(f"/api/v1/portofolio/{mk_id}/evaluasi/saran", headers=h)
    assert saran.status_code == 200, saran.text
    kirim = mock.call_args.args[0]
    assert [c["kode"] for c in kirim["cpmk"]] == ["CPMK1", "CPMK2"]
    assert kirim["target_rerata_skala"] == 2.6
    assert saran.json()["items"][0]["analisis"] == "Analisis AI 1"
    # Saran belum tersimpan
    assert client.get(f"/api/v1/portofolio/{mk_id}/evaluasi", headers=h).json()["items"][0]["analisis"] is None

    simpan = client.put(f"/api/v1/portofolio/{mk_id}/evaluasi", headers=h, json={"items": [
        {"cpmk_id": obe["c1"].id, "analisis": "Analisis final", "rencana_perbaikan": "Rencana final"},
    ]})
    assert simpan.status_code == 200
    assert simpan.json()["items"][0]["analisis"] == "Analisis final"

    e = _unduh(client, obe)["EVALUASI"]
    assert (e["G8"].value, e["H8"].value) == ("Analisis final", "Rencana final")

    # Hak tulis hanya dosen pengampu
    k = auth_header(obe["kaprodi_a"])
    assert client.put(f"/api/v1/portofolio/{mk_id}/evaluasi", headers=k, json={"items": []}).status_code == 403
    assert client.post(f"/api/v1/portofolio/{mk_id}/evaluasi/saran", headers=k).status_code == 403
    # CPMK milik MK lain ditolak
    asing = client.put(f"/api/v1/portofolio/{mk_id}/evaluasi", headers=h, json={"items": [{"cpmk_id": 99999}]})
    assert asing.status_code == 400


def test_export_mata_kuliah_kosong_tidak_error(client: TestClient, audit_data):
    """Mata kuliah tanpa CPMK, bentuk penilaian, maupun nilai tetap bisa diexport."""
    res = client.get(f"/api/v1/portofolio/{audit_data['mk_a'].id}/export", headers=auth_header(audit_data["dosen_a"]))
    assert res.status_code == 200, res.text
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    assert "FORM NILAI" in wb.sheetnames and "EVALUASI" in wb.sheetnames


def test_saran_ai_butuh_nilai(client: TestClient, audit_data, db_session: Session):
    mk = audit_data["mk_a"]
    db_session.add(CPMK(mata_kuliah_id=mk.id, kode="CPMK1", deskripsi="x", bobot=100))
    db_session.commit()
    res = client.post(f"/api/v1/portofolio/{mk.id}/evaluasi/saran", headers=auth_header(audit_data["dosen_a"]))
    assert res.status_code == 422


def test_preview_export_sama_dengan_file(client: TestClient, obe):
    """Ringkasan sebelum unduh: sheet sama persis dengan file, angka & kelengkapan dihitung server."""
    url = f"/api/v1/portofolio/{obe['mk'].id}/export/preview"
    res = client.get(url, headers=auth_header(obe["dosen_a"]))
    assert res.status_code == 200, res.text
    data = res.json()

    wb = _unduh(client, obe)
    assert [s["nama"] for s in data["sheets"]] == wb.sheetnames
    assert data["nama_file"].startswith("Portofolio IF101 Algoritma")

    r = data["ringkasan"]
    assert r["jumlah_mahasiswa"] == 3 and r["jumlah_dinilai"] == 3
    assert r["jumlah_cpmk"] == 2 and r["jumlah_remidi"] >= 1  # Budi remidi CPMK1
    assert sum(r["sebaran_huruf"].values()) == 3

    sheet = {s["nama"]: s for s in data["sheets"]}
    assert sheet["CPMK-CPL"]["status"] == "lengkap"
    assert sheet["KONTRAK"]["status"] == "perlu_dilengkapi"   # info portofolio belum diisi
    assert sheet["EVALUASI"]["status"] == "perlu_dilengkapi"  # analisis belum diisi
    assert sheet["NILAI UTS"]["isi"].startswith("Nilai UTS: 1 bentuk penilaian, 2 kolom IK")
    assert data["jumlah_perlu_dilengkapi"] == sum(1 for s in data["sheets"] if s["status"] != "lengkap")

    # Hak akses sama dengan unduh
    assert client.get(url, headers=auth_header(obe["kaprodi_a"])).status_code == 200
    assert client.get(url, headers=auth_header(obe["dosen_b"])).status_code == 403
    assert client.get(url, headers=auth_header(obe["admin_a"])).status_code == 403


def test_preview_export_mata_kuliah_kosong(client: TestClient, audit_data):
    res = client.get(f"/api/v1/portofolio/{audit_data['mk_a'].id}/export/preview", headers=auth_header(audit_data["dosen_a"]))
    assert res.status_code == 200, res.text
    sheet = {s["nama"]: s for s in res.json()["sheets"]}
    assert sheet["CPMK-CPL"]["status"] == "kosong"
