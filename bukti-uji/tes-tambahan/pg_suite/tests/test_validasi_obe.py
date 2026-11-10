"""
Test Spesifikasi OBE: T4 Validasi Konfigurasi OBE (C3, C4, C12, C13, dan Syarat Siap Nilai).

Constraint & Validasi:
- C3: Total bobot IK dalam satu CPMK HARUS sama persis dengan bobot CPMK.
      (12.0 ditolak jika bobot 12.5; 12.51 ditolak; 12.5 diterima; 4.0+4.5+4.0 diterima).
      Bobot IK 0 diperbolehkan selama total sama.
      Mengubah bobot CPMK setelah mapping ada harus divalidasi/ditolak jika mapping tidak lagi cocok.
- C4: IK yang dimapping ke CPMK harus milik prodi mata kuliah tersebut (tolak IK prodi lain).
- C12: IK tanpa CP/CPL ditolak.
- C13: CPMK dengan bobot > 0 tanpa mapping IK membuat mata kuliah TIDAK siap dinilai.
- Syarat Siap Nilai (C2, C5, C6, C7): Input nilai ditolak jika mata kuliah belum siap dinilai:
  * C2: Total bobot CPMK != 100
  * C5: Total bobot bentuk penilaian kelas != 100
  * C6: Matriks baris != bobot bentuk penilaian, atau kolom != bobot IK mapping
  * C7: Setting bobot matriks belum selesai
  * Kasus lengkap: semua syarat valid -> input nilai diterima.
"""

