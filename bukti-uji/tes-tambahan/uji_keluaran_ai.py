"""Uji keluaran AI SADEWA dengan LLM asli (BELUM DIJALANKAN di sesi penyusunan C500).

Skrip ini untuk dijalankan tim di mesin yang AI Service-nya hidup (port 8001), knowledge
base sudah di-ingest, model embedding tersedia, dan QWEN_API_KEY valid.

Yang diukur:
  1. Durasi generate RPS dan narasi (panggilan langsung ke AI Service, N kali per masukan).
  2. Validitas format RPS menurut sadewa_ai.validators.validate_rps (16 pertemuan, UTS minggu 8,
     UAS minggu 16, total bobot 100, kode CPMK terdaftar) dan jumlah percobaan ulang.
  3. Konsistensi narasi: setiap kode CPL masukan muncul di analisis_cpl, dan status
     Tercapai/Belum Tercapai cocok dengan nilai rata-rata terhadap ambang 70.
Yang TIDAK diukur: kebenaran isi materi dan kesesuaian dengan RPS acuan (dinilai manual).

Pemakaian (dari folder ai, venv aktif):
    python ../bukti-uji/tes-tambahan/uji_keluaran_ai.py 3 ../bukti-uji/keluaran-ai.json
"""
import json
import sys
import time

import httpx

from sadewa_ai.validators import validate_narasi, validate_rps

AI = "http://127.0.0.1:8001"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 3
OUT = sys.argv[2] if len(sys.argv) > 2 else "keluaran-ai.json"
AMBANG = 70.0

RPS_MASUKAN = [
    {"mk_name": "Jaringan Syaraf Tiruan", "sks": 3, "semester": "Ganjil", "prodi": "Teknik Komputer"},
    {"mk_name": "Sistem Tertanam", "sks": 3, "semester": "Genap", "prodi": "Teknik Komputer"},
]
NARASI_MASUKAN = {
    "mk_name": "Jaringan Syaraf Tiruan", "prodi": "Teknik Komputer", "semester": "Ganjil",
    "tahun_ajaran": "2025/2026",
    "capaian": [
        {"kode": "CPL-01", "nilai_rata_rata": 78.5, "jumlah_mahasiswa": 40, "jumlah_tercapai": 33},
        {"kode": "CPL-05", "nilai_rata_rata": 61.5, "jumlah_mahasiswa": 40, "jumlah_tercapai": 14},
    ],
}

hasil = {"rps": [], "narasi": []}
with httpx.Client(timeout=300) as c:
    hasil["health"] = c.get(f"{AI}/health").json()
    for m in RPS_MASUKAN:
        for i in range(N):
            t0 = time.perf_counter()
            r = c.post(f"{AI}/api/v1/rps", json=m)
            dt = time.perf_counter() - t0
            body = r.json()
            data = body.get("data") or {}
            ok, errs = validate_rps(data) if data else (False, ["tidak ada data"])
            hasil["rps"].append({"masukan": m["mk_name"], "ulang": i + 1, "http": r.status_code,
                                 "success": body.get("success"), "detik": round(dt, 2),
                                 "lolos_validate_rps": ok, "pelanggaran": errs,
                                 "jumlah_pertemuan": len(data.get("pertemuan", [])),
                                 "total_bobot": sum(float(p.get("bobot", 0)) for p in data.get("pertemuan", []))})
    for i in range(N):
        t0 = time.perf_counter()
        r = c.post(f"{AI}/api/v1/narasi", json=NARASI_MASUKAN)
        dt = time.perf_counter() - t0
        data = r.json().get("data") or {}
        ok, errs = validate_narasi(data) if data else (False, ["tidak ada data"])
        status = {a.get("kode"): a.get("status") for a in data.get("analisis_cpl", [])}
        cocok = {c_["kode"]: status.get(c_["kode"]) == ("Tercapai" if c_["nilai_rata_rata"] >= AMBANG else "Belum Tercapai")
                 for c_ in NARASI_MASUKAN["capaian"]}
        hasil["narasi"].append({"ulang": i + 1, "http": r.status_code, "detik": round(dt, 2),
                                "lolos_validate_narasi": ok, "pelanggaran": errs,
                                "status_sesuai_data": cocok})

json.dump(hasil, open(OUT, "w"), indent=2, ensure_ascii=False)
print(json.dumps(hasil, indent=2, ensure_ascii=False))
