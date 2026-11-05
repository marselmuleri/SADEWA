import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models import (
    Fakultas, ProgramStudi, User, KurikulumVersion, MataKuliah,
    PengampuMataKuliah, CPMK, JenisEvaluasi, BentukPenilaian,
    MKBentukPenilaian, Mahasiswa, PesertaMataKuliah, CPL, IK,
    NilaiBentukPenilaian, HasilEvaluasi
)
from app.models.enums import UserRole, StatusKurikulum, SemesterEnum, StatusMasuk
from tests.conftest import TestingSessionLocal


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def auth_header(user: User) -> dict:
    token = create_access_token(data={"sub": user.email, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def audit_data(db_session: Session):
    # Fakultas & 2 Prodi
    fakultas = Fakultas(nama="Fakultas Teknik", kode="FT")
    db_session.add(fakultas)
    db_session.flush()

    prodi_a = ProgramStudi(nama="Informatika", kode="IF", fakultas_id=fakultas.id)
    prodi_b = ProgramStudi(nama="Teknik Elektro", kode="EL", fakultas_id=fakultas.id)
    db_session.add_all([prodi_a, prodi_b])
    db_session.flush()

    # Users
    admin_a = User(nama="Admin A", email="admin_a@test.com", password_hash="x", role=UserRole.admin_prodi, program_studi_id=prodi_a.id, is_active=True)
    dosen_a = User(nama="Dosen A", email="dosen_a@test.com", password_hash="x", role=UserRole.dosen, program_studi_id=prodi_a.id, is_active=True)
    dosen_b = User(nama="Dosen B", email="dosen_b@test.com", password_hash="x", role=UserRole.dosen, program_studi_id=prodi_b.id, is_active=True)
    db_session.add_all([admin_a, dosen_a, dosen_b])
    db_session.flush()

    # Kurikulum
    kur_a = KurikulumVersion(program_studi_id=prodi_a.id, version_label="2025-IF", semester=SemesterEnum.ganjil, status=StatusKurikulum.published)
    kur_b = KurikulumVersion(program_studi_id=prodi_b.id, version_label="2025-EL", semester=SemesterEnum.ganjil, status=StatusKurikulum.published)
    db_session.add_all([kur_a, kur_b])
    db_session.flush()

    # MK
    mk_a = MataKuliah(
        kurikulum_version_id=kur_a.id, kode="IF101", nama="Algoritma", sks=3,
        semester=SemesterEnum.ganjil, tahun_ajaran="2025/2026", program_studi_id=prodi_a.id,
    )
    mk_b = MataKuliah(
        kurikulum_version_id=kur_b.id, kode="EL101", nama="Rangkaian Listrik", sks=3,
        semester=SemesterEnum.ganjil, tahun_ajaran="2025/2026", program_studi_id=prodi_b.id,
    )
    db_session.add_all([mk_a, mk_b])
    db_session.flush()

    # Pengampu
    pengampu_a = PengampuMataKuliah(mata_kuliah_id=mk_a.id, user_id=dosen_a.id, is_koordinator=True)
    pengampu_b = PengampuMataKuliah(mata_kuliah_id=mk_b.id, user_id=dosen_b.id, is_koordinator=True)
    db_session.add_all([pengampu_a, pengampu_b])
    db_session.flush()

    # Jenis Evaluasi & Bentuk Penilaian
    je_a = JenisEvaluasi(program_studi_id=prodi_a.id, nama="Tugas IF", urutan=1, bobot=100)
    je_b = JenisEvaluasi(program_studi_id=prodi_b.id, nama="Tugas EL", urutan=1, bobot=100)
    db_session.add_all([je_a, je_b])
    db_session.flush()

    bp_a = BentukPenilaian(jenis_evaluasi_id=je_a.id, nama="Tugas 1 IF")
    bp_b = BentukPenilaian(jenis_evaluasi_id=je_b.id, nama="Tugas 1 EL")
    db_session.add_all([bp_a, bp_b])
    db_session.flush()

    # Mahasiswa
    mhs_a = Mahasiswa(nim="2201001", nama="Mhs IF", semester_aktif=1, program_studi_id=prodi_a.id, status_masuk=StatusMasuk.reguler)
    db_session.add(mhs_a)
    db_session.flush()

    # Peserta MK agar dashboard/{matkul_id} bisa diakses
    peserta_a = PesertaMataKuliah(mata_kuliah_id=mk_a.id, mahasiswa_id=mhs_a.id, kelas="A")
    db_session.add(peserta_a)
    db_session.flush()

    db_session.commit()

    return {
        "fakultas": fakultas,
        "prodi_a": prodi_a,
        "prodi_b": prodi_b,
        "admin_a": admin_a,
        "dosen_a": dosen_a,
        "dosen_b": dosen_b,
        "kur_a": kur_a,
        "kur_b": kur_b,
        "mk_a": mk_a,
        "mk_b": mk_b,
        "je_a": je_a,
        "je_b": je_b,
        "bp_a": bp_a,
        "bp_b": bp_b,
        "mhs_a": mhs_a,
    }


def test_dosen_scope_filtering(client: TestClient, audit_data: dict, db_session: Session):
    """Pastikan Dosen hanya dapat melihat mata kuliah yang diampunya saja."""
    dosen_a = audit_data["dosen_a"]
    headers = auth_header(dosen_a)
    kur_a = audit_data["kur_a"]
    prodi_a = audit_data["prodi_a"]

    # Buat MK kedua di prodi A yang TIDAK diampu oleh dosen_a
    mk_a2 = MataKuliah(
        kurikulum_version_id=kur_a.id, kode="IF102", nama="Struktur Data", sks=3,
        semester=SemesterEnum.ganjil, tahun_ajaran="2025/2026", program_studi_id=prodi_a.id,
    )
    db_session.add(mk_a2)
    db_session.commit()

    # 1. Mata Kuliah: hanya mata kuliah yang diampu (IF101) yang muncul
    res_mk = client.get("/api/v1/mata-kuliah", headers=headers)
    assert res_mk.status_code == 200
    mks = res_mk.json()
    kodes = [m["kode"] for m in mks]
    assert "IF101" in kodes
    assert "IF102" not in kodes  # MK prodi sama tapi tidak diampu TIDAK boleh muncul
    assert "EL101" not in kodes  # MK prodi lain TIDAK boleh muncul

    # Akses detail MK yang tidak diampu harus ditolak 403
    res_detail = client.get(f"/api/v1/mata-kuliah/{mk_a2.id}", headers=headers)
    assert res_detail.status_code == 403

    # 2. Jenis Evaluasi
    res_je = client.get("/api/v1/jenis-evaluasi", headers=headers)
    assert res_je.status_code == 200
    jes = res_je.json()
    je_names = [j["nama"] for j in jes]
    assert "Tugas IF" in je_names
    assert "Tugas EL" not in je_names

    # 3. Bentuk Penilaian
    res_bp = client.get("/api/v1/bentuk-penilaian", headers=headers)
    assert res_bp.status_code == 200
    bps = res_bp.json()
    bp_names = [b["nama"] for b in bps]
    assert "Tugas 1 IF" in bp_names
    assert "Tugas 1 EL" not in bp_names


def test_dosen_self_service_endpoints(client: TestClient, audit_data: dict):
    """Pastikan endpoint /mata-kuliah/saya dan /laporan/saya bekerja untuk Dosen."""
    dosen_a = audit_data["dosen_a"]
    headers = auth_header(dosen_a)

    # /mata-kuliah/saya
    res = client.get("/api/v1/mata-kuliah/saya", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["kode"] == "IF101"

    # /laporan/saya
    res_lap = client.get("/api/v1/laporan/saya", headers=headers)
    assert res_lap.status_code == 200
    assert isinstance(res_lap.json(), list)

    # /dashboard/{matkul_id}
    mk_a = audit_data["mk_a"]
    res_dash = client.get(f"/api/v1/dashboard/{mk_a.id}", headers=headers)
    assert res_dash.status_code == 200


def test_single_ketua_atomic_demotion(client: TestClient, audit_data: dict, db_session: Session):
    """Pastikan hanya ada tepat satu koordinator/ketua per mata kuliah."""
    admin_a = audit_data["admin_a"]
    mk_a = audit_data["mk_a"]
    headers = auth_header(admin_a)

    # Buat dosen kedua di prodi A
    dosen_a2 = User(nama="Dosen A2", email="dosen_a2@test.com", password_hash="x", role=UserRole.dosen, program_studi_id=audit_data["prodi_a"].id, is_active=True)
    db_session.add(dosen_a2)
    db_session.commit()

    # Assign dosen_a2 sebagai koordinator
    payload = {
        "mata_kuliah_id": mk_a.id,
        "user_id": dosen_a2.id,
        "is_koordinator": True
    }
    res = client.post("/api/v1/pengampu-mata-kuliah", json=payload, headers=headers)
    assert res.status_code in (200, 201)

    # Cek di database: dosen_a harus sudah bukan koordinator lagi (demoted)
    pengampus = db_session.query(PengampuMataKuliah).filter(PengampuMataKuliah.mata_kuliah_id == mk_a.id).all()
    koordinators = [p for p in pengampus if str(p.is_koordinator) in ("1", "True")]
    assert len(koordinators) == 1
    assert koordinators[0].user_id == dosen_a2.id


def test_duplicate_prevention(client: TestClient, audit_data: dict):
    """Pastikan duplikasi entitas dicegah dengan HTTP 400."""
    admin_a = audit_data["admin_a"]
    headers = auth_header(admin_a)
    prodi_a = audit_data["prodi_a"]
    kur_a = audit_data["kur_a"]
    je_a = audit_data["je_a"]

    # 1. Mahasiswa NIM duplikat
    res_mhs = client.post("/api/v1/mahasiswa", json={
        "nim": "2201001",  # Sudah ada di fixture
        "nama": "Duplikat",
        "semester_aktif": 1,
        "program_studi_id": prodi_a.id,
        "status_masuk": "Reguler"
    }, headers=headers)
    assert res_mhs.status_code == 400
    assert "sudah terdaftar" in res_mhs.json()["detail"].lower()

    # 2. Mata Kuliah kode duplikat
    res_mk = client.post("/api/v1/mata-kuliah", json={
        "kurikulum_version_id": kur_a.id,
        "kode": "IF101",  # Sudah ada
        "nama": "MK Duplikat",
        "sks": 3,
        "semester": "Ganjil",
        "tahun_ajaran": "2025/2026"
    }, headers=headers)
    assert res_mk.status_code == 400
    assert "sudah ada" in res_mk.json()["detail"].lower()

    # 3. Jenis Evaluasi nama duplikat
    res_je = client.post("/api/v1/jenis-evaluasi", json={
        "program_studi_id": prodi_a.id,
        "nama": "Tugas IF",  # Sudah ada
        "urutan": 2
    }, headers=headers)
    assert res_je.status_code == 400
    assert "sudah ada" in res_je.json()["detail"].lower()

    # 4. Bentuk Penilaian nama duplikat
    res_bp = client.post("/api/v1/bentuk-penilaian", json={
        "jenis_evaluasi_id": je_a.id,
        "nama": "Tugas 1 IF"  # Sudah ada
    }, headers=headers)
    assert res_bp.status_code == 400
    assert "sudah ada" in res_bp.json()["detail"].lower()


def test_mahasiswa_angkatan_derivation(client: TestClient, audit_data: dict):
    """Pastikan angkatan mahasiswa diturunkan otomatis dari 2 digit awal NIM jika tidak diberikan."""
    admin_a = audit_data["admin_a"]
    headers = auth_header(admin_a)
    prodi_a = audit_data["prodi_a"]

    res = client.post("/api/v1/mahasiswa", json={
        "nim": "2401099",
        "nama": "Mhs Angkatan 2024",
        "semester_aktif": 1,
        "program_studi_id": prodi_a.id,
        "status_masuk": "Reguler"
    }, headers=headers)
    assert res.status_code in (200, 201)
    data = res.json()
    assert data["angkatan"] == 2024


def test_batch_import_mahasiswa_and_peserta(client: TestClient, audit_data: dict):
    """Pastikan batch import mahasiswa dan peserta mata kuliah bekerja."""
    admin_a = audit_data["admin_a"]
    headers = auth_header(admin_a)
    prodi_a = audit_data["prodi_a"]
    mk_a = audit_data["mk_a"]

    # 1. Batch Mahasiswa
    payload_mhs = {
        "records": [
            {"nim": "2301011", "nama": "Batch 1", "semester_aktif": 1, "program_studi_id": prodi_a.id, "status_masuk": "Reguler"},
            {"nim": "2301012", "nama": "Batch 2", "semester_aktif": 1, "program_studi_id": prodi_a.id, "status_masuk": "Reguler"}
        ]
    }
    res_mhs = client.post("/api/v1/mahasiswa/batch", json=payload_mhs, headers=headers)
    assert res_mhs.status_code in (200, 201)
    created_mhs = res_mhs.json()
    assert len(created_mhs) == 2
    assert created_mhs[0]["angkatan"] == 2023

    # 2. Batch Peserta Mata Kuliah
    mhs_ids = [m["id"] for m in created_mhs]
    payload_peserta = {
        "mata_kuliah_id": mk_a.id,
        "records": [
            {"mahasiswa_id": mhs_ids[0], "kelas": "A"},
            {"mahasiswa_id": mhs_ids[1], "kelas": "A"}
        ]
    }
    res_peserta = client.post("/api/v1/peserta-mata-kuliah/batch", json=payload_peserta, headers=headers)
    assert res_peserta.status_code in (200, 201)
    created_peserta = res_peserta.json()
    assert len(created_peserta) == 2


def test_delete_protection_and_endpoints(client: TestClient, audit_data: dict, db_session: Session):
    """Pastikan perlindungan penghapusan data berelasi menghasilkan HTTP 409."""
    admin_a = audit_data["admin_a"]
    headers = auth_header(admin_a)
    mk_a = audit_data["mk_a"]
    je_a = audit_data["je_a"]
    bp_a = audit_data["bp_a"]

    # 1. Hapus Jenis Evaluasi yang punya Bentuk Penilaian -> 409
    res_del_je = client.delete(f"/api/v1/jenis-evaluasi/{je_a.id}", headers=headers)
    assert res_del_je.status_code == 409

    # 2. Tambah CPMK ke mk_a lalu hapus Mata Kuliah -> 409
    cpmk = CPMK(mata_kuliah_id=mk_a.id, kode="CPMK-IF1", deskripsi="Desc", bobot=100)
    db_session.add(cpmk)
    db_session.commit()

    res_del_mk = client.delete(f"/api/v1/mata-kuliah/{mk_a.id}", headers=headers)
    assert res_del_mk.status_code == 409

    # 3. Pasang Bentuk Penilaian ke MKBentukPenilaian lalu hapus Bentuk Penilaian -> 409
    mbp = MKBentukPenilaian(mata_kuliah_id=mk_a.id, bentuk_penilaian_id=bp_a.id, bobot=100)
    db_session.add(mbp)
    db_session.commit()

    res_del_bp = client.delete(f"/api/v1/bentuk-penilaian/{bp_a.id}", headers=headers)
    assert res_del_bp.status_code == 409


def test_seed_data_siap_dinilai_dan_kalkulasi_langsung(client: TestClient, db_session: Session):
    """
    Menguji bahwa:
    1. Data seed memiliki total bobot 100% dan bebas issue siap dinilai.
    2. Nilai mentah tersimpan di NilaiBentukPenilaian dan capaian langsung terhitung.
    3. Dosen hanya melihat mata kuliah yang diampunya saja.
    4. Perhitungan ulang (run kalkulasi) dapat dipanggil langsung dari data seed.
    """
    from app.core.seed import seed
    from app.services.calculation.engine import cek_siap_dinilai

    result = seed(db_session)
    assert "Seed sukses" in result["message"]

    # 1. Cek semua mata kuliah seed: syarat siap dinilai terpenuhi 100%
    mks = db_session.query(MataKuliah).all()
    assert len(mks) == 4
    for mk in mks:
        issues = cek_siap_dinilai(db_session, mk.id)
        assert issues == [], f"Mata kuliah {mk.kode} memiliki issue: {issues}"

    # 2. Nilai mentah di tabel NilaiBentukPenilaian dan capaian awal langsung terisi
    total_nilai = db_session.query(NilaiBentukPenilaian).count()
    assert total_nilai > 0
    total_hasil = db_session.query(HasilEvaluasi).count()
    assert total_hasil > 0

    # 3. Dosen IF hanya melihat mata kuliah yang diampunya
    dosen_if = db_session.query(User).filter(User.email == "dosen@sadewa.ac.id").first()
    h_dosen_if = auth_header(dosen_if)
    res_mk_if = client.get("/api/v1/mata-kuliah", headers=h_dosen_if)
    assert res_mk_if.status_code == 200
    kodes_if = [m["kode"] for m in res_mk_if.json()]
    assert set(kodes_if) == {"IF201", "IF202", "IF203"}
    assert "EL101" not in kodes_if

    # 4. Dosen EL hanya melihat EL101
    dosen_el = db_session.query(User).filter(User.email == "dosen_el@sadewa.ac.id").first()
    h_dosen_el = auth_header(dosen_el)
    res_mk_el = client.get("/api/v1/mata-kuliah", headers=h_dosen_el)
    assert res_mk_el.status_code == 200
    kodes_el = [m["kode"] for m in res_mk_el.json()]
    assert kodes_el == ["EL101"]

    # 5. Dosen IF dapat langsung menjalankan kalkulasi ulang tanpa error
    mk_if201 = db_session.query(MataKuliah).filter(MataKuliah.kode == "IF201").first()
    res_calc = client.post(f"/api/v1/kalkulasi/run/{mk_if201.id}", headers=h_dosen_if)
    assert res_calc.status_code == 200
    data_calc = res_calc.json()
    assert data_calc["mata_kuliah_id"] == mk_if201.id
    assert data_calc["jumlah_peserta_diproses"] == 20