from decimal import Decimal
import pytest


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_validasi_env(client):
    # Setup Super Admin
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin",
        "email": "sa_val@undip.ac.id",
        "password": "password123",
    })
    sa_token = _login(client, "sa_val@undip.ac.id", "password123")

    fak = client.post("/api/v1/fakultas", json={"nama": "Fakultas Teknik", "kode": "FT"}, headers=_auth_headers(sa_token)).json()
    prodi_if = client.post("/api/v1/prodi", json={"nama": "Informatika", "kode": "IF", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()
    prodi_el = client.post("/api/v1/prodi", json={"nama": "Teknik Elektro", "kode": "EL", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()

    # Admin IF
    client.post("/api/v1/users", json={
        "nama": "Admin IF",
        "email": "admin_if_val@undip.ac.id",
        "password": "password123",
        "role": "admin_prodi",
        "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(sa_token))
    admin_if_token = _login(client, "admin_if_val@undip.ac.id", "password123")

    # Admin EL
    client.post("/api/v1/users", json={
        "nama": "Admin EL",
        "email": "admin_el_val@undip.ac.id",
        "password": "password123",
        "role": "admin_prodi",
        "program_studi_id": prodi_el["id"],
    }, headers=_auth_headers(sa_token))
    admin_el_token = _login(client, "admin_el_val@undip.ac.id", "password123")

    # Dosen IF
    client.post("/api/v1/users", json={
        "nama": "Dosen IF Val",
        "email": "dosen_if_val@undip.ac.id",
        "password": "password123",
        "role": "dosen",
        "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(admin_if_token))
    dosen_if_token = _login(client, "dosen_if_val@undip.ac.id", "password123")

    # Kurikulum & MK IF
    kur = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024", "semester": "Ganjil"}, headers=_auth_headers(admin_if_token)).json()
    mk_if = client.post("/api/v1/mata-kuliah", json={
        "kurikulum_version_id": kur["id"],
        "kode": "IF301",
        "nama": "Basis Data",
        "sks": 3,
        "semester": "Ganjil",
        "tahun_ajaran": "2025/2026",
    }, headers=_auth_headers(admin_if_token)).json()

    # Assign Dosen Pengampu
    dosen_user = [u for u in client.get("/api/v1/users", headers=_auth_headers(admin_if_token)).json() if u["email"] == "dosen_if_val@undip.ac.id"][0]
    client.post("/api/v1/pengampu-mata-kuliah", json={
        "mata_kuliah_id": mk_if["id"],
        "user_id": dosen_user["id"],
        "is_koordinator": True,
    }, headers=_auth_headers(admin_if_token))

    # CPL & IK IF
    cpl_if = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur["id"], "kode": "CPL-IF1", "deskripsi": "Kompetensi IF 1"}, headers=_auth_headers(admin_if_token)).json()
    ik_if1 = client.post("/api/v1/ik", json={"cpl_id": cpl_if["id"], "kode": "IK-IF1a", "deskripsi": "IK IF 1a"}, headers=_auth_headers(admin_if_token)).json()
    ik_if2 = client.post("/api/v1/ik", json={"cpl_id": cpl_if["id"], "kode": "IK-IF1b", "deskripsi": "IK IF 1b"}, headers=_auth_headers(admin_if_token)).json()
    ik_if3 = client.post("/api/v1/ik", json={"cpl_id": cpl_if["id"], "kode": "IK-IF1c", "deskripsi": "IK IF 1c"}, headers=_auth_headers(admin_if_token)).json()

    # CPL & IK EL (Prodi lain)
    kur_el = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024", "semester": "Ganjil"}, headers=_auth_headers(admin_el_token)).json()
    cpl_el = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur_el["id"], "kode": "CPL-EL1", "deskripsi": "Kompetensi EL 1"}, headers=_auth_headers(admin_el_token)).json()
    ik_el = client.post("/api/v1/ik", json={"cpl_id": cpl_el["id"], "kode": "IK-EL1a", "deskripsi": "IK EL 1a"}, headers=_auth_headers(admin_el_token)).json()

    return {
        "admin_if_token": admin_if_token,
        "admin_el_token": admin_el_token,
        "dosen_if_token": dosen_if_token,
        "mk_if": mk_if,
        "ik_if1": ik_if1,
        "ik_if2": ik_if2,
        "ik_if3": ik_if3,
        "ik_el": ik_el,
    }


def test_c3_total_bobot_ik_harus_sama_persis_dengan_cpmk(client):
    """
    C3: Total bobot IK dalam satu CPMK HARUS sama persis dengan bobot CPMK.
    Untuk CPMK dengan bobot 12.5:
    - 12.0 -> DITOLAK (400)
    - 12.51 -> DITOLAK (400)
    - 12.5 -> DITERIMA (200)
    - 4.0 + 4.5 + 4.0 = 12.5 -> DITERIMA (200)
    - Bobot IK tunggal 0 boleh selama total sama (misal 12.5 + 0 = 12.5).
    """
    env = _setup_validasi_env(client)
    admin_token = env["admin_if_token"]
    mk_id = env["mk_if"]["id"]
    ik1 = env["ik_if1"]["id"]
    ik2 = env["ik_if2"]["id"]
    ik3 = env["ik_if3"]["id"]

    cpmk = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk_id,
        "kode": "CPMK-C3",
        "deskripsi": "Uji C3",
        "level_taksonomi": "C3",
        "bobot": 12.5,
    }, headers=_auth_headers(admin_token)).json()

    cpmk_id = cpmk["id"]

    # 1. Total 12.0 (kurang dari 12.5) -> HARUS DITOLAK
    resp_under = client.put(f"/api/v1/cpmk/{cpmk_id}/map-ik", json={"mappings": [
        {"ik_id": ik1, "bobot": 12.0},
    ]}, headers=_auth_headers(admin_token))
    assert resp_under.status_code == 400

    # 2. Total 12.51 (lebih dari 12.5) -> HARUS DITOLAK
    resp_over = client.put(f"/api/v1/cpmk/{cpmk_id}/map-ik", json={"mappings": [
        {"ik_id": ik1, "bobot": 12.51},
    ]}, headers=_auth_headers(admin_token))
    assert resp_over.status_code == 400

    # 3. Total 12.5 pas (tunggal) -> DITERIMA
    resp_exact = client.put(f"/api/v1/cpmk/{cpmk_id}/map-ik", json={"mappings": [
        {"ik_id": ik1, "bobot": 12.5},
    ]}, headers=_auth_headers(admin_token))
    assert resp_exact.status_code == 200

    # 4. Total 4.0 + 4.5 + 4.0 = 12.5 (tiga IK) -> DITERIMA
    resp_multi = client.put(f"/api/v1/cpmk/{cpmk_id}/map-ik", json={"mappings": [
        {"ik_id": ik1, "bobot": 4.0},
        {"ik_id": ik2, "bobot": 4.5},
        {"ik_id": ik3, "bobot": 4.0},
    ]}, headers=_auth_headers(admin_token))
    assert resp_multi.status_code == 200

    # 5. Bobot IK bernilai 0 diperbolehkan asalkan total sama persis (12.5 + 0 = 12.5)
    resp_with_zero = client.put(f"/api/v1/cpmk/{cpmk_id}/map-ik", json={"mappings": [
        {"ik_id": ik1, "bobot": 12.5},
        {"ik_id": ik2, "bobot": 0.0},
    ]}, headers=_auth_headers(admin_token))
    assert resp_with_zero.status_code == 200


def test_c3_revalidasi_saat_bobot_cpmk_diubah(client):
    """
    Jika bobot CPMK diubah setelah mapping IK ada, perubahan harus ditolak
    jika bobot baru tidak cocok dengan mapping IK yang sudah ada.
    """
    env = _setup_validasi_env(client)
    admin_token = env["admin_if_token"]
    mk_id = env["mk_if"]["id"]
    ik1 = env["ik_if1"]["id"]

    cpmk = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk_id,
        "kode": "CPMK-REV",
        "deskripsi": "Uji Revalidasi C3",
        "level_taksonomi": "C3",
        "bobot": 20.0,
    }, headers=_auth_headers(admin_token)).json()

    # Mapping IK total 20.0
    client.put(f"/api/v1/cpmk/{cpmk['id']}/map-ik", json={"mappings": [
        {"ik_id": ik1, "bobot": 20.0},
    ]}, headers=_auth_headers(admin_token))

    # Ubah bobot CPMK menjadi 25.0 tanpa mengubah mapping IK -> HARUS DITOLAK (400)
    resp_update = client.put(f"/api/v1/cpmk/{cpmk['id']}", json={
        "bobot": 25.0,
    }, headers=_auth_headers(admin_token))
    assert resp_update.status_code == 400


