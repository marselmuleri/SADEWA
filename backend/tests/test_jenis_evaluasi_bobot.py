"""
Test Spesifikasi OBE: Bobot Jenis Evaluasi per Prodi dan Syarat Siap Dinilai (Fase 4 - Keputusan K-D).

Spesifikasi & Keputusan:
1. Kolom bobot (Numeric(5, 2), nullable=True) pada jenis_evaluasi.
2. Hak akses: Dosen dilarang (403), Admin prodi lain dilarang (403).
3. Validasi bobot jenis evaluasi:
   - Bobot harus di antara 0 sampai 100.
4. Syarat Siap Dinilai (Kondisi ke-7):
   - Jika prodi tidak mengatur bobot jenis evaluasi (seluruh bobot is None), sistem tidak memaksa total 100 (opsional).
   - Jika minimal satu jenis evaluasi prodi memiliki bobot != None, maka total bobot seluruh jenis evaluasi prodi HARUS tepat 100%.
   - Jika total != 100, cek_siap_dinilai mengembalikan issue dan endpoint input nilai menolak dengan 400 Bad Request.
   - Jika total == 100, cek_siap_dinilai lolos.
"""

from decimal import Decimal
import pytest


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_je_env(client, prefix="je"):
    client.post("/api/v1/auth/register", json={
        "nama": f"Super Admin {prefix}",
        "email": f"sa_{prefix}@undip.ac.id",
        "password": "password123",
    })
    sa_token = _login(client, f"sa_{prefix}@undip.ac.id", "password123")

    fak = client.post("/api/v1/fakultas", json={"nama": "Fakultas Teknik", "kode": f"FT{prefix}"}, headers=_auth_headers(sa_token)).json()
    prodi_if = client.post("/api/v1/prodi", json={"nama": "Informatika", "kode": f"IF{prefix}", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()
    prodi_el = client.post("/api/v1/prodi", json={"nama": "Elektro", "kode": f"EL{prefix}", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()

    # Admin IF
    client.post("/api/v1/users", json={
        "nama": f"Admin IF {prefix}", "email": f"admin_if_{prefix}@undip.ac.id", "password": "password123",
        "role": "admin_prodi", "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(sa_token))
    admin_if_token = _login(client, f"admin_if_{prefix}@undip.ac.id", "password123")

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
        "admin_el_token": admin_el_token,
        "dosen_if_token": dosen_if_token,
        "prodi_if_id": prodi_if["id"],
        "prodi_el_id": prodi_el["id"],
    }


def test_api_validasi_bobot_jenis_evaluasi(client):
    """
    1. Dosen dilarang create/update jenis evaluasi (403).
    2. Bobot di luar 0-100 ditolak (400 atau 422).
    3. Admin prodi dapat menyimpan bobot jenis evaluasi.
    """
    env = _setup_je_env(client, "val")
    admin_token = env["admin_if_token"]
    dosen_token = env["dosen_if_token"]

    # 1. Dosen mencoba post -> 403
    resp_dosen = client.post("/api/v1/jenis-evaluasi", json={"nama": "Kuis", "bobot": 20.0}, headers=_auth_headers(dosen_token))
    assert resp_dosen.status_code == 403

    # 2. Bobot negatif -> 400 / 422
    resp_neg = client.post("/api/v1/jenis-evaluasi", json={"nama": "Negatif", "bobot": -5.0}, headers=_auth_headers(admin_token))
    assert resp_neg.status_code in (400, 422)

    # 3. Bobot > 100 -> 400 / 422
    resp_lebih = client.post("/api/v1/jenis-evaluasi", json={"nama": "Lebih", "bobot": 110.0}, headers=_auth_headers(admin_token))
    assert resp_lebih.status_code in (400, 422)

    # 4. Admin berhasil membuat dengan bobot valid
    resp_ok = client.post("/api/v1/jenis-evaluasi", json={"nama": "Formatif", "bobot": 40.0, "urutan": 1}, headers=_auth_headers(admin_token))
    assert resp_ok.status_code == 200
    assert resp_ok.json()["bobot"] == 40.0


def test_cek_siap_dinilai_kondisi_bobot_jenis_evaluasi(client):
    """
    Uji Kondisi 7 cek_siap_dinilai:
    Jika minimal 1 jenis evaluasi di prodi berbobot != None, total seluruh jenis evaluasi harus 100%.
    """
    env = _setup_je_env(client, "siap")
    admin_token = env["admin_if_token"]
    prodi_id = env["prodi_if_id"]

    # Setup MK, CPL, IK, CPMK, MBP lengkap siap dinilai
    kur = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024", "semester": "Ganjil"}, headers=_auth_headers(admin_token)).json()
    mk = client.post("/api/v1/mata-kuliah", json={
        "kurikulum_version_id": kur["id"],
        "kode": "MK-JE",
        "nama": "Mata Kuliah JE",
        "sks": 3,
        "semester": "Ganjil",
        "tahun_ajaran": "2025/2026",
    }, headers=_auth_headers(admin_token)).json()

    users_list = client.get("/api/v1/users", headers=_auth_headers(admin_token)).json()
    dosen_user = [u for u in users_list if u["email"] == "dosen_if_siap@undip.ac.id"][0]
    client.post("/api/v1/pengampu-mata-kuliah", json={
        "mata_kuliah_id": mk["id"], "user_id": dosen_user["id"], "is_koordinator": True,
    }, headers=_auth_headers(admin_token))

    cpl = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur["id"], "kode": "CPL-JE", "deskripsi": "CPL"}, headers=_auth_headers(admin_token)).json()
    ik = client.post("/api/v1/ik", json={"cpl_id": cpl["id"], "kode": "IK-JE", "deskripsi": "IK"}, headers=_auth_headers(admin_token)).json()

    cpmk = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk["id"], "kode": "CPMK-JE", "deskripsi": "CPMK", "level_taksonomi": "C3", "bobot": 100.0,
    }, headers=_auth_headers(admin_token)).json()
    client.put(f"/api/v1/cpmk/{cpmk['id']}/map-ik", json={"mappings": [{"ik_id": ik["id"], "bobot": 100.0}]}, headers=_auth_headers(admin_token))

    # Buat mahasiswa dan peserta
    mhs = client.post("/api/v1/mahasiswa", json={"nim": "240601240077", "nama": "Mhs JE", "semester_aktif": 1, "status_masuk": "Reguler"}, headers=_auth_headers(admin_token)).json()
    peserta = client.post("/api/v1/peserta-mata-kuliah", json={"mata_kuliah_id": mk["id"], "mahasiswa_id": mhs["id"], "kelas": "A"}, headers=_auth_headers(admin_token)).json()

    # Kasus A: Buat jenis evaluasi dengan bobot tidak 100 (misal Formatif 40% saja)
    je1 = client.post("/api/v1/jenis-evaluasi", json={"nama": "Formatif", "bobot": 40.0, "urutan": 1}, headers=_auth_headers(admin_token)).json()
    bp = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je1["id"], "nama": "Tugas"}, headers=_auth_headers(admin_token)).json()
    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={
        "mata_kuliah_id": mk["id"], "bentuk_penilaian_id": bp["id"], "bobot": 100.0, "semester": "Ganjil",
    }, headers=_auth_headers(admin_token)).json()
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp['id']}/map-ik", json={"mappings": [{"ik_id": ik["id"], "bobot": 100.0}]}, headers=_auth_headers(admin_token))

    # Cek via endpoint input nilai manual: harus ditolak 400 karena total bobot jenis evaluasi prodi belum 100%
    input_resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk["id"],
        "semester": "Ganjil",
        "records": [{
            "peserta_mata_kuliah_id": peserta["id"],
            "mk_bentuk_penilaian_id": mbp["id"],
            "ik_id": ik["id"],
            "nilai": 80.0,
        }],
    }, headers=_auth_headers(admin_token))
    assert input_resp.status_code == 400
    assert "jenis evaluasi" in input_resp.json()["detail"].lower()

    # Kasus B: Tambah jenis evaluasi kedua sehingga total tepat 100 (Sumatif 60%)
    je2 = client.post("/api/v1/jenis-evaluasi", json={"nama": "Sumatif", "bobot": 60.0, "urutan": 2}, headers=_auth_headers(admin_token)).json()

    input_resp2 = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk["id"],
        "semester": "Ganjil",
        "records": [{
            "peserta_mata_kuliah_id": peserta["id"],
            "mk_bentuk_penilaian_id": mbp["id"],
            "ik_id": ik["id"],
            "nilai": 80.0,
        }],
    }, headers=_auth_headers(admin_token))
    assert input_resp2.status_code == 200

