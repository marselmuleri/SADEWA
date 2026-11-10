"""
Test Spesifikasi OBE: Uji Syarat Siap Nilai Secara Terpisah (Fase 1E).
Memastikan setiap kondisi (1 sampai 6) benar-benar memvalidasi dan menolak input nilai
bila hanya kondisi tersebut yang dilanggar, serta menerima bila seluruh syarat terpenuhi.
"""

from decimal import Decimal
import pytest


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_base_env(client, prefix="sn"):
    client.post("/api/v1/auth/register", json={
        "nama": f"Super Admin {prefix}",
        "email": f"sa_{prefix}@undip.ac.id",
        "password": "password123",
    })
    sa_token = _login(client, f"sa_{prefix}@undip.ac.id", "password123")

    fak = client.post("/api/v1/fakultas", json={"nama": "Fakultas Teknik", "kode": f"FT{prefix}"}, headers=_auth_headers(sa_token)).json()
    prodi = client.post("/api/v1/prodi", json={"nama": "Informatika", "kode": f"IF{prefix}", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()

    client.post("/api/v1/users", json={
        "nama": f"Admin IF {prefix}",
        "email": f"admin_{prefix}@undip.ac.id",
        "password": "password123",
        "role": "admin_prodi",
        "program_studi_id": prodi["id"],
    }, headers=_auth_headers(sa_token))
    admin_token = _login(client, f"admin_{prefix}@undip.ac.id", "password123")

    client.post("/api/v1/users", json={
        "nama": f"Dosen IF {prefix}",
        "email": f"dosen_{prefix}@undip.ac.id",
        "password": "password123",
        "role": "dosen",
        "program_studi_id": prodi["id"],
    }, headers=_auth_headers(admin_token))
    dosen_token = _login(client, f"dosen_{prefix}@undip.ac.id", "password123")

    kur = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024", "semester": "Ganjil"}, headers=_auth_headers(admin_token)).json()
    mk = client.post("/api/v1/mata-kuliah", json={
        "kurikulum_version_id": kur["id"],
        "kode": f"MK-{prefix}",
        "nama": "Mata Kuliah Uji",
        "sks": 3,
        "semester": "Ganjil",
        "tahun_ajaran": "2025/2026",
    }, headers=_auth_headers(admin_token)).json()

    dosen_user = [u for u in client.get("/api/v1/users", headers=_auth_headers(admin_token)).json() if u["email"] == f"dosen_{prefix}@undip.ac.id"][0]
    client.post("/api/v1/pengampu-mata-kuliah", json={
        "mata_kuliah_id": mk["id"],
        "user_id": dosen_user["id"],
        "is_koordinator": True,
    }, headers=_auth_headers(admin_token))

    cpl = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur["id"], "kode": f"CPL-{prefix}", "deskripsi": "CPL"}, headers=_auth_headers(admin_token)).json()
    ik1 = client.post("/api/v1/ik", json={"cpl_id": cpl["id"], "kode": f"IK1-{prefix}", "deskripsi": "IK 1"}, headers=_auth_headers(admin_token)).json()
    ik2 = client.post("/api/v1/ik", json={"cpl_id": cpl["id"], "kode": f"IK2-{prefix}", "deskripsi": "IK 2"}, headers=_auth_headers(admin_token)).json()

    mhs = client.post("/api/v1/mahasiswa", json={
        "nim": f"NIM-{prefix}",
        "nama": "Mahasiswa Uji",
        "semester_aktif": 1,
        "status_masuk": "Reguler",
    }, headers=_auth_headers(admin_token)).json()

    peserta = client.post("/api/v1/peserta-mata-kuliah", json={
        "mata_kuliah_id": mk["id"],
        "mahasiswa_id": mhs["id"],
        "kelas": "A",
    }, headers=_auth_headers(admin_token)).json()

    je = client.post("/api/v1/jenis-evaluasi", json={"nama": "Evaluasi", "urutan": 1}, headers=_auth_headers(admin_token)).json()
    bp1 = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je["id"], "nama": f"Tugas-{prefix}"}, headers=_auth_headers(admin_token)).json()
    bp2 = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je["id"], "nama": f"Ujian-{prefix}"}, headers=_auth_headers(admin_token)).json()

    return {
        "admin_token": admin_token,
        "dosen_token": dosen_token,
        "mk_id": mk["id"],
        "ik1": ik1["id"],
        "ik2": ik2["id"],
        "bp1": bp1["id"],
        "bp2": bp2["id"],
        "peserta_id": peserta["id"],
    }


