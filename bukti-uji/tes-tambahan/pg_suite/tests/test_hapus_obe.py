"""
Test Spesifikasi OBE: T6 Integritas Penghapusan CPL dan IK.

Spesifikasi & Integritas Relasi:
1. Hapus CPL yang masih memiliki IK terkait:
   - Harus mengembalikan 409 Conflict dengan pesan kesalahan yang informatif.
   - TIDAK BOLEH melempar 500 Internal Server Error (IntegrityError tidak tertangani).
2. Hapus IK yang sudah dimapping ke CPMK atau memiliki rekaman nilai:
   - Harus mengembalikan 409 Conflict.
3. Hapus CPL atau IK yang tidak terpakai (tanpa dependensi):
   - Berhasil dihapus (HTTP 200 atau 204).
"""

from decimal import Decimal
import pytest


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_hapus_env(client):
    # Setup Super Admin
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin",
        "email": "sa_hapus@undip.ac.id",
        "password": "password123",
    })
    sa_token = _login(client, "sa_hapus@undip.ac.id", "password123")

    fak = client.post("/api/v1/fakultas", json={"nama": "Fakultas Teknik", "kode": "FT"}, headers=_auth_headers(sa_token)).json()
    prodi = client.post("/api/v1/prodi", json={"nama": "Informatika", "kode": "IF", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()

    # Admin IF
    client.post("/api/v1/users", json={
        "nama": "Admin IF",
        "email": "admin_if_hapus@undip.ac.id",
        "password": "password123",
        "role": "admin_prodi",
        "program_studi_id": prodi["id"],
    }, headers=_auth_headers(sa_token))
    admin_token = _login(client, "admin_if_hapus@undip.ac.id", "password123")

    # Kurikulum & MK
    kur = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024", "semester": "Ganjil"}, headers=_auth_headers(admin_token)).json()
    mk = client.post("/api/v1/mata-kuliah", json={
        "kurikulum_version_id": kur["id"],
        "kode": "IF501",
        "nama": "Keamanan Siber",
        "sks": 3,
        "semester": "Ganjil",
        "tahun_ajaran": "2025/2026",
    }, headers=_auth_headers(admin_token)).json()

    return {
        "admin_token": admin_token,
        "kur": kur,
        "mk": mk,
    }


def test_hapus_cpl_yang_memiliki_ik_mengembalikan_409(client):
    """
    Menghapus CPL yang masih memiliki relasi anak ke IK harus mengembalikan 409 Conflict,
    bukan 500 Internal Server Error.
    """
    env = _setup_hapus_env(client)
    admin_token = env["admin_token"]
    kur_id = env["kur"]["id"]

    cpl = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur_id, "kode": "CPL-REL1", "deskripsi": "CPL dengan IK"}, headers=_auth_headers(admin_token)).json()
    client.post("/api/v1/ik", json={"cpl_id": cpl["id"], "kode": "IK-ANAK1", "deskripsi": "IK Anak"}, headers=_auth_headers(admin_token))

    del_resp = client.delete(f"/api/v1/cpl/{cpl['id']}", headers=_auth_headers(admin_token))

    # Wajib 409 Conflict, BUKAN 500
    assert del_resp.status_code == 409
    assert del_resp.status_code != 500
    detail = del_resp.json().get("detail", "").lower()
    assert any(w in detail for w in ("ik", "terkait", "relasi", "digunakan", "child"))


def test_hapus_ik_yang_termapping_cpmk_mengembalikan_409(client):
    """
    Menghapus IK yang sudah dimapping ke CPMK harus mengembalikan 409 Conflict,
    bukan 500 Internal Server Error.
    """
    env = _setup_hapus_env(client)
    admin_token = env["admin_token"]
    kur_id = env["kur"]["id"]
    mk_id = env["mk"]["id"]

    cpl = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur_id, "kode": "CPL-MAP1", "deskripsi": "CPL untuk map"}, headers=_auth_headers(admin_token)).json()
    ik = client.post("/api/v1/ik", json={"cpl_id": cpl["id"], "kode": "IK-MAP1", "deskripsi": "IK untuk map"}, headers=_auth_headers(admin_token)).json()

    cpmk = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk_id,
        "kode": "CPMK-MAP1",
        "deskripsi": "CPMK Map",
        "level_taksonomi": "C3",
        "bobot": 10.0,
    }, headers=_auth_headers(admin_token)).json()

    # Mapping IK ke CPMK
    client.put(f"/api/v1/cpmk/{cpmk['id']}/map-ik", json={"mappings": [
        {"ik_id": ik["id"], "bobot": 10.0},
    ]}, headers=_auth_headers(admin_token))

    # Coba hapus IK yang sedang aktif dimapping
    del_resp = client.delete(f"/api/v1/ik/{ik['id']}", headers=_auth_headers(admin_token))

    assert del_resp.status_code == 409
    assert del_resp.status_code != 500


def test_hapus_cpl_dan_ik_tanpa_relasi_berhasil(client):
    """
    Menghapus CPL dan IK yang berdiri sendiri (tidak memiliki relasi atau mapping)
    harus berhasil (200 OK atau 204 No Content).
    """
    env = _setup_hapus_env(client)
    admin_token = env["admin_token"]
    kur_id = env["kur"]["id"]

    # 1. CPL dan IK terpisah
    cpl_orphan = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur_id, "kode": "CPL-ORPHAN", "deskripsi": "CPL berdiri sendiri"}, headers=_auth_headers(admin_token)).json()
    cpl_with_ik = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur_id, "kode": "CPL-WITH-IK", "deskripsi": "CPL dengan IK bebas"}, headers=_auth_headers(admin_token)).json()
    ik_free = client.post("/api/v1/ik", json={"cpl_id": cpl_with_ik["id"], "kode": "IK-FREE", "deskripsi": "IK bebas"}, headers=_auth_headers(admin_token)).json()

    # Hapus IK bebas (tanpa mapping CPMK/nilai)
    del_ik = client.delete(f"/api/v1/ik/{ik_free['id']}", headers=_auth_headers(admin_token))
    assert del_ik.status_code in (200, 204)

    # Hapus CPL sekarang setelah IK-nya dihapus
    del_cpl_parent = client.delete(f"/api/v1/cpl/{cpl_with_ik['id']}", headers=_auth_headers(admin_token))
    assert del_cpl_parent.status_code in (200, 204)

    # Hapus CPL orphan
    del_cpl_orphan = client.delete(f"/api/v1/cpl/{cpl_orphan['id']}", headers=_auth_headers(admin_token))
    assert del_cpl_orphan.status_code in (200, 204)
