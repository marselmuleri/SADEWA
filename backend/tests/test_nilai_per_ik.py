"""
Test Spesifikasi OBE: T3 Model Nilai Mahasiswa per IK.

Keputusan Pemilik Project & Spesifikasi:
1. Nilai mahasiswa diinput PER IK: satu nilai 0 sampai 100 untuk kombinasi
   (peserta mata kuliah, bentuk penilaian kelas, IK). Kombinasi ini unik.
2. Hanya IK yang bobot selnya pada matriks bentuk penilaian itu > 0 yang boleh dinilai.
3. Nilai input harus dalam rentang 0 sampai 100 (C8). Nilai < 0 atau > 100 ditolak.
"""

from decimal import Decimal
import pytest


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_obe_kelas(client):
    # Setup Super Admin
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin",
        "email": "sa_nilai@undip.ac.id",
        "password": "password123",
    })
    sa_token = _login(client, "sa_nilai@undip.ac.id", "password123")

    fak = client.post("/api/v1/fakultas", json={"nama": "Fakultas Teknik", "kode": "FT"}, headers=_auth_headers(sa_token)).json()
    prodi = client.post("/api/v1/prodi", json={"nama": "Informatika", "kode": "IF", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()

    # Admin Prodi
    client.post("/api/v1/users", json={
        "nama": "Admin IF",
        "email": "admin_if_nilai@undip.ac.id",
        "password": "password123",
        "role": "admin_prodi",
        "program_studi_id": prodi["id"],
    }, headers=_auth_headers(sa_token))
    admin_token = _login(client, "admin_if_nilai@undip.ac.id", "password123")

    # Dosen Pengampu
    client.post("/api/v1/users", json={
        "nama": "Dosen Pengampu",
        "email": "dosen_pengampu@undip.ac.id",
        "password": "password123",
        "role": "dosen",
        "program_studi_id": prodi["id"],
    }, headers=_auth_headers(admin_token))
    dosen_token = _login(client, "dosen_pengampu@undip.ac.id", "password123")

    # Kurikulum & MK
    kur = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024", "semester": "Ganjil"}, headers=_auth_headers(admin_token)).json()
    mk = client.post("/api/v1/mata-kuliah", json={
        "kurikulum_version_id": kur["id"],
        "kode": "IF201",
        "nama": "Algoritma Pemrograman",
        "sks": 3,
        "semester": "Ganjil",
        "tahun_ajaran": "2025/2026",
    }, headers=_auth_headers(admin_token)).json()

    # Assign Dosen Pengampu
    dosen_user = [u for u in client.get("/api/v1/users", headers=_auth_headers(admin_token)).json() if u["email"] == "dosen_pengampu@undip.ac.id"][0]
    client.post("/api/v1/pengampu-mata-kuliah", json={
        "mata_kuliah_id": mk["id"],
        "user_id": dosen_user["id"],
        "is_koordinator": True,
    }, headers=_auth_headers(admin_token))

    # CPL & IK
    cpl1 = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur["id"], "kode": "CPL1", "deskripsi": "Kompetensi 1"}, headers=_auth_headers(admin_token)).json()
    ik1a = client.post("/api/v1/ik", json={"cpl_id": cpl1["id"], "kode": "IK1a", "deskripsi": "Indikator 1a"}, headers=_auth_headers(admin_token)).json()
    ik1b = client.post("/api/v1/ik", json={"cpl_id": cpl1["id"], "kode": "IK1b", "deskripsi": "Indikator 1b"}, headers=_auth_headers(admin_token)).json()

    # CPMK
    cpmk1 = client.post("/api/v1/cpmk", json={"mata_kuliah_id": mk["id"], "kode": "CPMK1", "deskripsi": "CPMK 1", "level_taksonomi": "C3", "bobot": 100}, headers=_auth_headers(admin_token)).json()
    client.put(f"/api/v1/cpmk/{cpmk1['id']}/map-ik", json={"mappings": [
        {"ik_id": ik1a["id"], "bobot": 50},
        {"ik_id": ik1b["id"], "bobot": 50},
    ]}, headers=_auth_headers(admin_token))

    # Jenis Evaluasi & Bentuk Penilaian
    je = client.post("/api/v1/jenis-evaluasi", json={"nama": "Formatif", "urutan": 1}, headers=_auth_headers(admin_token)).json()
    bp_tugas = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je["id"], "nama": "Tugas"}, headers=_auth_headers(admin_token)).json()

    # MK Bentuk Penilaian Kelas (Tugas: bobot 100%)
    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={
        "mata_kuliah_id": mk["id"],
        "bentuk_penilaian_id": bp_tugas["id"],
        "bobot": 100,
        "semester": "Ganjil",
    }, headers=_auth_headers(dosen_token)).json()

    # Matriks setting bobot: Tugas memetakan IK1a bobot 50, IK1b bobot 50
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp['id']}/map-ik", json={"mappings": [
        {"ik_id": ik1a["id"], "bobot": 50},
        {"ik_id": ik1b["id"], "bobot": 50},
    ]}, headers=_auth_headers(dosen_token))

    # Mahasiswa & Peserta
    mhs = client.post("/api/v1/mahasiswa", json={
        "nim": "24060120120002",
        "nama": "Citra Lestari",
        "semester_aktif": 1,
        "status_masuk": "Reguler",
    }, headers=_auth_headers(admin_token)).json()

    peserta = client.post("/api/v1/peserta-mata-kuliah", json={
        "mata_kuliah_id": mk["id"],
        "mahasiswa_id": mhs["id"],
        "kelas": "A",
    }, headers=_auth_headers(admin_token)).json()

    return {
        "admin_token": admin_token,
        "dosen_token": dosen_token,
        "kur": kur,
        "mk": mk,
        "mbp": mbp,
        "ik1a": ik1a,
        "ik1b": ik1b,
        "peserta": peserta,
    }


