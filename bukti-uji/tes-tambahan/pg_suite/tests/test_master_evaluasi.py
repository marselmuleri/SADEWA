import pytest
from app.models.enums import UserRole, SemesterEnum


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_master_data(client):
    # Register Super Admin
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin",
        "email": "superadmin@undip.ac.id",
        "password": "password123",
    })
    sa_token = _login(client, "superadmin@undip.ac.id", "password123")

    # Fakultas & Prodi
    fak = client.post("/api/v1/fakultas", json={"nama": "Fakultas Teknik", "kode": "FT"}, headers=_auth_headers(sa_token)).json()
    prodi_if = client.post("/api/v1/prodi", json={"nama": "Informatika", "kode": "IF", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()
    prodi_el = client.post("/api/v1/prodi", json={"nama": "Teknik Elektro", "kode": "EL", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()

    # Admin Prodi IF
    client.post("/api/v1/users", json={
        "nama": "Admin IF",
        "email": "admin_if@undip.ac.id",
        "password": "password123",
        "role": "admin_prodi",
        "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(sa_token))
    admin_if_token = _login(client, "admin_if@undip.ac.id", "password123")

    # Dosen IF
    client.post("/api/v1/users", json={
        "nama": "Dosen IF",
        "email": "dosen_if@undip.ac.id",
        "password": "password123",
        "role": "dosen",
        "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(admin_if_token))
    dosen_if_token = _login(client, "dosen_if@undip.ac.id", "password123")

    # Kurikulum & Mata Kuliah IF
    kur = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024", "semester": "Ganjil"}, headers=_auth_headers(admin_if_token)).json()
    mk = client.post("/api/v1/mata-kuliah", json={
        "kurikulum_version_id": kur["id"],
        "kode": "IF101",
        "nama": "Pemrograman Dasar",
        "sks": 3,
        "semester": "Ganjil",
        "tahun_ajaran": "2025/2026",
    }, headers=_auth_headers(admin_if_token)).json()

    # Mahasiswa
    mhs = client.post("/api/v1/mahasiswa", json={
        "nim": "24060120120001",
        "nama": "Budi Santoso",
        "semester_aktif": 1,
        "status_masuk": "Reguler",
    }, headers=_auth_headers(admin_if_token)).json()

    return {
        "sa_token": sa_token,
        "admin_if_token": admin_if_token,
        "dosen_if_token": dosen_if_token,
        "prodi_if": prodi_if,
        "prodi_el": prodi_el,
        "mk": mk,
        "mhs": mhs,
    }


def test_bentuk_penilaian_crud(client):
    data = _setup_master_data(client)
    admin_token = data["admin_if_token"]

    # 1. Buat Jenis Evaluasi
    je = client.post("/api/v1/jenis-evaluasi", json={
        "nama": "Evaluasi Formatif",
        "urutan": 1,
    }, headers=_auth_headers(admin_token)).json()
    assert je["nama"] == "Evaluasi Formatif"

    # 2. Buat Bentuk Penilaian di bawah Jenis Evaluasi tersebut
    bp = client.post("/api/v1/bentuk-penilaian", json={
        "jenis_evaluasi_id": je["id"],
        "nama": "Tugas Mingguan",
    }, headers=_auth_headers(admin_token)).json()
    assert bp["nama"] == "Tugas Mingguan"
    assert bp["jenis_evaluasi_id"] == je["id"]

    # 3. List Bentuk Penilaian
    list_bp = client.get("/api/v1/bentuk-penilaian", headers=_auth_headers(admin_token)).json()
    assert len(list_bp) >= 1
    assert any(b["nama"] == "Tugas Mingguan" for b in list_bp)

    # 4. Update Bentuk Penilaian
    updated = client.put(f"/api/v1/bentuk-penilaian/{bp['id']}", json={
        "nama": "Tugas Mandiri",
    }, headers=_auth_headers(admin_token)).json()
    assert updated["nama"] == "Tugas Mandiri"


def test_peserta_mata_kuliah_crud(client):
    data = _setup_master_data(client)
    admin_token = data["admin_if_token"]
    mk_id = data["mk"]["id"]
    mhs_id = data["mhs"]["id"]

    # 1. Daftarkan mahasiswa ke mata kuliah
    peserta = client.post("/api/v1/peserta-mata-kuliah", json={
        "mata_kuliah_id": mk_id,
        "mahasiswa_id": mhs_id,
        "kelas": "A",
    }, headers=_auth_headers(admin_token)).json()
    assert peserta["mata_kuliah_id"] == mk_id
    assert peserta["mahasiswa_id"] == mhs_id
    assert peserta["kelas"] == "A"

    # 2. Duplikat ditolak dengan 400
    dup_resp = client.post("/api/v1/peserta-mata-kuliah", json={
        "mata_kuliah_id": mk_id,
        "mahasiswa_id": mhs_id,
        "kelas": "A",
    }, headers=_auth_headers(admin_token))
    assert dup_resp.status_code == 400

    # 3. List peserta
    peserta_list = client.get(f"/api/v1/peserta-mata-kuliah?mata_kuliah_id={mk_id}", headers=_auth_headers(admin_token)).json()
    assert len(peserta_list) == 1
    assert peserta_list[0]["id"] == peserta["id"]

    # 4. Hapus peserta
    del_resp = client.delete(f"/api/v1/peserta-mata-kuliah/{peserta['id']}", headers=_auth_headers(admin_token))
    assert del_resp.status_code == 200


def test_kalkulasi_authorization(client):
    data = _setup_master_data(client)
    dosen_token = data["dosen_if_token"]
    mk_id = data["mk"]["id"]

    # 1. Validasi bobot endpoint
    val_resp = client.post(f"/api/v1/kalkulasi/validasi-bobot?mata_kuliah_id={mk_id}", headers=_auth_headers(dosen_token))
    assert val_resp.status_code == 200
    assert "valid" in val_resp.json()

    # 2. Dosen bukan pengampu ditolak saat run kalkulasi (403)
    run_resp = client.post(f"/api/v1/kalkulasi/run/{mk_id}", headers=_auth_headers(dosen_token))
    assert run_resp.status_code == 403
