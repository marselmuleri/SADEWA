"""
Test Integrasi OBE End-to-End (Fase 3).
Menguji skenario Putu Sandra (Kasus 1 SIMAK-NG) secara penuh lewat REST API:
1. Setup CPL, IK, CPMK, Mapping IK ke CPMK.
2. Setup Bentuk Penilaian dan Matriks Bobot Kelas.
3. Setup Skala Nilai Kurikulum (A>=85, B+>=80, B>=70, C+>=65, C>=55, D>=40, E>=0).
4. Input Nilai Mahasiswa 1 (Putu Sandra) per IK pada setiap bentuk penilaian.
5. Jalankan endpoint kalkulasi /api/v1/kalkulasi/run/{mk_id}.
6. Verifikasi nilai akhir 74.25 dan huruf B via endpoint rapor mahasiswa.
7. Verifikasi mahasiswa kedua tanpa nilai mendapat nilai akhir 0.00 dan huruf E.
"""

from decimal import Decimal
import pytest


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_integrasi_putu_sandra_dan_mahasiswa_kosong(client):
    # 1. Setup Auth & Program Studi
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin OBE",
        "email": "sa_integ@undip.ac.id",
        "password": "password123",
    })
    sa_token = _login(client, "sa_integ@undip.ac.id", "password123")

    fak = client.post("/api/v1/fakultas", json={"nama": "Fakultas Teknik", "kode": "FTI"}, headers=_auth_headers(sa_token)).json()
    prodi = client.post("/api/v1/prodi", json={"nama": "Informatika", "kode": "IFI", "fakultas_id": fak["id"]}, headers=_auth_headers(sa_token)).json()

    client.post("/api/v1/users", json={
        "nama": "Admin IF OBE",
        "email": "admin_integ@undip.ac.id",
        "password": "password123",
        "role": "admin_prodi",
        "program_studi_id": prodi["id"],
    }, headers=_auth_headers(sa_token))
    admin_token = _login(client, "admin_integ@undip.ac.id", "password123")

    client.post("/api/v1/users", json={
        "nama": "Dosen IF OBE",
        "email": "dosen_integ@undip.ac.id",
        "password": "password123",
        "role": "dosen",
        "program_studi_id": prodi["id"],
    }, headers=_auth_headers(admin_token))
    dosen_token = _login(client, "dosen_integ@undip.ac.id", "password123")

    # 2. Kurikulum & Mata Kuliah
    kur = client.post("/api/v1/kurikulum/versions", json={"version_label": "2024-OBE", "semester": "Ganjil"}, headers=_auth_headers(admin_token)).json()
    mk = client.post("/api/v1/mata-kuliah", json={
        "kurikulum_version_id": kur["id"],
        "kode": "IF-OBE101",
        "nama": "Pemrograman OBE",
        "sks": 3,
        "semester": "Ganjil",
        "tahun_ajaran": "2025/2026",
    }, headers=_auth_headers(admin_token)).json()
    mk_id = mk["id"]

    dosen_user = [u for u in client.get("/api/v1/users", headers=_auth_headers(admin_token)).json() if u["email"] == "dosen_integ@undip.ac.id"][0]
    client.post("/api/v1/pengampu-mata-kuliah", json={
        "mata_kuliah_id": mk_id,
        "user_id": dosen_user["id"],
        "is_koordinator": True,
    }, headers=_auth_headers(admin_token))

    # 3. Skala Nilai Kurikulum
    client.post(f"/api/v1/kurikulum/versions/{kur['id']}/skala-nilai", json={
        "skala": [
            {"huruf": "A", "batas_min": 85.0},
            {"huruf": "B+", "batas_min": 80.0},
            {"huruf": "B", "batas_min": 70.0},
            {"huruf": "C+", "batas_min": 65.0},
            {"huruf": "C", "batas_min": 55.0},
            {"huruf": "D", "batas_min": 40.0},
            {"huruf": "E", "batas_min": 0.0},
        ]
    }, headers=_auth_headers(admin_token))

    # 4. CPL (CP1, CP2, CP4, CP6, CP7, CP8)
    cpls = {}
    for cpl_kode in ["CP1", "CP2", "CP4", "CP6", "CP7", "CP8"]:
        res = client.post("/api/v1/cpl", json={"kurikulum_version_id": kur["id"], "kode": cpl_kode, "deskripsi": f"Kompetensi {cpl_kode}"}, headers=_auth_headers(admin_token)).json()
        cpls[cpl_kode] = res["id"]

    # 5. IK: IK1b, IK2a, IK2c, IK4c, IK6c, IK7a, IK8a, IK8b, IK8c
    ik_defs = [
        ("IK1b", "CP1"),
        ("IK2a", "CP2"),
        ("IK2c", "CP2"),
        ("IK4c", "CP4"),
        ("IK6c", "CP6"),
        ("IK7a", "CP7"),
        ("IK8a", "CP8"),
        ("IK8b", "CP8"),
        ("IK8c", "CP8"),
    ]
    iks = {}
    for ik_kode, cpl_kode in ik_defs:
        res = client.post("/api/v1/ik", json={"cpl_id": cpls[cpl_kode], "kode": ik_kode, "deskripsi": f"Indikator {ik_kode}"}, headers=_auth_headers(admin_token)).json()
        iks[ik_kode] = res["id"]

    # 6. CPMK & Mapping IK
    # CPMK1 (bobot 5): IK1b=5
    # CPMK2 (bobot 20): IK2a=10, IK2c=10
    # CPMK4 (bobot 37.5): IK4c=37.5
    # CPMK6 (bobot 12.5): IK6c=12.5
    # CPMK7 (bobot 12.5): IK7a=12.5
    # CPMK8 (bobot 12.5): IK8a=4, IK8b=4.5, IK8c=4
    cpmk_configs = [
        ("CPMK1", 5.0, [("IK1b", 5.0)]),
        ("CPMK2", 20.0, [("IK2a", 10.0), ("IK2c", 10.0)]),
        ("CPMK4", 37.5, [("IK4c", 37.5)]),
        ("CPMK6", 12.5, [("IK6c", 12.5)]),
        ("CPMK7", 12.5, [("IK7a", 12.5)]),
        ("CPMK8", 12.5, [("IK8a", 4.0), ("IK8b", 4.5), ("IK8c", 4.0)]),
    ]
    for c_kode, c_bobot, mappings in cpmk_configs:
        c_res = client.post("/api/v1/cpmk", json={
            "mata_kuliah_id": mk_id,
            "kode": c_kode,
            "deskripsi": f"Capaian {c_kode}",
            "level_taksonomi": "C3",
            "bobot": c_bobot,
        }, headers=_auth_headers(admin_token)).json()

        map_payload = [{"ik_id": iks[ik_k], "bobot": w} for ik_k, w in mappings]
        client.put(f"/api/v1/cpmk/{c_res['id']}/map-ik", json={"mappings": map_payload}, headers=_auth_headers(admin_token))

    # 7. Bentuk Penilaian & Matriks Bobot
    je = client.post("/api/v1/jenis-evaluasi", json={"nama": "Evaluasi Terpadu", "urutan": 1}, headers=_auth_headers(admin_token)).json()
    bp_tugas = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je["id"], "nama": "Tugas"}, headers=_auth_headers(admin_token)).json()
    bp_kuis = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je["id"], "nama": "Kuis"}, headers=_auth_headers(admin_token)).json()
    bp_uts = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je["id"], "nama": "UTS"}, headers=_auth_headers(admin_token)).json()
    bp_uas = client.post("/api/v1/bentuk-penilaian", json={"jenis_evaluasi_id": je["id"], "nama": "UAS"}, headers=_auth_headers(admin_token)).json()

    mbp_tugas = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": bp_tugas["id"], "bobot": 50.0, "semester": "Ganjil"}, headers=_auth_headers(dosen_token)).json()
    mbp_kuis = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": bp_kuis["id"], "bobot": 10.0, "semester": "Ganjil"}, headers=_auth_headers(dosen_token)).json()
    mbp_uts = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": bp_uts["id"], "bobot": 20.0, "semester": "Ganjil"}, headers=_auth_headers(dosen_token)).json()
    mbp_uas = client.post("/api/v1/mk-bentuk-penilaian", json={"mata_kuliah_id": mk_id, "bentuk_penilaian_id": bp_uas["id"], "bobot": 20.0, "semester": "Ganjil"}, headers=_auth_headers(dosen_token)).json()

    # Matriks Tugas (50): IK1b 0.5, IK2a 4, IK2c 10, IK4c 6, IK6c 12.5, IK7a 4.5, IK8a 4, IK8b 4.5, IK8c 4
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp_tugas['id']}/map-ik", json={"mappings": [
        {"ik_id": iks["IK1b"], "bobot": 0.5},
        {"ik_id": iks["IK2a"], "bobot": 4.0},
        {"ik_id": iks["IK2c"], "bobot": 10.0},
        {"ik_id": iks["IK4c"], "bobot": 6.0},
        {"ik_id": iks["IK6c"], "bobot": 12.5},
        {"ik_id": iks["IK7a"], "bobot": 4.5},
        {"ik_id": iks["IK8a"], "bobot": 4.0},
        {"ik_id": iks["IK8b"], "bobot": 4.5},
        {"ik_id": iks["IK8c"], "bobot": 4.0},
    ]}, headers=_auth_headers(dosen_token))

    # Matriks Kuis (10): IK1b 1.5, IK4c 4, IK7a 4.5
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp_kuis['id']}/map-ik", json={"mappings": [
        {"ik_id": iks["IK1b"], "bobot": 1.5},
        {"ik_id": iks["IK4c"], "bobot": 4.0},
        {"ik_id": iks["IK7a"], "bobot": 4.5},
    ]}, headers=_auth_headers(dosen_token))

    # Matriks UTS (20): IK1b 3, IK4c 13.5, IK7a 3.5
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp_uts['id']}/map-ik", json={"mappings": [
        {"ik_id": iks["IK1b"], "bobot": 3.0},
        {"ik_id": iks["IK4c"], "bobot": 13.5},
        {"ik_id": iks["IK7a"], "bobot": 3.5},
    ]}, headers=_auth_headers(dosen_token))

    # Matriks UAS (20): IK2a 6, IK4c 14
    client.put(f"/api/v1/mk-bentuk-penilaian/{mbp_uas['id']}/map-ik", json={"mappings": [
        {"ik_id": iks["IK2a"], "bobot": 6.0},
        {"ik_id": iks["IK4c"], "bobot": 14.0},
    ]}, headers=_auth_headers(dosen_token))

    # 8. Daftarkan Mahasiswa 1 (Putu Sandra) & Mahasiswa 2 (Tanpa Nilai)
    mhs_putu = client.post("/api/v1/mahasiswa", json={"nim": "24060120140001", "nama": "Putu Sandra", "semester_aktif": 1, "status_masuk": "Reguler"}, headers=_auth_headers(admin_token)).json()
    peserta_putu = client.post("/api/v1/peserta-mata-kuliah", json={"mata_kuliah_id": mk_id, "mahasiswa_id": mhs_putu["id"], "kelas": "A"}, headers=_auth_headers(admin_token)).json()

    mhs_kosong = client.post("/api/v1/mahasiswa", json={"nim": "24060120140002", "nama": "Made Kosong", "semester_aktif": 1, "status_masuk": "Reguler"}, headers=_auth_headers(admin_token)).json()
    peserta_kosong = client.post("/api/v1/peserta-mata-kuliah", json={"mata_kuliah_id": mk_id, "mahasiswa_id": mhs_kosong["id"], "kelas": "A"}, headers=_auth_headers(admin_token)).json()

    # 9. Input Nilai Putu Sandra
    # Tugas: IK1b 100, IK2a 100, IK2c 75, IK4c 100, IK6c 75, IK7a 50, IK8a 50, IK8b 50, IK8c 100
    nilai_tugas = [
        ("IK1b", 100.0), ("IK2a", 100.0), ("IK2c", 75.0), ("IK4c", 100.0),
        ("IK6c", 75.0), ("IK7a", 50.0), ("IK8a", 50.0), ("IK8b", 50.0), ("IK8c", 100.0)
    ]
    records_tugas = [{"peserta_mata_kuliah_id": peserta_putu["id"], "mk_bentuk_penilaian_id": mbp_tugas["id"], "ik_id": iks[ik_k], "nilai": val} for ik_k, val in nilai_tugas]
    client.post("/api/v1/nilai/manual", json={"mk_id": mk_id, "semester": "Ganjil", "records": records_tugas}, headers=_auth_headers(dosen_token))

    # Kuis: IK1b 50, IK4c 100, IK7a 100
    nilai_kuis = [("IK1b", 50.0), ("IK4c", 100.0), ("IK7a", 100.0)]
    records_kuis = [{"peserta_mata_kuliah_id": peserta_putu["id"], "mk_bentuk_penilaian_id": mbp_kuis["id"], "ik_id": iks[ik_k], "nilai": val} for ik_k, val in nilai_kuis]
    client.post("/api/v1/nilai/manual", json={"mk_id": mk_id, "semester": "Ganjil", "records": records_kuis}, headers=_auth_headers(dosen_token))

    # UTS: IK1b 75, IK4c 75, IK7a 50
    nilai_uts = [("IK1b", 75.0), ("IK4c", 75.0), ("IK7a", 50.0)]
    records_uts = [{"peserta_mata_kuliah_id": peserta_putu["id"], "mk_bentuk_penilaian_id": mbp_uts["id"], "ik_id": iks[ik_k], "nilai": val} for ik_k, val in nilai_uts]
    client.post("/api/v1/nilai/manual", json={"mk_id": mk_id, "semester": "Ganjil", "records": records_uts}, headers=_auth_headers(dosen_token))

    # UAS: IK2a 100, IK4c 50
    nilai_uas = [("IK2a", 100.0), ("IK4c", 50.0)]
    records_uas = [{"peserta_mata_kuliah_id": peserta_putu["id"], "mk_bentuk_penilaian_id": mbp_uas["id"], "ik_id": iks[ik_k], "nilai": val} for ik_k, val in nilai_uas]
    client.post("/api/v1/nilai/manual", json={"mk_id": mk_id, "semester": "Ganjil", "records": records_uas}, headers=_auth_headers(dosen_token))

    # 10. Jalankan engine kalkulasi OBE
    run_resp = client.post(f"/api/v1/kalkulasi/run/{mk_id}", headers=_auth_headers(dosen_token))
    assert run_resp.status_code == 200
    assert run_resp.json()["jumlah_peserta_diproses"] == 2

    # 11. Verifikasi Rapor Putu Sandra: nilai_akhir == 74.25 dan huruf B
    rapor_putu = client.get(f"/api/v1/rapor/mahasiswa/{mhs_putu['id']}", headers=_auth_headers(admin_token)).json()
    he_putu = [h for h in rapor_putu["hasil_evaluasi"] if h["mata_kuliah_id"] == mk_id][0]
    assert float(he_putu["nilai_akhir"]) == 74.25
    assert he_putu["nilai_huruf"] == "B"

    # 12. Verifikasi Rapor Mahasiswa Kosong: nilai_akhir == 0.00 dan huruf E
    rapor_kosong = client.get(f"/api/v1/rapor/mahasiswa/{mhs_kosong['id']}", headers=_auth_headers(admin_token)).json()
    he_kosong = [h for h in rapor_kosong["hasil_evaluasi"] if h["mata_kuliah_id"] == mk_id][0]
    assert float(he_kosong["nilai_akhir"]) == 0.00
    assert he_kosong["nilai_huruf"] == "E"
