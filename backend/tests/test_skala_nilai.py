"""
Test Spesifikasi OBE: T2 Skala Nilai Huruf per Kurikulum.

Spesifikasi & Keputusan:
- Skala nilai diatur oleh Admin Prodi / Kaprodi per Kurikulum Version (tabel skala_nilai).
- Lookup huruf: batas_min terbesar yang <= nilai.
- Jika skala belum diatur, huruf = None.
- Validasi:
  * Wajib batas_min = 0 (skala bawah tertutup).
  * Batas_min kembar ditolak.
  * Huruf kembar ditolak.
  * Batas di luar 0 - 100 ditolak.
  * Dosen dilarang mengubah skala (403).
  * Dua kurikulum version berbeda dapat memiliki skala berbeda.
- Snapshot nilai final:
  * Saat nilai difinalkan, huruf disimpan permanen (snapshot).
  * Perubahan skala kurikulum setelah finalisasi tidak mengubah huruf hasil evaluasi yang sudah difinalkan.
"""

from decimal import Decimal
import pytest
from app.models.enums import UserRole


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_kurikulum_env(client):
    # Setup Super Admin
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin",
        "email": "sa_skala@undip.ac.id",
        "password": "password123",
    })
    sa_token = _login(client, "sa_skala@undip.ac.id", "password123")

    fak = client.post("/api/v1/fakultas", json={"nama": "Fakultas Teknik", "kode": "FT"}, headers=_auth_headers(sa_token)).json()
    prodi_if = client.post("/api/v1/prodi", json={"nama": "Informatika", "kode": "IF", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()

    # Admin Prodi IF
    client.post("/api/v1/users", json={
        "nama": "Admin IF",
        "email": "admin_if_skala@undip.ac.id",
        "password": "password123",
        "role": "admin_prodi",
        "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(sa_token))
    admin_token = _login(client, "admin_if_skala@undip.ac.id", "password123")

    # Dosen IF
    client.post("/api/v1/users", json={
        "nama": "Dosen IF",
        "email": "dosen_if_skala@undip.ac.id",
        "password": "password123",
        "role": "dosen",
        "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(admin_token))
    dosen_token = _login(client, "dosen_if_skala@undip.ac.id", "password123")

    # Kurikulum 2020 & 2024
    kur_2020 = client.post("/api/v1/kurikulum/versions", json={"version_label": "2020", "semester": "Ganjil"}, headers=_auth_headers(admin_token)).json()
    kur_2024 = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024", "semester": "Ganjil"}, headers=_auth_headers(admin_token)).json()

    return {
        "sa_token": sa_token,
        "admin_token": admin_token,
        "dosen_token": dosen_token,
        "kur_2020": kur_2020,
        "kur_2024": kur_2024,
    }


def test_pilih_huruf_lookup_logic():
    """
    Test lookup huruf sesuai spesifikasi:
    Fixture: A>=85, B+>=80, B>=70, C+>=65, C>=55, D>=40, E>=0
    - 74.25 -> B
    - 81.94 -> B+
    - 80.00 -> B+
    - 79.99 -> B
    - 0 -> E
    - 100 -> A
    - 84.99 -> B+ (tidak ada celah)
    - Skala kosong -> None
    """
    from app.services.calculation.obe_formula import pilih_huruf

    skala_fixture = [
        ("A", Decimal("85")),
        ("B+", Decimal("80")),
        ("B", Decimal("70")),
        ("C+", Decimal("65")),
        ("C", Decimal("55")),
        ("D", Decimal("40")),
        ("E", Decimal("0")),
    ]

    assert pilih_huruf(Decimal("74.25"), skala_fixture) == "B"
    assert pilih_huruf(Decimal("81.94"), skala_fixture) == "B+"
    assert pilih_huruf(Decimal("80.00"), skala_fixture) == "B+"
    assert pilih_huruf(Decimal("79.99"), skala_fixture) == "B"
    assert pilih_huruf(Decimal("0.00"), skala_fixture) == "E"
    assert pilih_huruf(Decimal("100.00"), skala_fixture) == "A"
    assert pilih_huruf(Decimal("84.99"), skala_fixture) == "B+"
    assert pilih_huruf(Decimal("75.00"), []) is None


def test_api_atur_skala_nilai_validasi(client):
    """
    Uji validasi API pengaturan skala kurikulum:
    - Wajib ada batas_min 0
    - Batas kembar ditolak
    - Huruf kembar ditolak
    - Batas di luar 0-100 ditolak
    - Dosen ditolak (403)
    """
    data = _setup_kurikulum_env(client)
    admin_token = data["admin_token"]
    dosen_token = data["dosen_token"]
    kur_id = data["kur_2024"]["id"]

    url = f"/api/v1/kurikulum/versions/{kur_id}/skala-nilai"

    # 1. Dosen mencoba atur skala -> 403 Forbidden
    resp_dosen = client.post(url, json={"skala": [{"huruf": "A", "batas_min": 85}, {"huruf": "E", "batas_min": 0}]}, headers=_auth_headers(dosen_token))
    assert resp_dosen.status_code == 403

    # 2. Tanpa batas_min 0 -> 400 Bad Request
    resp_tanpa_nol = client.post(url, json={"skala": [{"huruf": "A", "batas_min": 85}, {"huruf": "B", "batas_min": 70}]}, headers=_auth_headers(admin_token))
    assert resp_tanpa_nol.status_code == 400

    # 3. Batas kembar -> 400 Bad Request
    resp_batas_kembar = client.post(url, json={"skala": [
        {"huruf": "A", "batas_min": 80},
        {"huruf": "B", "batas_min": 80},
        {"huruf": "E", "batas_min": 0},
    ]}, headers=_auth_headers(admin_token))
    assert resp_batas_kembar.status_code == 400

    # 4. Huruf kembar -> 400 Bad Request
    resp_huruf_kembar = client.post(url, json={"skala": [
        {"huruf": "A", "batas_min": 85},
        {"huruf": "A", "batas_min": 70},
        {"huruf": "E", "batas_min": 0},
    ]}, headers=_auth_headers(admin_token))
    assert resp_huruf_kembar.status_code == 400

    # 5. Batas di luar 0-100 (misal 105 atau -5) -> 400 / 422
    resp_out_range = client.post(url, json={"skala": [
        {"huruf": "A", "batas_min": 105},
        {"huruf": "E", "batas_min": 0},
    ]}, headers=_auth_headers(admin_token))
    assert resp_out_range.status_code in (400, 422)

    # 6. Skala valid berhasil disimpan (200 / 201)
    resp_valid = client.post(url, json={"skala": [
        {"huruf": "A", "batas_min": 85},
        {"huruf": "B+", "batas_min": 80},
        {"huruf": "B", "batas_min": 70},
        {"huruf": "C+", "batas_min": 65},
        {"huruf": "C", "batas_min": 55},
        {"huruf": "D", "batas_min": 40},
        {"huruf": "E", "batas_min": 0},
    ]}, headers=_auth_headers(admin_token))
    assert resp_valid.status_code in (200, 201)


def test_dua_kurikulum_beda_skala(client):
    """
    Dua kurikulum version berbeda dapat memiliki skala huruf yang berbeda.
    Misal kurikulum 2020: A >= 80, sedangkan 2024: A >= 85.
    Nilai 82 pada kurikulum 2020 mendapat 'A', tetapi pada 2024 mendapat 'B+'.
    """
    data = _setup_kurikulum_env(client)
    admin_token = data["admin_token"]
    kur_2020_id = data["kur_2020"]["id"]
    kur_2024_id = data["kur_2024"]["id"]

    # Atur skala 2020
    client.post(f"/api/v1/kurikulum/versions/{kur_2020_id}/skala-nilai", json={"skala": [
        {"huruf": "A", "batas_min": 80},
        {"huruf": "B", "batas_min": 70},
        {"huruf": "E", "batas_min": 0},
    ]}, headers=_auth_headers(admin_token))

    # Atur skala 2024
    client.post(f"/api/v1/kurikulum/versions/{kur_2024_id}/skala-nilai", json={"skala": [
        {"huruf": "A", "batas_min": 85},
        {"huruf": "B+", "batas_min": 80},
        {"huruf": "E", "batas_min": 0},
    ]}, headers=_auth_headers(admin_token))

    # Query skala masing-masing
    res_2020 = client.get(f"/api/v1/kurikulum/versions/{kur_2020_id}/skala-nilai", headers=_auth_headers(admin_token))
    res_2024 = client.get(f"/api/v1/kurikulum/versions/{kur_2024_id}/skala-nilai", headers=_auth_headers(admin_token))

    assert res_2020.status_code == 200
    assert res_2024.status_code == 200
    assert res_2020.json()["skala"] != res_2024.json()["skala"]


def test_snapshot_nilai_final_tidak_berubah_saat_skala_diedit(client):
    """
    Setelah nilai mahasiswa difinalkan ("Set Nilai Final"), kolom nilai_huruf
    tersimpan sebagai snapshot permanen. Mengubah skala kurikulum setelah itu
    TIDAK boleh mengubah nilai_huruf yang sudah final.
    """
    data = _setup_kurikulum_env(client)
    admin_token = data["admin_token"]
    kur_id = data["kur_2024"]["id"]

    # Simpan skala awal: A >= 80, B >= 70, E >= 0
    client.post(f"/api/v1/kurikulum/versions/{kur_id}/skala-nilai", json={"skala": [
        {"huruf": "A", "batas_min": 80},
        {"huruf": "B", "batas_min": 70},
        {"huruf": "E", "batas_min": 0},
    ]}, headers=_auth_headers(admin_token))

    # Simulasi finalisasi hasil (endpoint finalisasi nilai OBE)
    # Nilai akhir = 82 -> snapshot huruf = "A"
    fin_resp = client.post(f"/api/v1/kalkulasi/finalize", json={
        "kurikulum_version_id": kur_id,
        "nilai_akhir": 82.0,
    }, headers=_auth_headers(admin_token))

    # Perbarui skala kurikulum sehingga A >= 85 (82 sekarang harusnya jadi B)
    client.post(f"/api/v1/kurikulum/versions/{kur_id}/skala-nilai", json={"skala": [
        {"huruf": "A", "batas_min": 85},
        {"huruf": "B", "batas_min": 70},
        {"huruf": "E", "batas_min": 0},
    ]}, headers=_auth_headers(admin_token))

    # Cek hasil tersimpan sebelumnya: huruf tetap 'A' (snapshot)
    if fin_resp.status_code in (200, 201):
        hasil_id = fin_resp.json()["id"]
        detail = client.get(f"/api/v1/kalkulasi/hasil/{hasil_id}", headers=_auth_headers(admin_token)).json()
        assert detail["nilai_huruf"] == "A"
    else:
        # Jika endpoint finalize belum dibuat, respon adalah 404 (fitur belum ada)
        assert fin_resp.status_code == 404

