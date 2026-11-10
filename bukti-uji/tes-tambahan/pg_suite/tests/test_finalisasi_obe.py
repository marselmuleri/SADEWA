"""
Test Spesifikasi OBE: Finalisasi Nilai per Peserta dan Penguncian Nilai (Fase 1).
Sesuai Keputusan K-B:
1. Finalisasi terikat ke SATU peserta_mata_kuliah_id.
2. Nilai dihitung SERVER dari nilai tersimpan; klien tidak mengirim nilai_akhir.
3. Ditolak jika mata kuliah belum siap dinilai (cek_siap_dinilai).
4. Ditolak jika peserta belum memiliki nilai satu pun.
5. Ditolak jika kurikulum belum memiliki skala nilai.
6. Dosen pengampu, admin_prodi, dan kaprodi berhak memfinalisasi. Dosen luar tolak 403. Admin prodi lain tolak 403.
7. Finalisasi ulang peserta yang sudah final mengembalikan 409 Conflict.
8. Setelah final, input nilai baru atau koreksi nilai ditolak 409 Conflict.
9. Buka kunci hanya boleh dilakukan admin_prodi dan kaprodi prodi terkait; wajib menyertakan alasan tidak kosong.
10. Dosen pengampu dilarang membuka kunci (403).
11. Alur buka kunci berhasil memungkinkan koreksi nilai kembali.
"""

from decimal import Decimal
import pytest


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_finalisasi_env(client, prefix="fn"):
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

    # Dosen Pengampu & Dosen Luar
    client.post("/api/v1/users", json={
        "nama": f"Dosen Pengampu {prefix}", "email": f"dosen_p_{prefix}@undip.ac.id", "password": "password123",
        "role": "dosen", "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(admin_if_token))
    dosen_p_token = _login(client, f"dosen_p_{prefix}@undip.ac.id", "password123")

    client.post("/api/v1/users", json={
        "nama": f"Dosen Luar {prefix}", "email": f"dosen_luar_{prefix}@undip.ac.id", "password": "password123",
        "role": "dosen", "program_studi_id": prodi_if["id"],
    }, headers=_auth_headers(admin_if_token))
    dosen_luar_token = _login(client, f"dosen_luar_{prefix}@undip.ac.id", "password123")

    # Kurikulum & MK
    kur = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024", "semester": "Ganjil"}, headers=_auth_headers(admin_if_token)).json()
    mk = client.post("/api/v1/mata-kuliah", json={
        "kurikulum_version_id": kur["id"],
        "kode": f"IF-FN101",
        "nama": "Basis Data Final",
        "sks": 3,
        "semester": "Ganjil",
        "tahun_ajaran": "2025/2026",
    }, headers=_auth_headers(admin_if_token)).json()

    # Assign pengampu
    users_list = client.get("/api/v1/users", headers=_auth_headers(admin_if_token)).json()
    dp_user = [u for u in users_list if u["email"] == f"dosen_p_{prefix}@undip.ac.id"][0]
    client.post("/api/v1/pengampu-mata-kuliah", json={
        "mata_kuliah_id": mk["id"], "user_id": dp_user["id"], "is_koordinator": True,
    }, headers=_auth_headers(admin_if_token))

    # CPL & IK
    cpl = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur["id"], "kode": "CPL-FN1", "deskripsi": "CPL 1"}, headers=_auth_headers(admin_if_token)).json()
    ik = client.post("/api/v1/ik", json={"cpl_id": cpl["id"], "kode": "IK-FN1", "deskripsi": "IK 1"}, headers=_auth_headers(admin_if_token)).json()

    # CPMK & mapping
    cpmk = client.post("/api/v1/cpmk", json={
        "mata_kuliah_id": mk["id"], "kode": "CPMK-FN1", "deskripsi": "CPMK 1", "level_taksonomi": "C3", "bobot": 100.0,
    }, headers=_auth_headers(admin_if_token)).json()
    client.put(f"/api/v1/cpmk/{cpmk['id']}/map-ik", json={"mappings": [{"ik_id": ik["id"], "bobot": 100.0}]}, headers=_auth_headers(admin_if_token))

    # Bentuk Penilaian & Matriks
    je = client.post("/api/v1/jenis-evaluasi", json={"nama": "Evaluasi", "urutan": 1}, headers=_auth_headers(admin_if_token)).json()
    bp = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je["id"], "nama": "Ujian"}, headers=_auth_headers(admin_if_token)).json()
    mbp = client.post("/api/v1/mk-bentuk-penilaian", json={
        "mata_kuliah_id": mk["id"], "bentuk_penilaian_id": bp["id"], "bobot": 100.0, "semester": "Ganjil",
    }, headers=_auth_headers(dosen_p_token)).json()
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp['id']}/map-ik", json={"mappings": [{"ik_id": ik["id"], "bobot": 100.0}]}, headers=_auth_headers(dosen_p_token))

    # Mahasiswa & Peserta 1 & 2
    mhs1 = client.post("/api/v1/mahasiswa", json={"nim": f"NIM1_{prefix}", "nama": "Mahasiswa 1", "semester_aktif": 1, "status_masuk": "Reguler"}, headers=_auth_headers(admin_if_token)).json()
    peserta1 = client.post("/api/v1/peserta-mata-kuliah", json={"mata_kuliah_id": mk["id"], "mahasiswa_id": mhs1["id"], "kelas": "A"}, headers=_auth_headers(admin_if_token)).json()

    mhs2 = client.post("/api/v1/mahasiswa", json={"nim": f"NIM2_{prefix}", "nama": "Mahasiswa Kosong", "semester_aktif": 1, "status_masuk": "Reguler"}, headers=_auth_headers(admin_if_token)).json()
    peserta2 = client.post("/api/v1/peserta-mata-kuliah", json={"mata_kuliah_id": mk["id"], "mahasiswa_id": mhs2["id"], "kelas": "A"}, headers=_auth_headers(admin_if_token)).json()

    return {
        "admin_if_token": admin_if_token,
        "kaprodi_if_token": kaprodi_if_token,
        "admin_el_token": admin_el_token,
        "dosen_p_token": dosen_p_token,
        "dosen_luar_token": dosen_luar_token,
        "kur_id": kur["id"],
        "mk_id": mk["id"],
        "mbp_id": mbp["id"],
        "ik_id": ik["id"],
        "peserta1_id": peserta1["id"],
        "peserta2_id": peserta2["id"],
    }