def test_input_nilai_per_ik_berhasil(client):
    """
    Menyimpan nilai untuk (peserta, bentuk_penilaian, IK) berbeda pada bentuk yang sama berhasil.
    Misal pada Tugas: IK1a = 85.0 dan IK1b = 90.0.
    """
    env = _setup_obe_kelas(client)
    dosen_token = env["dosen_token"]
    mk_id = env["mk"]["id"]
    mbp_id = env["mbp"]["id"]
    peserta_id = env["peserta"]["id"]
    ik1a_id = env["ik1a"]["id"]
    ik1b_id = env["ik1b"]["id"]

    resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id,
        "semester": "Ganjil",
        "records": [
            {"peserta_mata_kuliah_id": peserta_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik1a_id, "nilai": 85.0},
            {"peserta_mata_kuliah_id": peserta_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik1b_id, "nilai": 90.0},
        ]
    }, headers=_auth_headers(dosen_token))

    # Berhasil menyimpan dua entri nilai per IK
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    # Field ik_id harus ada pada respon nilai OBE
    assert any(d.get("ik_id") == ik1a_id for d in data)
    assert any(d.get("ik_id") == ik1b_id for d in data)


def test_duplikat_nilai_kombinasi_peserta_bentuk_ik_ditolak(client):
    """
    Duplikat kombinasi (peserta, mk_bentuk_penilaian, IK) harus ditolak (400 Bad Request).
    """
    env = _setup_obe_kelas(client)
    dosen_token = env["dosen_token"]
    mk_id = env["mk"]["id"]
    mbp_id = env["mbp"]["id"]
    peserta_id = env["peserta"]["id"]
    ik1a_id = env["ik1a"]["id"]

    resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id,
        "semester": "Ganjil",
        "records": [
            {"peserta_mata_kuliah_id": peserta_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik1a_id, "nilai": 80.0},
            {"peserta_mata_kuliah_id": peserta_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik1a_id, "nilai": 85.0},
        ]
    }, headers=_auth_headers(dosen_token))

    assert resp.status_code == 400


def test_nilai_ik_bobot_sel_nol_atau_tidak_di_matriks_ditolak(client):
    """
    Hanya IK yang bobot selnya pada matriks bentuk penilaian itu > 0 yang boleh dinilai.
    IK yang tidak ada di matriks bentuk penilaian harus ditolak (400 Bad Request).
    """
    env = _setup_obe_kelas(client)
    dosen_token = env["dosen_token"]
    admin_token = env["admin_token"]
    mk_id = env["mk"]["id"]
    mbp_id = env["mbp"]["id"]
    peserta_id = env["peserta"]["id"]
    kur_id = env["kur"]["id"]

    # Buat IK baru yang tidak masuk dalam matriks Tugas
    cpl_lain = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur_id, "kode": "CPL99", "deskripsi": "Lain"}, headers=_auth_headers(admin_token)).json()
    ik_asing = client.post("/api/v1/ik", json={"cpl_id": cpl_lain["id"], "kode": "IK99z", "deskripsi": "Asing"}, headers=_auth_headers(admin_token)).json()

    resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id,
        "semester": "Ganjil",
        "records": [
            {"peserta_mata_kuliah_id": peserta_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik_asing["id"], "nilai": 80.0},
        ]
    }, headers=_auth_headers(dosen_token))

    assert resp.status_code == 400


def test_nilai_di_luar_rentang_0_sampai_100_ditolak(client):
    """
    Nilai < 0 atau > 100 ditolak (C8) di level API.
    """
    env = _setup_obe_kelas(client)
    dosen_token = env["dosen_token"]
    mk_id = env["mk"]["id"]
    mbp_id = env["mbp"]["id"]
    peserta_id = env["peserta"]["id"]
    ik1a_id = env["ik1a"]["id"]

    # Nilai di atas 100 (misal 105)
    resp_over = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id,
        "semester": "Ganjil",
        "records": [
            {"peserta_mata_kuliah_id": peserta_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik1a_id, "nilai": 105.0},
        ]
    }, headers=_auth_headers(dosen_token))
    assert resp_over.status_code in (400, 422)

    # Nilai negatif (misal -10)
    resp_under = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id,
        "semester": "Ganjil",
        "records": [
            {"peserta_mata_kuliah_id": peserta_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik1a_id, "nilai": -10.0},
        ]
    }, headers=_auth_headers(dosen_token))
    assert resp_under.status_code in (400, 422)
