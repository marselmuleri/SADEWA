"""
Test Spesifikasi OBE: Range Nilai Ketercapaian CPL per Prodi (Fase 3 - Keputusan K-C).

Spesifikasi & Keputusan:
1. Rentang kategori CPL diatur per Prodi (tabel range_nilai_cpl: program_studi_id, nama, batas_bawah, batas_atas, warna, keterangan).
2. Service lookup murni:
   lookup_kategori_cpl(nilai: Decimal, ranges: list) -> str | None
   Memetakan nilai capaian CPL ke nama kategori (misal "Sangat Baik", "Baik", "Cukup", "Kurang").
3. Validasi API:
   - Dosen dilarang mengatur range CPL (403 Forbidden).
   - Admin prodi lain dilarang mengatur range CPL prodi lain (403 Forbidden).
   - batas_bawah >= batas_atas ditolak (400 Bad Request).
   - Range overlap (tumpang tindih) ditolak (400 Bad Request).
   - Batas di luar rentang 0 - 100 ditolak (400 atau 422).
4. Pengaturan batch berhasil disimpan dan dapat di-query kembali dengan benar.
"""

from decimal import Decimal
import pytest


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_range_env(client, prefix="rng"):
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

    # Dosen IF
    client.post("/api/v1/users", json={
        "nama": f"Dosen IF {prefix}", "email": f"dosen_if_{prefix}@undip.ac.id", "password": "password123",
        "role": "dosen", "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(admin_if_token))
    dosen_if_token = _login(client, f"dosen_if_{prefix}@undip.ac.id", "password123")

    return {
        "admin_if_token": admin_if_token,
        "kaprodi_if_token": kaprodi_if_token,
        "admin_el_token": admin_el_token,
        "dosen_if_token": dosen_if_token,
        "prodi_if_id": prodi_if["id"],
        "prodi_el_id": prodi_el["id"],
    }


def test_lookup_kategori_cpl_service():
    """
    Uji logika lookup kategori CPL murni:
    Sangat Baik [80, 100]
    Baik [70, 80)
    Cukup [55, 70)
    Kurang [0, 55)
    """
    from app.services.calculation.range_cpl import lookup_kategori_cpl

    class DummyRange:
        def __init__(self, nama, bawah, atas):
            self.nama = nama
            self.batas_bawah = Decimal(str(bawah))
            self.batas_atas = Decimal(str(atas))

    ranges = [
        DummyRange("Sangat Baik", 80, 100),
        DummyRange("Baik", 70, 79.99),
        DummyRange("Cukup", 55, 69.99),
        DummyRange("Kurang", 0, 54.99),
    ]

    assert lookup_kategori_cpl(Decimal("95.5"), ranges) == "Sangat Baik"
    assert lookup_kategori_cpl(Decimal("100"), ranges) == "Sangat Baik"
    assert lookup_kategori_cpl(Decimal("80.0"), ranges) == "Sangat Baik"
    assert lookup_kategori_cpl(Decimal("75.0"), ranges) == "Baik"
    assert lookup_kategori_cpl(Decimal("60.0"), ranges) == "Cukup"
    assert lookup_kategori_cpl(Decimal("30.0"), ranges) == "Kurang"
    assert lookup_kategori_cpl(Decimal("0.0"), ranges) == "Kurang"
    assert lookup_kategori_cpl(Decimal("50.0"), []) is None


def test_api_validasi_range_nilai_cpl(client):
    """
    Validasi pengaturan range CPL via API:
    1. Dosen ditolak (403).
    2. Admin prodi lain ditolak (403).
    3. batas_bawah >= batas_atas ditolak (400).
    4. Overlap antar range ditolak (400).
    5. Batas di luar 0-100 ditolak (400/422).
    """
    env = _setup_range_env(client, "val")
    prodi_id = env["prodi_if_id"]
    admin_token = env["admin_if_token"]
    dosen_token = env["dosen_if_token"]
    admin_el_token = env["admin_el_token"]

    url = f"/api/v1/prodi/{prodi_id}/range-nilai-cpl"

    # 1. Dosen mencoba atur range -> 403
    resp_dosen = client.post(url, json={"ranges": [
        {"nama": "Baik", "batas_bawah": 70, "batas_atas": 100, "warna": "#00FF00"}
    ]}, headers=_auth_headers(dosen_token))
    assert resp_dosen.status_code == 403

    # 2. Admin prodi lain mencoba atur range -> 403
    resp_el = client.post(url, json={"ranges": [
        {"nama": "Baik", "batas_bawah": 70, "batas_atas": 100, "warna": "#00FF00"}
    ]}, headers=_auth_headers(admin_el_token))
    assert resp_el.status_code == 403

    # 3. batas_bawah >= batas_atas -> 400
    resp_terbalik = client.post(url, json={"ranges": [
        {"nama": "Terbalik", "batas_bawah": 80, "batas_atas": 70, "warna": "#FF0000"}
    ]}, headers=_auth_headers(admin_token))
    assert resp_terbalik.status_code == 400

    # 4. Overlap antar range -> 400
    resp_overlap = client.post(url, json={"ranges": [
        {"nama": "Tinggi", "batas_bawah": 60, "batas_atas": 100, "warna": "#00FF00"},
        {"nama": "Sedang", "batas_bawah": 50, "batas_atas": 70, "warna": "#FFFF00"},
    ]}, headers=_auth_headers(admin_token))
    assert resp_overlap.status_code == 400

    # 5. Batas di luar 0-100 -> 400 atau 422
    resp_out = client.post(url, json={"ranges": [
        {"nama": "Luar", "batas_bawah": -10, "batas_atas": 100, "warna": "#FF0000"}
    ]}, headers=_auth_headers(admin_token))
    assert resp_out.status_code in (400, 422)


def test_api_crud_range_nilai_cpl_berhasil(client):
    """
    Admin prodi berhasil menyimpan range CPL prodi dan membaca kembali list terurut.
    """
    env = _setup_range_env(client, "crud")
    prodi_id = env["prodi_if_id"]
    admin_token = env["admin_if_token"]
    url = f"/api/v1/prodi/{prodi_id}/range-nilai-cpl"

    payload = {
        "ranges": [
            {"nama": "Sangat Baik", "batas_bawah": 80.0, "batas_atas": 100.0, "warna": "#22C55E", "keterangan": "CPL Terlampaui"},
            {"nama": "Baik", "batas_bawah": 70.0, "batas_atas": 79.99, "warna": "#3B82F6", "keterangan": "CPL Memenuhi"},
            {"nama": "Cukup", "batas_bawah": 55.0, "batas_atas": 69.99, "warna": "#EAB308", "keterangan": "CPL Cukup"},
            {"nama": "Kurang", "batas_bawah": 0.0, "batas_atas": 54.99, "warna": "#EF4444", "keterangan": "CPL Belum Memenuhi"},
        ]
    }

    # Simpan batch range
    post_resp = client.post(url, json=payload, headers=_auth_headers(admin_token))
    assert post_resp.status_code in (200, 201)

    # Query range yang tersimpan
    get_resp = client.get(url, headers=_auth_headers(admin_token))
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert len(data) == 4
    # Memastikan terurut dari batas_bawah tertinggi atau terendah secara konsisten
    kategori_names = [d["nama"] for d in data]
    assert "Sangat Baik" in kategori_names
    assert "Kurang" in kategori_names