def test_kondisi_1_bobot_cpmk_bukan_100_ditolak(client):
    """Kondisi 1: Total bobot CPMK != 100 ditolak 400."""
    env = _setup_base_env(client, "k1")
    adm, dos, mk_id, ik1 = env["admin_token"], env["dosen_token"], env["mk_id"], env["ik1"]

    # CPMK bobot 90 (bukan 100)
    cpmk = client.post("/api/v1/cpmk", json={"mata_kuliah_id": mk_id, "kode": "C1", "deskripsi": "C1", "level_taksonomi": "C3", "bobot": 90.0}, headers=_auth_headers(adm)).json()
    client.put(f"/api/v1/cpmk/{cpmk['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 90.0}]}, headers=_auth_headers(adm))

    # Bentuk penilaian 100, matriks cocok dengan barisnya
    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": env["bp1"], "bobot": 100.0, "semester": "Ganjil"}, headers=_auth_headers(dos)).json()
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 100.0}]}, headers=_auth_headers(dos))

    resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": env["peserta_id"], "mk_bentuk_penilaian_id": mbp["id"], "ik_id": ik1, "nilai": 80.0}],
    }, headers=_auth_headers(dos))
    assert resp.status_code == 400
    assert "total bobot cpmk" in resp.json()["detail"].lower()


def test_kondisi_2_cpmk_tanpa_mapping_ditolak(client):
    """Kondisi 2: CPMK berbobot > 0 tanpa mapping IK ditolak 400."""
    env = _setup_base_env(client, "k2")
    adm, dos, mk_id, ik1 = env["admin_token"], env["dosen_token"], env["mk_id"], env["ik1"]

    # CPMK 100 tapi tanpa mapping IK
    client.post("/api/v1/cpmk", json={"mata_kuliah_id": mk_id, "kode": "C2", "deskripsi": "C2", "level_taksonomi": "C3", "bobot": 100.0}, headers=_auth_headers(adm))

    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": env["bp1"], "bobot": 100.0, "semester": "Ganjil"}, headers=_auth_headers(dos)).json()
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 100.0}]}, headers=_auth_headers(dos))

    resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": env["peserta_id"], "mk_bentuk_penilaian_id": mbp["id"], "ik_id": ik1, "nilai": 80.0}],
    }, headers=_auth_headers(dos))
    assert resp.status_code == 400
    assert "belum punya mapping" in resp.json()["detail"].lower()


def test_kondisi_3_total_bobot_bentuk_penilaian_bukan_100_ditolak(client):
    """Kondisi 3: Total bobot Bentuk Penilaian != 100 ditolak 400."""
    env = _setup_base_env(client, "k3")
    adm, dos, mk_id, ik1 = env["admin_token"], env["dosen_token"], env["mk_id"], env["ik1"]

    cpmk = client.post("/api/v1/cpmk", json={"mata_kuliah_id": mk_id, "kode": "C3", "deskripsi": "C3", "level_taksonomi": "C3", "bobot": 100.0}, headers=_auth_headers(adm)).json()
    client.put(f"/api/v1/cpmk/{cpmk['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 100.0}]}, headers=_auth_headers(adm))

    # MBP hanya 80 (bukan 100)
    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": env["bp1"], "bobot": 80.0, "semester": "Ganjil"}, headers=_auth_headers(dos)).json()
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 80.0}]}, headers=_auth_headers(dos))

    resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": env["peserta_id"], "mk_bentuk_penilaian_id": mbp["id"], "ik_id": ik1, "nilai": 80.0}],
    }, headers=_auth_headers(dos))
    assert resp.status_code == 400
    assert "total bobot bentuk penilaian" in resp.json()["detail"].lower()