def test_c4_tolak_mapping_ik_dari_prodi_lain(client):
    """
    C4: IK yang dimapping ke CPMK harus milik prodi mata kuliah tersebut.
    Memetakan IK prodi EL ke CPMK mata kuliah IF harus ditolak (400 / 403).
    """
    env = _setup_validasi_env(client)
    admin_if_token = env["admin_if_token"]
    mk_id = env["mk_if"]["id"]
    ik_el_id = env["ik_el"]["id"]

    cpmk = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk_id,
        "kode": "CPMK-C4",
        "deskripsi": "Uji C4",
        "level_taksonomi": "C3",
        "bobot": 10.0,
    }, headers=_auth_headers(admin_if_token)).json()

    resp = client.put(f"/api/v1/cpmk/{cpmk['id']}/map-ik", json={"mappings": [
        {"ik_id": ik_el_id, "bobot": 10.0},
    ]}, headers=_auth_headers(admin_if_token))

    assert resp.status_code in (400, 403)


def test_c12_tolak_ik_tanpa_cpl(client):
    """
    C12: IK tanpa CPL ditolak (400 / 422).
    """
    env = _setup_validasi_env(client)
    admin_token = env["admin_if_token"]

    resp = client.post("/api/v1/ik", json={
        "kode": "IK-YATIM",
        "deskripsi": "IK tanpa CPL",
    }, headers=_auth_headers(admin_token))

    assert resp.status_code in (400, 422)


