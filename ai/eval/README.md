# Pengujian AI SADEWA — perbandingan Qwen, Llama, GPT

Objek uji utama: **evaluasi CPMK** (`/api/v1/evaluasi-cpmk`), yaitu kolom Analisis
Pelaksanaan Pembelajaran dan Rencana Perbaikan Semester Depan per CPMK pada portofolio.
Skrip mengukur **kepatuhan format** (lolos `validate_evaluasi_cpmk` di percobaan pertama
dan akhir), **ketepatan angka** dan **ketepatan status** terhadap data backend, **waktu**
per tahap, dan **token**. Memakai LLM asli, jadi setiap percobaan memakan kuota API.

Uji RPS dan narasi masih tersedia (`--hanya rps|narasi|semua`), tetapi di luar ruang
lingkup skripsi.

## Langkah

1. Siapkan kasus uji. Cara termudah: ekspor dari basis data SADEWA (hanya membaca;
   PostgreSQL harus menyala, `DATABASE_URL` dari `backend/.env`):
   ```bash
   ../venv/Scripts/python.exe eval/ekspor_kasus_evaluasi.py --keluaran eval/kasus_evaluasi.json
   ```
   Hasilnya berbentuk persis payload backend ke `/api/v1/evaluasi-cpmk` (fungsi
   `saran_evaluasi`), lengkap dengan `_kode_kasus` (K01, K02, ...). Hapus kasus yang tidak
   dipakai dari berkas itu. Alternatif: isi manual bagian `evaluasi_cpmk` di
   `kasus_uji.json` mengikuti `_contoh_evaluasi_cpmk`.
   **Periksa sumber datanya:** basis data hasil `backend/app/core/seed.py` berisi nilai acak
   (data demo), bukan data asli prodi. Tulis dengan jujur di subbab 3.2.3.
2. Isi kunci, base URL, dan nama model setiap profil di `ai/.env` (contoh di `.env.example`):
   `QWEN_*`, `LLAMA_*`, `OPENAI_*`.
3. Uji coba kecil dulu (sementara kurangi `percobaan_per_mk` dan jumlah kasus), lalu
   jalankan dari folder `ai/` untuk setiap model (hasil ke `eval/hasil/<profil>/`):
   ```bash
   ../venv/Scripts/python.exe eval/uji_ai.py --profil qwen
   ../venv/Scripts/python.exe eval/uji_ai.py --profil llama
   ../venv/Scripts/python.exe eval/uji_ai.py --profil gpt
   ```
   `--model <nama>` menimpa nama model dari `.env`. Untuk profil `llama` dan `gpt`,
   parameter khusus Qwen `enable_thinking` tidak dikirim.
4. Periksa manual:
   - `evaluasi_angka.csv`: setiap baris `cocok=0` (pencocokan heuristik; koreksi bila sah).
   - `evaluasi_status.csv`: setiap baris `status_teks=tidak_jelas` dan `benar=0`.
     Klasifikasi status memakai pola frasa ("belum memenuhi", "telah memenuhi", ...).

5. Bandingkan ketiga model (deskriptif, uji statistik, grafik 300 dpi untuk Bab IV):
   ```bash
   ../venv/Scripts/python.exe eval/bandingkan.py --harga qwen=<in>:<out> llama=<in>:<out> gpt=<in>:<out>
   ```
   `--harga` = USD per 1 juta token masukan:keluaran dari situs resmi (catat tanggal akses).
   Hasil di `eval/hasil/perbandingan/`: `ringkasan_model.csv`, `per_kasus.csv`,
   `uji_statistik.csv` (Friedman + Kendall's W, Cochran's Q, Wilcoxon/McNemar +
   Bonferroni), `kategori_pelanggaran.csv`, `grafik/*.png`. Koreksi manual di
   `evaluasi_angka.csv` dan `evaluasi_status.csv` ikut terhitung; jalankan ulang setelah
   mengoreksi. Pasangan antarmodel memakai kolom `kasus`, jadi pakai berkas kasus yang sama
   untuk ketiga model.

`grafik.py` hanya untuk hasil RPS/narasi (di luar ruang lingkup).

## Keluaran (`hasil/<profil>/`)

| File | Isi |
|---|---|
| `konfigurasi.json` | profil, model, base URL, temperature, top-k, jumlah chunk, waktu uji |
| `evaluasi.csv` | per keluaran: lolos percobaan 1, lolos akhir, jumlah panggilan LLM, angka cocok/total, status benar/harapan, waktu, token |
| `evaluasi_pelanggaran.csv` | setiap pelanggaran validator beserta kategori dan nomor percobaannya |
| `evaluasi_angka.csv` | setiap angka di kolom analisis beserta konteks kalimatnya |
| `evaluasi_status.csv` | per CPMK: status data, status yang dinyatakan teks, teks analisis |
| `mentah/*.json` | keluaran AI apa adanya (untuk lampiran / cuplikan gambar) |

## Kolom waktu, token, dan status (`evaluasi.csv`)

| Kolom | Isi |
|---|---|
| `durasi_detik` | Waktu total satu generate, termasuk retry |
| `durasi_retrieval_detik` | Pengambilan konteks dari ChromaDB |
| `durasi_llm_detik` | Jumlah waktu semua panggilan LLM (diukur di `llm_client.chat`) |
| `durasi_lain_detik` | Sisa: susun prompt, ekstraksi JSON, validasi |
| `token_masuk`, `token_keluar` | Jumlah token semua panggilan LLM (dari laporan API) |
| `status_benar` / `status_harapan` | CPMK yang statusnya dinyatakan benar / semua CPMK masukan |
| `status_tidak_jelas`, `status_terlewat` | CPMK tanpa frasa status / tanpa entri |

Model embedding dipanaskan sebelum pengujian, sehingga waktu retrieval kasus pertama
tidak ikut menanggung waktu memuat model.

## Catatan untuk analisis

- `generate_evaluasi_cpmk` mencoba ulang maks. **1 kali** (perilaku sistem asli). Laporkan
  **lolos percobaan pertama** (kemampuan LLM) dan **lolos akhir** (yang diterima dosen).
- Galat ekstraksi JSON / keluaran terpotong tidak di-retry; dicatat sebagai
  "Galat LLM / parsing JSON".
- Status MEMENUHI dihitung backend (target persen mahasiswa ≥ ambang dan, bila ada,
  target rerata skala), lalu diberikan ke LLM sebagai data.
- Angka di `rencana_perbaikan` tidak diperiksa karena isinya rencana tindakan, bukan data capaian.