def test_kondisi_4_baris_matriks_tidak_sama_dengan_bobot_bentuk_ditolak(client):
    """Kondisi 4: Jumlah baris matriks != bobot bentuk penilaian tersebut ditolak 400."""
    env = _setup_base_env(client, "k4")
    adm, dos, mk_id, ik1 = env["admin_token"], env["dosen_token"], env["mk_id"], env["ik1"]

    cpmk = client.post("/api/v1/cpmk", json={"mata_kuliah_id": mk_id, "kode": "C4", "deskripsi": "C4", "level_taksonomi": "C3", "bobot": 100.0}, headers=_auth_headers(adm)).json()
    client.put(f"/api/v1/cpmk/{cpmk['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 100.0}]}, headers=_auth_headers(adm))

    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": env["bp1"], "bobot": 100.0, "semester": "Ganjil"}, headers=_auth_headers(dos)).json()
    # Baris matriks hanya 90 padahal bobot bentuk = 100
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 90.0}]}, headers=_auth_headers(dos))

    resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": env["peserta_id"], "mk_bentuk_penilaian_id": mbp["id"], "ik_id": ik1, "nilai": 80.0}],
    }, headers=_auth_headers(dos))
    assert resp.status_code == 400
    assert "bobot ik dalam bentuk penilaian" in resp.json()["detail"].lower()


def test_kondisi_5_kolom_matriks_tidak_sama_dengan_bobot_ik_ditolak(client):
    """Kondisi 5: Jumlah kolom IK di matriks != bobot IK pada mapping CPMK ditolak 400."""
    env = _setup_base_env(client, "k5")
    adm, dos, mk_id, ik1, ik2 = env["admin_token"], env["dosen_token"], env["mk_id"], env["ik1"], env["ik2"]

    # CPMK memetakan IK1=60, IK2=40 (total 100)
    cpmk = client.post("/api/v1/cpmk", json={"mata_kuliah_id": mk_id, "kode": "C5", "deskripsi": "C5", "level_taksonomi": "C3", "bobot": 100.0}, headers=_auth_headers(adm)).json()
    client.put(f"/api/v1/cpmk/{cpmk['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 60.0}, {"ik_id": ik2, "bobot": 40.0}]}, headers=_auth_headers(adm))

    # MBP = 100, baris = 100 (50 + 50 = 100), tapi kolom IK1=50 (!= 60) dan IK2=50 (!= 40)
    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": env["bp1"], "bobot": 100.0, "semester": "Ganjil"}, headers=_auth_headers(dos)).json()
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp['id']}/map-ik", json={"mappings": [
        {"ik_id": ik1, "bobot": 50.0},
        {"ik_id": ik2, "bobot": 50.0},
    ]}, headers=_auth_headers(dos))

    resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": env["peserta_id"], "mk_bentuk_penilaian_id": mbp["id"], "ik_id": ik1, "nilai": 80.0}],
    }, headers=_auth_headers(dos))
    assert resp.status_code == 400
    assert "bobot kolom matriks untuk ik" in resp.json()["detail"].lower()