def test_c13_cpmk_tanpa_mapping_ik_tidak_siap_dinilai(client):
    """
    C13: CPMK berbobot > 0 tanpa mapping IK membuat mata kuliah TIDAK siap dinilai.
    Endpoint validasi-bobot harus mengembalikan valid=False dan pesan peringatan.
    """
    env = _setup_validasi_env(client)
    admin_token = env["admin_if_token"]
    mk_id = env["mk_if"]["id"]

    # Buat CPMK tanpa mapping IK
    client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk_id,
        "kode": "CPMK-KOSONG",
        "deskripsi": "Tanpa mapping",
        "level_taksonomi": "C3",
        "bobot": 50.0,
    }, headers=_auth_headers(admin_token))

    resp = client.post(f"/api/v1/kalkulasi/validasi-bobot?mata_kuliah_id={mk_id}", headers=_auth_headers(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is False
    assert any("belum punya mapping" in w.lower() for w in data["warnings"])


def test_syarat_siap_dinilai_dan_penolakan_input_nilai(client):
    """
    Syarat Siap Nilai (C2, C5, C6, C7):
    Input nilai HARUS DITOLAK jika salah satu syarat berikut belum terpenuhi:
    1. C2: Total bobot CPMK != 100
    2. C5: Total bobot bentuk penilaian kelas != 100
    3. C6: Matriks baris != bobot bentuk atau kolom != bobot IK
    4. Kasus lengkap: seluruh syarat terpenuhi -> input nilai diterima.
    """
    env = _setup_validasi_env(client)
    admin_token = env["admin_if_token"]
    dosen_token = env["dosen_if_token"]
    mk_id = env["mk_if"]["id"]
    ik1 = env["ik_if1"]["id"]

    # Mahasiswa & Peserta
    mhs = client.post("/api/v1/mahasiswa", json={
        "nim": "24060120120003",
        "nama": "Dina Rahayu",
        "semester_aktif": 1,
        "status_masuk": "Reguler",
    }, headers=_auth_headers(admin_token)).json()

    peserta = client.post("/api/v1/peserta-mata-kuliah", json={
        "mata_kuliah_id": mk_id,
        "mahasiswa_id": mhs["id"],
        "kelas": "A",
    }, headers=_auth_headers(admin_token)).json()

    # KONDISI 1: Belum ada konfigurasi sama sekali -> input nilai ditolak (400)
    resp_belum_siap = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id,
        "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": peserta["id"], "mk_bentuk_penilaian_id": 999, "ik_id": ik1, "nilai": 80.0}],
    }, headers=_auth_headers(dosen_token))
    assert resp_belum_siap.status_code in (400, 404)

    # KONDISI 2: CPMK bobot hanya 60 (C2 belum terpenuhi: total != 100)
    cpmk1 = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk_id, "kode": "CPMK1", "deskripsi": "CPMK1", "level_taksonomi": "C3", "bobot": 60.0
    }, headers=_auth_headers(admin_token)).json()
    client.put(f"/api/v1/cpmk/{cpmk1['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 60.0}]}, headers=_auth_headers(admin_token))

    # Jenis evaluasi & Bentuk penilaian
    je = client.post("/api/v1/jenis-evaluasi", json={"nama": "Evaluasi", "urutan": 1}, headers=_auth_headers(admin_token)).json()
    bp = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je["id"], "nama": "Ujian"}, headers=_auth_headers(admin_token)).json()

    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={
        "mata_kuliah_id": mk_id, "bentuk_penilaian_id": bp["id"], "bobot": 100.0, "semester": "Ganjil"
    }, headers=_auth_headers(dosen_token)).json()

    # Input nilai masih ditolak karena total bobot CPMK = 60 (!= 100)
    resp_cpmk_not_100 = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id,
        "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": peserta["id"], "mk_bentuk_penilaian_id": mbp["id"], "ik_id": ik1, "nilai": 80.0}],
    }, headers=_auth_headers(dosen_token))
    assert resp_cpmk_not_100.status_code == 400

    # LENGKAPI KONFIGURASI VALID (Kasus Lengkap)
    # Tambah CPMK2 bobot 40 sehingga total CPMK = 100
    cpmk2 = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk_id, "kode": "CPMK2", "deskripsi": "CPMK2", "level_taksonomi": "C3", "bobot": 40.0
    }, headers=_auth_headers(admin_token)).json()
    client.put(f"/api/v1/cpmk/{cpmk2['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 40.0}]}, headers=_auth_headers(admin_token))

    # Matriks setting bobot kelas (Tugas = 100, IK1 = 100)
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp['id']}/map-ik", json={"mappings": [
        {"ik_id": ik1, "bobot": 100.0},
    ]}, headers=_auth_headers(dosen_token))

    # Input nilai sekarang HARUS DITERIMA (200)
    resp_lengkap = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id,
        "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": peserta["id"], "mk_bentuk_penilaian_id": mbp["id"], "ik_id": ik1, "nilai": 85.0}],
    }, headers=_auth_headers(dosen_token))
    assert resp_lengkap.status_code == 200
