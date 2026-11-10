"""
Test Spesifikasi OBE: Safe Delete CPMK (Fase 2 - Keputusan K-E).

Aturan Keputusan K-E:
1. Dosen pengampu DILARANG menghapus CPMK (403 Forbidden). Hanya admin_prodi dan kaprodi prodi pemilik MK yang berhak.
2. Admin prodi lain dilarang menghapus CPMK (403 Forbidden).
3. CPMK tidak ditemukan mengembalikan 404 Not Found.
4. CPMK DITOLAK dihapus (409 Conflict) jika:
   - Ada nilai mahasiswa (NilaiBentukPenilaian) pada bentuk penilaian yang terkait IK dari CPMK tersebut, ATAU
   - Mata kuliah memiliki mahasiswa yang sudah difinalisasi nilainya.
5. CPMK aman dihapus (200 OK atau 204 No Content) jika belum ada rekaman nilai mahasiswa yang terikat pada IK CPMK tersebut:
   - Relasi CPMK-IK (cpmk_ik_map) otomatis dibersihkan bersama penghapusan CPMK.
"""

from decimal import Decimal
import pytest


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_cpmk_hapus_env(client, prefix="delcpmk"):
    # Super Admin
    client.post("/api/v1/auth/register", json={
        "nama": f"Super Admin {prefix}",
        "email": f"sa_{prefix}@undip.ac.id",
        "password": "password123",
    })
    sa_token = _login(client, f"sa_{prefix}@undip.ac.id", "password123")

    fak = client.post("/api/v1/fakultas", json={"nama": "Fakultas Teknik", "kode": f"FT{prefix}"}, headers=_auth_headers(sa_token)).json()
    prodi_if = client.post("/api/v1/prodi", json={"nama": "Informatika", "kode": f"IF{prefix}", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()
    prodi_el = client.post("/api/v1/prodi", json={"nama": "Elektro", "kode": f"EL{prefix}", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()

    # Admin IF & Kaprodi IF
    client.post("/api/v1/users", json={
        "nama": f"Admin IF {prefix}", "email": f"admin_if_{prefix}@undip.ac.id", "password": "password123",
        "role": "admin_prodi", "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(sa_token))
    admin_if_token = _login(client, f"admin_if_{prefix}@undip.ac.id", "password123")

    client.post("/api/v1/users", json={
        "nama": f"Kaprodi IF {prefix}", "email": f"kaprodi_if_{prefix}@undip.ac.id", "password": "password123",
        "role": "kaprodi", "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(admin_if_token))
    kaprodi_if_token = _login(client, f"kaprodi_if_{prefix}@undip.ac.id", "password123")

    # Admin EL (Prodi lain)
    client.post("/api/v1/users", json={
        "nama": f"Admin EL {prefix}", "email": f"admin_el_{prefix}@undip.ac.id", "password": "password123",
        "role": "admin_prodi", "program_studi_id": prodi_el["id"],
    }, headers=_auth_headers(sa_token))
    admin_el_token = _login(client, f"admin_el_{prefix}@undip.ac.id", "password123")

    # Dosen Pengampu IF
    client.post("/api/v1/users", json={
        "nama": f"Dosen Pengampu {prefix}", "email": f"dosen_p_{prefix}@undip.ac.id", "password": "password123",
        "role": "dosen", "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(admin_if_token))
    dosen_p_token = _login(client, f"dosen_p_{prefix}@undip.ac.id", "password123")

    # Kurikulum & MK
    kur = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024", "semester": "Ganjil"}, headers=_auth_headers(admin_if_token)).json()
    mk = client.post("/api/v1/mata-kuliah", json={
        "kurikulum_version_id": kur["id"],
        "kode": f"MK-{prefix}",
        "nama": "Mata Kuliah Hapus CPMK",
        "sks": 3,
        "semester": "Ganjil",
        "tahun_ajaran": "2025/2026",
    }, headers=_auth_headers(admin_if_token)).json()

    # Assign dosen IF sebagai pengampu
    users_list = client.get("/api/v1/users", headers=_auth_headers(admin_if_token)).json()
    dp_user = [u for u in users_list if u["email"] == f"dosen_p_{prefix}@undip.ac.id"][0]
    client.post("/api/v1/pengampu-mata-kuliah", json={
        "mata_kuliah_id": mk["id"], "user_id": dp_user["id"], "is_koordinator": True,
    }, headers=_auth_headers(admin_if_token))

    # CPL & IK
    cpl = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur["id"], "kode": f"CPL-{prefix}", "deskripsi": "CPL Desk"}, headers=_auth_headers(admin_if_token)).json()
    ik1 = client.post("/api/v1/ik", json={"cpl_id": cpl["id"], "kode": f"IK1-{prefix}", "deskripsi": "IK 1 Desk"}, headers=_auth_headers(admin_if_token)).json()
    ik2 = client.post("/api/v1/ik", json={"cpl_id": cpl["id"], "kode": f"IK2-{prefix}", "deskripsi": "IK 2 Desk"}, headers=_auth_headers(admin_if_token)).json()

    return {
        "admin_if_token": admin_if_token,
        "kaprodi_if_token": kaprodi_if_token,
        "admin_el_token": admin_el_token,
        "dosen_p_token": dosen_p_token,
        "kur_id": kur["id"],
        "mk_id": mk["id"],
        "cpl_id": cpl["id"],
        "ik1_id": ik1["id"],
        "ik2_id": ik2["id"],
    }


def test_hak_akses_hapus_cpmk(client):
    """
    1. Admin prodi lain DILARANG menghapus CPMK (403 Forbidden).
    2. Dosen pengampu BOLEH menghapus CPMK pada mata kuliah yang diampu.
    """
    env = _setup_cpmk_hapus_env(client, "akses")
    mk_id = env["mk_id"]
    admin_if = env["admin_if_token"]
    dosen_p = env["dosen_p_token"]
    admin_el = env["admin_el_token"]

    cpmk = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk_id,
        "kode": "CPMK-AKSES",
        "deskripsi": "CPMK Hak Akses",
        "level_taksonomi": "C3",
        "bobot": 50.0,
    }, headers=_auth_headers(admin_if)).json()

    # Admin prodi lain mencoba menghapus -> 403 Forbidden
    del_el = client.delete(f"/api/v1/cpmk/{cpmk['id']}", headers=_auth_headers(admin_el))
    assert del_el.status_code == 403

    # Dosen pengampu menghapus CPMK di mata kuliah yang diampu -> berhasil
    del_dosen = client.delete(f"/api/v1/cpmk/{cpmk['id']}", headers=_auth_headers(dosen_p))
    assert del_dosen.status_code == 200


def test_hapus_cpmk_yang_memiliki_nilai_terkait_mengembalikan_409(client):
    """
    Jika CPMK memetakan IK yang sudah memiliki nilai mahasiswa pada bentuk penilaian MK tersebut,
    penghapusan CPMK harus DITOLAK dengan status 409 Conflict.
    """
    env = _setup_cpmk_hapus_env(client, "conflict")
    mk_id = env["mk_id"]
    admin_if = env["admin_if_token"]
    ik1_id = env["ik1_id"]

    cpmk = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk_id,
        "kode": "CPMK-NILAI",
        "deskripsi": "CPMK dengan Nilai",
        "level_taksonomi": "C3",
        "bobot": 100.0,
    }, headers=_auth_headers(admin_if)).json()
    client.put(f"/api/v1/cpmk/{cpmk['id']}/map-ik", json={"mappings": [{"ik_id": ik1_id, "bobot": 100.0}]}, headers=_auth_headers(admin_if))

    je = client.post("/api/v1/jenis-evaluasi", json={"nama": "Evaluasi", "urutan": 1}, headers=_auth_headers(admin_if)).json()
    bp = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je["id"], "nama": "Ujian"}, headers=_auth_headers(admin_if)).json()
    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={
        "mata_kuliah_id": mk_id, "bentuk_penilaian_id": bp["id"], "bobot": 100.0, "semester": "Ganjil",
    }, headers=_auth_headers(admin_if)).json()
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp['id']}/map-ik", json={"mappings": [{"ik_id": ik1_id, "bobot": 100.0}]}, headers=_auth_headers(admin_if))

    mhs = client.post("/api/v1/mahasiswa", json={"nim": "240601240888", "nama": "Mhs Cpmk Nilai", "semester_aktif": 1, "status_masuk": "Reguler"}, headers=_auth_headers(admin_if)).json()
    peserta = client.post("/api/v1/peserta-mata-kuliah", json={"mata_kuliah_id": mk_id, "mahasiswa_id": mhs["id"], "kelas": "A"}, headers=_auth_headers(admin_if)).json()

    # Input nilai mahasiswa untuk ik1
    client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id,
        "semester": "Ganjil",
        "records": [{
            "peserta_mata_kuliah_id": peserta["id"],
            "mk_bentuk_penilaian_id": mbp["id"],
            "ik_id": ik1_id,
            "nilai": 85.0,
        }],
    }, headers=_auth_headers(admin_if))

    # Coba hapus CPMK -> 409 Conflict
    del_resp = client.delete(f"/api/v1/cpmk/{cpmk['id']}", headers=_auth_headers(admin_if))
    assert del_resp.status_code == 409
    detail = del_resp.json().get("detail", "").lower()
    assert any(w in detail for w in ("nilai", "mahasiswa", "terkait", "terpakai"))