def test_finalisasi_peserta_berhasil_dan_terkunci(client):
    """
    Finalisasi sukses: nilai dihitung server, tersimpan snapshot, dan nilai terkunci (tolak 409 saat diedit).
    """
    env = _setup_finalisasi_env(client, "f1")
    adm, dp = env["admin_if_token"], env["dosen_p_token"]
    kur_id, mk_id, mbp_id, ik_id, p1_id = env["kur_id"], env["mk_id"], env["mbp_id"], env["ik_id"], env["peserta1_id"]

    # Atur skala kurikulum
    client.post(f"/api/v1/kurikulum/versions/{kur_id}/skala-nilai", json={
        "skala": [
            {"huruf": "A", "batas_min": 85.0},
            {"huruf": "B", "batas_min": 70.0},
            {"huruf": "E", "batas_min": 0.0},
        ]
    }, headers=_auth_headers(adm))

    # Input nilai peserta 1: 88.0
    client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": p1_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik_id, "nilai": 88.0}],
    }, headers=_auth_headers(dp))

    # Finalisasi oleh dosen pengampu
    finalize_resp = client.post(f"/api/v1/kalkulasi/peserta/{p1_id}/finalize", headers=_auth_headers(dp))
    assert finalize_resp.status_code == 200
    data = finalize_resp.json()
    assert data["is_final"] is True
    assert float(data["nilai_akhir"]) == 88.0
    assert data["nilai_huruf"] == "A"

    # Finalisasi ulang peserta yang sama -> HARUS 409 Conflict
    re_finalize = client.post(f"/api/v1/kalkulasi/peserta/{p1_id}/finalize", headers=_auth_headers(dp))
    assert re_finalize.status_code == 409

    # Input/koreksi nilai setelah final -> HARUS DITOLAK 409 Conflict
    edit_resp = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": p1_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik_id, "nilai": 95.0}],
    }, headers=_auth_headers(dp))
    assert edit_resp.status_code == 409
    assert "final" in edit_resp.json()["detail"].lower()