def test_kondisi_6_matriks_berisi_ik_di_luar_cpmk_ditolak(client):
    """Kondisi 6: Matriks memiliki IK yang tidak dimapping ke CPMK mata kuliah tersebut ditolak 400."""
    env = _setup_base_env(client, "k6")
    adm, dos, mk_id, ik1, ik2 = env["admin_token"], env["dosen_token"], env["mk_id"], env["ik1"], env["ik2"]

    # CPMK hanya memetakan IK1 = 100
    cpmk = client.post("/api/v1/cpmk", json={"mata_kuliah_id": mk_id, "kode": "C6", "deskripsi": "C6", "level_taksonomi": "C3", "bobot": 100.0}, headers=_auth_headers(adm)).json()
    client.put(f"/api/v1/cpmk/{cpmk['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 100.0}]}, headers=_auth_headers(adm))

    # Matriks memasukkan IK2 (yang tidak ada di CPMK)
    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": env["bp1"], "bobot": 100.0, "semester": "Ganjil"}, headers=_auth_headers(dos)).json()
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp['id']}/map-ik", json={"mappings": [
        {"ik_id": ik1, "bobot": 80.0},
        {"ik_id": ik2, "bobot": 20.0},
    ]}, headers=_auth_headers(dos))

    resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": env["peserta_id"], "mk_bentuk_penilaian_id": mbp["id"], "ik_id": ik1, "nilai": 80.0}],
    }, headers=_auth_headers(dos))
    assert resp.status_code == 400
    assert "tidak dimapping ke cpmk" in resp.json()["detail"].lower()


def test_kasus_lengkap_semua_syarat_terpenuhi_diterima(client):
    """Kasus lengkap: Seluruh syarat 1-6 valid -> input nilai diterima (HTTP 200)."""
    env = _setup_base_env(client, "kl")
    adm, dos, mk_id, ik1, ik2 = env["admin_token"], env["dosen_token"], env["mk_id"], env["ik1"], env["ik2"]

    # 1. CPMK total 100 (CPMK1=60, CPMK2=40)
    # 2. Tiap CPMK punya mapping (CPMK1 -> IK1 60, CPMK2 -> IK2 40)
    c1 = client.post("/api/v1/cpmk", json={"mata_kuliah_id": mk_id, "kode": "CP1", "deskripsi": "CP1", "level_taksonomi": "C3", "bobot": 60.0}, headers=_auth_headers(adm)).json()
    client.put(f"/api/v1/cpmk/{c1['id']}/map-ik", json={"mappings": [{"ik_id": ik1, "bobot": 60.0}]}, headers=_auth_headers(adm))

    c2 = client.post("/api/v1/cpmk", json={"mata_kuliah_id": mk_id, "kode": "CP2", "deskripsi": "CP2", "level_taksonomi": "C3", "bobot": 40.0}, headers=_auth_headers(adm)).json()
    client.put(f"/api/v1/cpmk/{c2['id']}/map-ik", json={"mappings": [{"ik_id": ik2, "bobot": 40.0}]}, headers=_auth_headers(adm))

    # 3. MBP total 100 (Tugas=40, Ujian=60)
    mbp1 = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": env["bp1"], "bobot": 40.0, "semester": "Ganjil"}, headers=_auth_headers(dos)).json()
    mbp2 = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": env["bp2"], "bobot": 60.0, "semester": "Ganjil"}, headers=_auth_headers(dos)).json()

    # 4 & 5 & 6. Matriks:
    # Tugas (40): IK1=20, IK2=20 (baris sum=40)
    # Ujian (60): IK1=40, IK2=20 (baris sum=60)
    # Kolom IK1 = 20 + 40 = 60 (cocok dengan IK1 di CPMK1=60)
    # Kolom IK2 = 20 + 20 = 40 (cocok dengan IK2 di CPMK2=40)
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp1['id']}/map-ik", json={"mappings": [
        {"ik_id": ik1, "bobot": 20.0},
        {"ik_id": ik2, "bobot": 20.0},
    ]}, headers=_auth_headers(dos))

    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp2['id']}/map-ik", json={"mappings": [
        {"ik_id": ik1, "bobot": 40.0},
        {"ik_id": ik2, "bobot": 20.0},
    ]}, headers=_auth_headers(dos))

    # Input nilai mahasiswa untuk IK1 pada Tugas
    resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [
            {"peserta_mata_kuliah_id": env["peserta_id"], "mk_bentuk_penilaian_id": mbp1["id"], "ik_id": ik1, "nilai": 88.0},
        ],
    }, headers=_auth_headers(dos))

    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert float(resp.json()[0]["nilai"]) == 88.0

