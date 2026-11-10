"""Tes tambahan C500 SADEWA.

Ditulis untuk menutup kasus di C200/C300 yang belum punya tes otomatis di
backend/tests. Tidak mengubah kode aplikasi maupun tes bawaan. Memakai
fixture `client` dan database dari backend/tests/conftest.py (SQLite in-memory),
lalu mengisi data dengan app.core.seed.seed() (2 prodi dalam 1 fakultas,
akun semua peran, kalkulasi awal sudah dijalankan).

Jalankan dari folder backend:
    python -m pytest ../bukti-uji/tes-tambahan/test_tambahan_c500.py -q -rA
"""
from datetime import timedelta

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import create_access_token
from app.core.seed import seed
from app.models import LaporanEvaluasi, MataKuliah, ProgramStudi, SiapSyncLog, User
from tests.conftest import TestingSessionLocal

PASSWORD = "password123"


@pytest.fixture
def data(client):
    db = TestingSessionLocal()
    hasil = seed(db)
    prodi = {p.kode: p.id for p in db.query(ProgramStudi).all()}
    mk_if = (db.query(MataKuliah)
             .filter(MataKuliah.program_studi_id == prodi["IF"]).order_by(MataKuliah.id).first())
    mk_el = (db.query(MataKuliah)
             .filter(MataKuliah.program_studi_id == prodi["EL"]).order_by(MataKuliah.id).first())
    out = {"users": hasil["users"], "prodi": prodi, "mk_if": mk_if.id, "mk_el": mk_el.id}
    db.close()
    return out