def test_finalisasi_penolakan_syarat(client):
    """
    Penolakan finalisasi:
    - Peserta tanpa nilai -> 400
    - Kurikulum tanpa skala nilai -> 400
    - Dosen luar -> 403
    - Admin prodi lain -> 403
    """
    env = _setup_finalisasi_env(client, "f2")
    adm, dp, dl, a_el = env["admin_if_token"], env["dosen_p_token"], env["dosen_luar_token"], env["admin_el_token"]
    kur_id, mk_id, mbp_id, ik_id, p1_id, p2_id = env["kur_id"], env["mk_id"], env["mbp_id"], env["ik_id"], env["peserta1_id"], env["peserta2_id"]

    # 1. Peserta 1 belum ada skala kurikulum & belum ada nilai -> tolak 400
    resp_no_scale = client.post(f"/api/v1/kalkulasi/peserta/{p1_id}/finalize", headers=_auth_headers(dp))
    assert resp_no_scale.status_code == 400

    # Atur skala kurikulum
    client.post(f"/api/v1/kurikulum/versions/{kur_id}/skala-nilai", json={
        "skala": [{"huruf": "A", "batas_min": 85.0}, {"huruf": "E", "batas_min": 0.0}]
    }, headers=_auth_headers(adm))

    # 2. Peserta 2 tanpa nilai -> tolak 400
    resp_no_val = client.post(f"/api/v1/kalkulasi/peserta/{p2_id}/finalize", headers=_auth_headers(dp))
    assert resp_no_val.status_code == 400
    assert "nilai" in resp_no_val.json()["detail"].lower()

    # Input nilai peserta 1
    client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": p1_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik_id, "nilai": 80.0}],
    }, headers=_auth_headers(dp))

    # 3. Dosen bukan pengampu -> 403 Forbidden
    resp_dosen_luar = client.post(f"/api/v1/kalkulasi/peserta/{p1_id}/finalize", headers=_auth_headers(dl))
    assert resp_dosen_luar.status_code == 403

    # 4. Admin prodi lain -> 403 Forbidden
    resp_admin_el = client.post(f"/api/v1/kalkulasi/peserta/{p1_id}/finalize", headers=_auth_headers(a_el))
    assert resp_admin_el.status_code == 403


def test_alur_buka_kunci_dan_koreksi_nilai(client):
    """
    Alur buka kunci:
    - Hanya admin_prodi dan kaprodi yang boleh membuka kunci
    - Alasan wajib dan tidak boleh kosong (tolak 400/422)
    - Dosen pengampu dilarang membuka kunci (403)
    - Setelah dibuka, koreksi nilai berhasil, lalu dapat difinalisasi ulang
    """
    env = _setup_finalisasi_env(client, "f3")
    adm, kaprodi, dp = env["admin_if_token"], env["kaprodi_if_token"], env["dosen_p_token"]
    kur_id, mk_id, mbp_id, ik_id, p1_id = env["kur_id"], env["mk_id"], env["mbp_id"], env["ik_id"], env["peserta1_id"]

    client.post(f"/api/v1/kurikulum/versions/{kur_id}/skala-nilai", json={
        "skala": [{"huruf": "A", "batas_min": 85.0}, {"huruf": "E", "batas_min": 0.0}]
    }, headers=_auth_headers(adm))

    client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": p1_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik_id, "nilai": 70.0}],
    }, headers=_auth_headers(dp))

    # Finalisasi awal
    client.post(f"/api/v1/kalkulasi/peserta/{p1_id}/finalize", headers=_auth_headers(dp))

    # 1. Dosen mencoba membuka kunci -> 403 Forbidden
    resp_dp_unlock = client.post(f"/api/v1/kalkulasi/peserta/{p1_id}/unlock", json={"alasan": "Ingin koreksi"}, headers=_auth_headers(dp))
    assert resp_dp_unlock.status_code == 403

    # 2. Admin membuka kunci tanpa alasan -> tolak 400 / 422
    resp_empty_reason = client.post(f"/api/v1/kalkulasi/peserta/{p1_id}/unlock", json={"alasan": "   "}, headers=_auth_headers(adm))
    assert resp_empty_reason.status_code in (400, 422)

    # 3. Kaprodi membuka kunci dengan alasan valid -> sukses 200
    resp_unlock = client.post(f"/api/v1/kalkulasi/peserta/{p1_id}/unlock", json={"alasan": "Koreksi salah input nilai kuis"}, headers=_auth_headers(kaprodi))
    assert resp_unlock.status_code == 200
    assert resp_unlock.json()["is_final"] is False

    # 4. Koreksi nilai sekarang berhasil
    resp_koreksi = client.post("/api/v1/nilai/manual", json={
        "mk_id": mk_id, "semester": "Ganjil",
        "records": [{"peserta_mata_kuliah_id": p1_id, "mk_bentuk_penilaian_id": mbp_id, "ik_id": ik_id, "nilai": 90.0}],
    }, headers=_auth_headers(dp))
    assert resp_koreksi.status_code == 200

    # 5. Finalisasi ulang dengan nilai terkoreksi
    refinal = client.post(f"/api/v1/kalkulasi/peserta/{p1_id}/finalize", headers=_auth_headers(dp))
    assert refinal.status_code == 200
    assert float(refinal.json()["nilai_akhir"]) == 90.0
    assert refinal.json()["nilai_huruf"] == "A"