def test_hapus_cpmk_tanpa_nilai_berhasil_dan_hapus_relasi_map(client):
    """
    CPMK yang tidak memiliki rekaman nilai dapat dihapus oleh Admin Prodi atau Kaprodi.
    Relasi cpmk_ik_map terkait harus otomatis terhapus (cascade/clean up).
    """
    env = _setup_cpmk_hapus_env(client, "sukses")
    mk_id = env["mk_id"]
    admin_if = env["admin_if_token"]
    kaprodi_if = env["kaprodi_if_token"]
    ik1_id = env["ik1_id"]
    ik2_id = env["ik2_id"]

    # Buat CPMK 1 & mapping
    cpmk1 = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk_id, "kode": "CPMK-DEL1", "deskripsi": "CPMK 1", "level_taksonomi": "C3", "bobot": 50.0,
    }, headers=_auth_headers(admin_if)).json()
    client.put(f"/api/v1/cpmk/{cpmk1['id']}/map-ik", json={"mappings": [{"ik_id": ik1_id, "bobot": 50.0}]}, headers=_auth_headers(admin_if))

    # Buat CPMK 2 & mapping
    cpmk2 = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk_id, "kode": "CPMK-DEL2", "deskripsi": "CPMK 2", "level_taksonomi": "C3", "bobot": 50.0,
    }, headers=_auth_headers(admin_if)).json()
    client.put(f"/api/v1/cpmk/{cpmk2['id']}/map-ik", json={"mappings": [{"ik_id": ik2_id, "bobot": 50.0}]}, headers=_auth_headers(admin_if))

    # 1. Hapus CPMK 1 oleh admin_prodi -> 200 OK
    del1 = client.delete(f"/api/v1/cpmk/{cpmk1['id']}", headers=_auth_headers(admin_if))
    assert del1.status_code in (200, 204)

    # Verifikasi CPMK 1 sudah hilang (404)
    get_cpmk1 = client.get(f"/api/v1/cpmk/{cpmk1['id']}/map-ik", headers=_auth_headers(admin_if))
    assert get_cpmk1.status_code == 404

    # 2. Hapus CPMK 2 oleh kaprodi -> 200 OK
    del2 = client.delete(f"/api/v1/cpmk/{cpmk2['id']}", headers=_auth_headers(kaprodi_if))
    assert del2.status_code in (200, 204)

    get_cpmk2 = client.get(f"/api/v1/cpmk/{cpmk2['id']}/map-ik", headers=_auth_headers(admin_if))
    assert get_cpmk2.status_code == 404