def login(client, email, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def hdr(client, email):
    r = login(client, email)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------------------------------------------------------------- Autentikasi
@pytest.mark.parametrize("peran", ["super_admin", "admin_prodi_if", "kaprodi_if", "dosen_if", "dekan_ft"])
def test_t01_login_setiap_peran_mendapat_token_berisi_peran(client, data, peran):
    r = login(client, data["users"][peran])
    assert r.status_code == 200
    token = r.json()["access_token"]
    klaim = jwt.get_unverified_claims(token)
    assert klaim["sub"] == data["users"][peran]
    assert klaim["role"] in ("super_admin", "admin_prodi", "kaprodi", "dosen", "dekan")
    assert "exp" in klaim


def test_t02_login_email_tidak_terdaftar_ditolak(client, data):
    assert login(client, "tidakada@sadewa.ac.id").status_code == 401


def test_t03_login_dengan_pola_sql_injection_tidak_menyebabkan_error_server(client, data):
    r = client.post("/api/v1/auth/login", json={"email": "' OR '1'='1", "password": "' OR '1'='1"})
    assert r.status_code in (401, 422)


def test_t04_me_mengembalikan_profil_tanpa_password_hash(client, data):
    r = client.get("/api/v1/auth/me", headers=hdr(client, data["users"]["dosen_if"]))
    assert r.status_code == 200
    assert "password_hash" not in r.json() and "password" not in r.json()


def test_t05_password_tersimpan_sebagai_hash_bcrypt(client, data):
    db = TestingSessionLocal()
    users = db.query(User).all()
    db.close()
    assert users
    for u in users:
        assert u.password_hash != PASSWORD
        assert u.password_hash.startswith("$2")


# ---------------------------------------------------------------- Keamanan token
def test_t06_token_kedaluwarsa_ditolak(client, data):
    token = create_access_token({"sub": data["users"]["dosen_if"]}, expires_delta=timedelta(minutes=-1))
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_t07_token_dengan_kunci_tanda_tangan_lain_ditolak(client, data):
    palsu = jwt.encode({"sub": data["users"]["super_admin"], "role": "super_admin"},
                       "kunci-palsu-bukan-milik-server", algorithm=settings.ALGORITHM)
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {palsu}"})
    assert r.status_code == 401


def test_t08_token_akun_yang_dinonaktifkan_langsung_ditolak(client, data):
    h = hdr(client, data["users"]["dosen_if"])
    db = TestingSessionLocal()
    u = db.query(User).filter(User.email == data["users"]["dosen_if"]).first()
    u.is_active = False
    db.commit()
    db.close()
    assert client.get("/api/v1/auth/me", headers=h).status_code == 401


def test_t09_akses_tanpa_token_ditolak_pada_endpoint_data_akademik(client, data):
    for url in ["/api/v1/mata-kuliah", f"/api/v1/kalkulasi/{data['mk_if']}", "/api/v1/analitik/prodi",
                "/api/v1/users"]:
        assert client.get(url).status_code == 401, url


# ---------------------------------------------------------------- RBAC dan cakupan prodi
def test_t10_dosen_tidak_boleh_membuat_akun(client, data):
    r = client.post("/api/v1/users", headers=hdr(client, data["users"]["dosen_if"]),
                    json={"nama": "X", "email": "x@sadewa.ac.id", "password": "password123", "role": "dosen"})
    assert r.status_code == 403


def test_t11_dekan_hanya_lihat_tidak_boleh_membuat_cpl(client, data):
    r = client.post("/api/v1/cpl", headers=hdr(client, data["users"]["dekan_ft"]),
                    json={"kurikulum_version_id": 1, "kode": "CPL-X", "deskripsi": "uji"})
    assert r.status_code == 403


def test_t12_dekan_boleh_membaca_analitik_prodi_di_fakultasnya(client, data):
    r = client.get("/api/v1/analitik/prodi", params={"program_studi_id": data["prodi"]["IF"]},
                   headers=hdr(client, data["users"]["dekan_ft"]))
    assert r.status_code == 200


def test_t13_admin_prodi_tidak_boleh_membuka_mata_kuliah_prodi_lain(client, data):
    r = client.get(f"/api/v1/mata-kuliah/{data['mk_el']}", headers=hdr(client, data["users"]["admin_prodi_if"]))
    assert r.status_code in (403, 404)


def test_t14_dosen_prodi_lain_tidak_boleh_menjalankan_kalkulasi(client, data):
    r = client.post(f"/api/v1/kalkulasi/run/{data['mk_if']}", headers=hdr(client, data["users"]["dosen_el"]))
    assert r.status_code == 403


# ---------------------------------------------------------------- Kalkulasi dan sinkronisasi
def test_t15_kalkulasi_dijalankan_dan_hasil_dapat_dibaca(client, data):
    h = hdr(client, data["users"]["dosen_if"])
    r = client.post(f"/api/v1/kalkulasi/run/{data['mk_if']}", headers=h)
    assert r.status_code == 200, r.text
    r2 = client.get(f"/api/v1/kalkulasi/{data['mk_if']}", headers=h)
    assert r2.status_code == 200
    assert r2.json()


def test_t16_sinkronisasi_siap_mengembalikan_not_configured_dan_mencatat_log(client, data):
    h = hdr(client, data["users"]["dosen_if"])
    r = client.post("/api/v1/nilai/sync", params={"mk_id": data["mk_if"], "semester": "Ganjil"}, headers=h)
    assert r.status_code == 200
    assert r.json()["status"] == "not_configured"
    db = TestingSessionLocal()
    n = db.query(SiapSyncLog).filter(SiapSyncLog.mata_kuliah_id == data["mk_if"]).count()
    db.close()
    assert n == 1


# ---------------------------------------------------------------- Alur laporan dan validasi
def _laporan_submitted(client, data):
    h = hdr(client, data["users"]["dosen_if"])
    r = client.post(f"/api/v1/laporan/generate/{data['mk_if']}", headers=h,
                    json={"semester": "Ganjil", "konten": "Isi laporan uji."})
    assert r.status_code == 200, r.text
    lid = r.json()["id"]
    r = client.post(f"/api/v1/laporan/{lid}/submit", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "submitted"
    return lid, h


def test_t17_laporan_diajukan_lalu_disetujui_kaprodi(client, data):
    lid, _ = _laporan_submitted(client, data)
    r = client.post(f"/api/v1/validasi/laporan/{lid}/approve", headers=hdr(client, data["users"]["kaprodi_if"]))
    assert r.status_code == 200
    assert r.json()["status"] == "approved" and r.json()["validated_by"] is not None


def test_t18_laporan_ditolak_dengan_catatan_lalu_dosen_merevisi(client, data):
    lid, h = _laporan_submitted(client, data)
    r = client.post(f"/api/v1/validasi/laporan/{lid}/reject", headers=hdr(client, data["users"]["kaprodi_if"]),
                    json={"remarks": "Tambahkan analisis CPL."})
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    r = client.put(f"/api/v1/laporan/{lid}", headers=h, json={"konten": "Isi laporan revisi."})
    assert r.status_code == 200 and r.json()["status"] == "draft"


def test_t19_admin_prodi_tidak_boleh_menyetujui_laporan(client, data):
    lid, _ = _laporan_submitted(client, data)
    r = client.post(f"/api/v1/validasi/laporan/{lid}/approve", headers=hdr(client, data["users"]["admin_prodi_if"]))
    assert r.status_code == 403


def test_t20_kaprodi_prodi_lain_tidak_boleh_menyetujui_laporan(client, data):
    lid, _ = _laporan_submitted(client, data)
    r = client.post(f"/api/v1/validasi/laporan/{lid}/approve", headers=hdr(client, data["users"]["kaprodi_el"]))
    assert r.status_code == 403


def test_t21_laporan_tanpa_konten_tidak_bisa_diajukan(client, data):
    h = hdr(client, data["users"]["dosen_if"])
    r = client.post(f"/api/v1/laporan/generate/{data['mk_if']}", headers=h, json={"semester": "Ganjil"})
    lid = r.json()["id"]
    assert client.post(f"/api/v1/laporan/{lid}/submit", headers=h).status_code == 400


# ---------------------------------------------------------------- Pengelolaan akun (ubah dan hapus)
def _user_id(email):
    db = TestingSessionLocal()
    uid = db.query(User).filter(User.email == email).first().id
    db.close()
    return uid


def test_t22_admin_prodi_mengubah_nama_akun_dosen_prodinya(client, data):
    uid = _user_id(data["users"]["dosen_if"])
    r = client.put(f"/api/v1/users/{uid}", headers=hdr(client, data["users"]["admin_prodi_if"]),
                   json={"nama": "Dosen IF Diubah"})
    assert r.status_code == 200 and r.json()["nama"] == "Dosen IF Diubah"


def test_t23_hapus_akun_menonaktifkan_dan_akun_tidak_bisa_login(client, data):
    uid = _user_id(data["users"]["dosen_if"])
    r = client.delete(f"/api/v1/users/{uid}", headers=hdr(client, data["users"]["admin_prodi_if"]))
    assert r.status_code == 200
    assert login(client, data["users"]["dosen_if"]).status_code in (401, 403)


def test_t24_admin_prodi_tidak_boleh_mengubah_atau_menghapus_akun_prodi_lain(client, data):
    uid = _user_id(data["users"]["dosen_el"])
    h = hdr(client, data["users"]["admin_prodi_if"])
    assert client.put(f"/api/v1/users/{uid}", headers=h, json={"nama": "X"}).status_code == 403
    assert client.delete(f"/api/v1/users/{uid}", headers=h).status_code == 403
