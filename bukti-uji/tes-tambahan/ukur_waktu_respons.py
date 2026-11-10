"""Pengukuran waktu respons endpoint utama SADEWA (backend berjalan via uvicorn, DB PostgreSQL).

Setiap endpoint dipanggil 2 kali pemanasan lalu N kali diukur (klien httpx, satu per satu,
dari mesin yang sama). Hasil: min, rata-rata, median, p95, maks dalam milidetik.
Pemakaian: python ukur_waktu_respons.py http://127.0.0.1:8000 30 hasil.json
"""
import json, statistics, sys, time
import httpx

BASE, N, OUT = sys.argv[1], int(sys.argv[2]), sys.argv[3]
PW = "password123"
c = httpx.Client(base_url=BASE + "/api/v1", timeout=120)

def tok(email):
    r = c.post("/auth/login", json={"email": email, "password": PW}); r.raise_for_status()
    return {"Authorization": "Bearer " + r.json()["access_token"]}

dosen, kaprodi, admin, dekan = (tok(e) for e in ["dosen@sadewa.ac.id", "kaprodi@sadewa.ac.id",
                                                 "adminprodi@sadewa.ac.id", "dekan@sadewa.ac.id"])
mks = c.get("/mata-kuliah/saya", headers=dosen).json()
mk = mks[0]["id"]
peserta = c.get(f"/kalkulasi/{mk}", headers=dosen).json()
n_baris_ik = len(peserta)

def ukur(nama, fn, n=N):
    for _ in range(2): fn()
    t, kode = [], set()
    for _ in range(n):
        t0 = time.perf_counter(); r = fn(); t.append((time.perf_counter() - t0) * 1000); kode.add(r.status_code)
    t.sort()
    return {"endpoint": nama, "n": n, "status": sorted(kode), "min_ms": round(t[0], 1),
            "rata2_ms": round(statistics.mean(t), 1), "median_ms": round(statistics.median(t), 1),
            "p95_ms": round(t[int(0.95 * (n - 1))], 1), "maks_ms": round(t[-1], 1)}

hasil = {"mata_kuliah_id": mk, "jumlah_mk_dosen": len(mks), "jumlah_baris_capaian_ik_mk": n_baris_ik, "ukuran": []}
U = hasil["ukuran"]
U.append(ukur("POST /auth/login (Dosen)", lambda: c.post("/auth/login", json={"email": "dosen@sadewa.ac.id", "password": PW})))
U.append(ukur("GET /mata-kuliah/saya (Dosen)", lambda: c.get("/mata-kuliah/saya", headers=dosen)))
U.append(ukur(f"GET /dashboard/{{matkul_id}} (Dosen)", lambda: c.get(f"/dashboard/{mk}", headers=dosen)))
U.append(ukur(f"GET /kalkulasi/{{matkul_id}} (Dosen)", lambda: c.get(f"/kalkulasi/{mk}", headers=dosen)))
U.append(ukur(f"POST /kalkulasi/run/{{matkul_id}} (Dosen)", lambda: c.post(f"/kalkulasi/run/{mk}", headers=dosen)))
U.append(ukur(f"GET /analitik/mata-kuliah/{{id}} (Dosen)", lambda: c.get(f"/analitik/mata-kuliah/{mk}", headers=dosen)))
U.append(ukur("GET /analitik/prodi (Kaprodi)", lambda: c.get("/analitik/prodi", headers=kaprodi)))
U.append(ukur("GET /trending/cpl-by-angkatan (Kaprodi)", lambda: c.get("/trending/cpl-by-angkatan", headers=kaprodi)))
U.append(ukur("GET /validasi/laporan (Kaprodi)", lambda: c.get("/validasi/laporan", headers=kaprodi)))
U.append(ukur("GET /mata-kuliah (Admin Prodi)", lambda: c.get("/mata-kuliah", headers=admin)))
U.append(ukur("POST /rps/{id}/generate saat AI Service mati (Dosen)",
              lambda: c.post(f"/rps/{mk}/generate", headers=dosen, json={"tahun_ajaran": "2025/2026", "semester": "Ganjil", "topik": "uji"}), n=10))
json.dump(hasil, open(OUT, "w"), indent=2, ensure_ascii=False)
print(json.dumps(hasil, indent=2, ensure_ascii=False))
