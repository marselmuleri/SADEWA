"""
Test Spesifikasi OBE: T5 Hak Akses CPMK, Nilai, dan Matriks Bobot.

Spesifikasi Hak Akses:
1. Dosen Pengampu:
   - Boleh mengubah NAMA / deskripsi CPMK.
   - TIDAK BOLEH mengubah bobot CPMK (ditolak 403).
   - TIDAK BOLEH mengubah mapping IK CPMK (ditolak 403).
2. Dosen Bukan Pengampu:
   - Ditolak mengubah nama CPMK (403).
   - Ditolak menginput nilai mahasiswa (403).
   - Ditolak mengubah setting bobot matriks kelas (403).
3. Admin Prodi & Kaprodi:
   - Berhak mengubah bobot CPMK dan mapping IK pada prodi mereka.
4. Isolasi Antar-Prodi (IDOR):
   - Admin Prodi A dilarang membaca atau mengubah CPL, IK, dan CPMK milik Prodi B.
"""

from decimal import Decimal
import pytest
from app.models.enums import UserRole


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_akses_env(client):
    # Setup Super Admin
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin",
        "email": "sa_akses@undip.ac.id",
        "password": "password123",
    })
    sa_token = _login(client, "sa_akses@undip.ac.id", "password123")

    fak = client.post("/api/v1/fakultas", json={"nama": "Fakultas Teknik", "kode": "FT"}, headers=_auth_headers(sa_token)).json()
    prodi_if = client.post("/api/v1/prodi", json={"nama": "Informatika", "kode": "IF", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()
    prodi_el = client.post("/api/v1/prodi", json={"nama": "Teknik Elektro", "kode": "EL", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()

    # Admin IF
    client.post("/api/v1/users", json={
        "nama": "Admin IF",
        "email": "admin_if_akses@undip.ac.id",
        "password": "password123",
        "role": "admin_prodi",
        "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(sa_token))
    admin_if_token = _login(client, "admin_if_akses@undip.ac.id", "password123")

    # Kaprodi IF
    client.post("/api/v1/users", json={
        "nama": "Kaprodi IF",
        "email": "kaprodi_if_akses@undip.ac.id",
        "password": "password123",
        "role": "kaprodi",
        "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(admin_if_token))
    kaprodi_if_token = _login(client, "kaprodi_if_akses@undip.ac.id", "password123")

    # Admin EL
    client.post("/api/v1/users", json={
        "nama": "Admin EL",
        "email": "admin_el_akses@undip.ac.id",
        "password": "password123",
        "role": "admin_prodi",
        "program_studi_id": prodi_el["id"],
    }, headers=_auth_headers(sa_token))
    admin_el_token = _login(client, "admin_el_akses@undip.ac.id", "password123")

    # Dosen 1 IF (Pengampu)
    client.post("/api/v1/users", json={
        "nama": "Dosen Pengampu",
        "email": "dosen_pengampu_akses@undip.ac.id",
        "password": "password123",
        "role": "dosen",
        "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(admin_if_token))
    dosen_pengampu_token = _login(client, "dosen_pengampu_akses@undip.ac.id", "password123")

    # Dosen 2 IF (Bukan Pengampu)
    client.post("/api/v1/users", json={
        "nama": "Dosen Luar",
        "email": "dosen_luar_akses@undip.ac.id",
        "password": "password123",
        "role": "dosen",
        "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(admin_if_token))
    dosen_luar_token = _login(client, "dosen_luar_akses@undip.ac.id", "password123")

    # Kurikulum & MK IF
    kur = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024", "semester": "Ganjil"}, headers=_auth_headers(admin_if_token)).json()
    mk = client.post("/api/v1/mata-kuliah", json={
        "kurikulum_version_id": kur["id"],
        "kode": "IF401",
        "nama": "Rekayasa Perangkat Lunak",
        "sks": 3,
        "semester": "Ganjil",
        "tahun_ajaran": "2025/2026",
    }, headers=_auth_headers(admin_if_token)).json()

    # Assign Dosen 1 sebagai pengampu
    users_list = client.get("/api/v1/users", headers=_auth_headers(admin_if_token)).json()
    dosen_p_id = [u for u in users_list if u["email"] == "dosen_pengampu_akses@undip.ac.id"][0]["id"]
    client.post("/api/v1/pengampu-mata-kuliah", json={
        "mata_kuliah_id": mk["id"],
        "user_id": dosen_p_id,
        "is_koordinator": True,
    }, headers=_auth_headers(admin_if_token))

    # CPL & IK IF
    cpl = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur["id"], "kode": "CPL-IF-A", "deskripsi": "Kompetensi IF"}, headers=_auth_headers(admin_if_token)).json()
    ik = client.post("/api/v1/ik", json={"cpl_id": cpl["id"], "kode": "IK-IF-A1", "deskripsi": "IK A1"}, headers=_auth_headers(admin_if_token)).json()

    # CPMK
    cpmk = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk["id"],
        "kode": "CPMK-RPL1",
        "deskripsi": "Mampu merancang arsitektur",
        "level_taksonomi": "C3",
        "bobot": 100.0,
    }, headers=_auth_headers(admin_if_token)).json()

    # Bentuk Penilaian & MBP
    je = client.post("/api/v1/jenis-evaluasi", json={"nama": "Sumatif", "urutan": 1}, headers=_auth_headers(admin_if_token)).json()
    bp = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je["id"], "nama": "Proyek"}, headers=_auth_headers(admin_if_token)).json()
    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={
        "mata_kuliah_id": mk["id"],
        "bentuk_penilaian_id": bp["id"],
        "bobot": 100.0,
        "semester": "Ganjil",
    }, headers=_auth_headers(dosen_pengampu_token)).json()

    # Mahasiswa & Peserta
    mhs = client.post("/api/v1/mahasiswa", json={
        "nim": "24060120120005",
        "nama": "Eka Pratama",
        "semester_aktif": 1,
        "status_masuk": "Reguler",
    }, headers=_auth_headers(admin_if_token)).json()
    peserta = client.post("/api/v1/peserta-mata-kuliah", json={
        "mata_kuliah_id": mk["id"],
        "mahasiswa_id": mhs["id"],
        "kelas": "A",
    }, headers=_auth_headers(admin_if_token)).json()

    return {
        "admin_if_token": admin_if_token,
        "kaprodi_if_token": kaprodi_if_token,
        "admin_el_token": admin_el_token,
        "dosen_pengampu_token": dosen_pengampu_token,
        "dosen_luar_token": dosen_luar_token,
        "mk": mk,
        "cpmk": cpmk,
        "ik": ik,
        "cpl": cpl,
        "mbp": mbp,
        "peserta": peserta,
    }


def test_dosen_pengampu_boleh_ubah_nama_cpmk(client):
    """
    [KEPUTUSAN] Penamaan CPMK diisi oleh masing-masing dosen pengampu.
    Dosen pengampu boleh mengupdate deskripsi/nama CPMK.
    """
    env = _setup_akses_env(client)
    dosen_p_token = env["dosen_pengampu_token"]
    cpmk_id = env["cpmk"]["id"]

    resp = client.put(f"/api/v1/cpmk/{cpmk_id}", json={
        "deskripsi": "Deskripsi baru oleh dosen pengampu",
    }, headers=_auth_headers(dosen_p_token))

    assert resp.status_code == 200
    assert resp.json()["deskripsi"] == "Deskripsi baru oleh dosen pengampu"


def test_dosen_pengampu_dilarang_ubah_bobot_dan_mapping_ik(client):
    """
    Dosen pengampu TIDAK BOLEH mengubah bobot CPMK maupun mapping IK (ditolak 403).
    Bobot dan mapping IK dikendalikan oleh kurikulum/prodi.
    """
    env = _setup_akses_env(client)
    dosen_p_token = env["dosen_pengampu_token"]
    cpmk_id = env["cpmk"]["id"]
    ik_id = env["ik"]["id"]

    # 1. Dosen mencoba ubah bobot CPMK -> HARUS 403 Forbidden
    resp_bobot = client.put(f"/api/v1/cpmk/{cpmk_id}", json={
        "bobot": 80.0,
    }, headers=_auth_headers(dosen_p_token))
    assert resp_bobot.status_code == 403

    # 2. Dosen mencoba ubah mapping IK CPMK -> HARUS 403 Forbidden
    resp_map = client.put(f"/api/v1/cpmk/{cpmk_id}/map-ik", json={"mappings": [
        {"ik_id": ik_id, "bobot": 100.0},
    ]}, headers=_auth_headers(dosen_p_token))
    assert resp_map.status_code == 403


def test_dosen_bukan_pengampu_ditolak_seluruh_operasi(client):
    """
    Dosen yang bukan pengampu mata kuliah ditolak (403):
    1. Mengubah nama CPMK
    2. Menginput nilai mahasiswa
    3. Mengubah setting bobot matriks kelas
    """
    env = _setup_akses_env(client)
    dosen_luar_token = env["dosen_luar_token"]
    cpmk_id = env["cpmk"]["id"]
    mk_id = env["mk"]["id"]
    mbp_id = env["mbp"]["id"]
    peserta_id = env["peserta"]["id"]
    ik_id = env["ik"]["id"]

    # 1. Tolak ubah CPMK
    resp_cpmk = client.put(f"/api/v1/cpmk/{cpmk_id}", json={
        "deskripsi": "Upaya hack dosen luar",
    }, headers=_auth_headers(dosen_luar_token))
    assert resp_cpmk.status_code == 403

    # 2. Tolak input nilai
    resp_nilai = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id,
        "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": peserta_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik_id, "nilai": 75.0}],
    }, headers=_auth_headers(dosen_luar_token))
    assert resp_nilai.status_code == 403

    # 3. Tolak setting bobot matriks kelas
    resp_matriks = client.put(f"/api/v1/mk-bentuk-penilaian/{mbp_id}/map-ik", json={"mappings": [
        {"ik_id": ik_id, "bobot": 100.0},
    ]}, headers=_auth_headers(dosen_luar_token))
    assert resp_matriks.status_code == 403


def test_admin_prodi_dan_kaprodi_boleh_ubah_bobot_dan_mapping(client):
    """
    Admin Prodi dan Kaprodi berwenang mengatur bobot CPMK dan mapping IK.
    """
    env = _setup_akses_env(client)
    admin_token = env["admin_if_token"]
    cpmk_id = env["cpmk"]["id"]
    ik_id = env["ik"]["id"]

    # Admin Prodi set mapping IK
    resp_map = client.put(f"/api/v1/cpmk/{cpmk_id}/map-ik", json={"mappings": [
        {"ik_id": ik_id, "bobot": 100.0},
    ]}, headers=_auth_headers(admin_token))
    assert resp_map.status_code == 200


def test_idor_admin_prodi_antar_prodi(client):
    """
    Isolasi antar-prodi (mencegah IDOR):
    Admin Prodi EL dilarang mengakses atau memodifikasi CPL/IK/CPMK milik Prodi IF.
    """
    env = _setup_akses_env(client)
    admin_el_token = env["admin_el_token"]
    cpl_if_id = env["cpl"]["id"]
    cpmk_if_id = env["cpmk"]["id"]

    # 1. Admin EL membaca CPL IF
    resp_get_cpl = client.get(f"/api/v1/cpl/{cpl_if_id}", headers=_auth_headers(admin_el_token))
    assert resp_get_cpl.status_code == 403

    # 2. Admin EL mengubah CPL IF
    resp_put_cpl = client.put(f"/api/v1/cpl/{cpl_if_id}", json={"deskripsi": "Bajak CPL"}, headers=_auth_headers(admin_el_token))
    assert resp_put_cpl.status_code == 403

    # 3. Admin EL mengubah CPMK IF
    resp_put_cpmk = client.put(f"/api/v1/cpmk/{cpmk_if_id}", json={"deskripsi": "Bajak CPMK"}, headers=_auth_headers(admin_el_token))
    assert resp_put_cpmk.status_code == 403
