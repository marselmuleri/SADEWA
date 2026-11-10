# Catatan Akhir Penyusunan C500 SADEWA

Catatan ini terpisah dari naskah dan tidak masuk ke `C500_SADEWA.docx`. Seluruh bukti eksekusi ada di folder `bukti-uji/`. Pengujian dijalankan pada 10 November 2026 di container cloud (Ubuntu 24.04, 2 vCPU, 7 GiB), bukan di mesin tim. Bukti dari tim belum ada yang dilampirkan.

Ada dua matriks keterlacakan:

- `bukti-uji/matriks-keterlacakan.csv`: 210 tes beserta SRS-id, tingkat kecocokan, dan kode kasus C500.
- `bukti-uji/matriks-kasus-srs.csv`: 77 kasus uji beserta SRS-id, hasil, dan bukti.

---

## (a) Placeholder [ISI] dan [GAMBAR] beserta bukti yang dibutuhkan

Docx berisi **37 penanda [ISI]** dan **2 penanda [GAMBAR]**, semuanya bersorot kuning (22 isi unik). Daftarnya menurut lokasi:

| Lokasi | Placeholder | Bukti yang dibutuhkan |
|---|---|---|
| 1.1 Ringkasan, 2.1.2 | Sumber RPS acuan (2×) | Nama program studi Teknik Komputer, universitas, dan tahun RPS yang diindeks ke ChromaDB. Jika akan disitasi, tambahkan juga ke daftar referensi kelompok. |
| 1.3 Referensi | Judul resmi C100–C400 | Judul persis di sampul dokumen C100–C400 kelompok. Judul yang saya tulis hanya perkiraan. |
| 2.1.1 | Pencocokan dengan rekap nilai manual | Satu kelas nyata: rekap Excel dosen dibandingkan dengan hasil SADEWA per CPL. Opsional, tetapi menguatkan. |
| 2.1.2 dan Tabel 2.12 H106 | Hasil `uji_keluaran_ai.py` dengan Qwen asli | Berkas `bukti-uji/keluaran-ai.json` dari mesin tim (perintahnya ada di poin c). |
| 2.1.2 | Penilaian manual dosen atas draf RPS | Catatan dosen tentang benar/salahnya materi dan kesesuaian dengan RPS acuan, termasuk kesalahan isi yang ditemukan. |
| Tabel 2.9 E107 (paragraf) | Rencana akses API SIAP UNDIP | Status izin atau rencana tim (boleh dihapus jika tidak ada). |
| Tabel 2.12 H112 | Unduh laporan evaluasi tingkat prodi | Coba unduh dari halaman Validasi Laporan (tombol Print/Export CSV), lalu catat format berkas dan simpan tangkapan layar. |
| Tabel 2.13 I101 dan paragrafnya | Log ingestion dan start AI Service | Keluaran perintah ingestion: jumlah dokumen dan potongan, serta log start AI Service di mesin tim. |
| Tabel 2.15 (15 sel + 3 judul kolom OS) | Hasil uji tim di Chrome, Firefox, dan Edge | Login 5 peran, buka 21 halaman, logout, cek konsol, dan grafik di tiap peramban. Catat OS dan versi peramban. |
| Tabel 2.15 baris grafik | Pemeriksaan visual grafik Recharts | Gulir halaman Analitik OBE dan pastikan grafik tampil. Tangkapan layar otomatis hanya menangkap bagian atas halaman. |
| Gambar 2.5, 2.6 | [GAMBAR] Firefox dan Edge | Tangkapan layar halaman Kurikulum OBE > Pemetaan IK sebagai Admin Prodi. |
| 2.2.2 B (halaman) | Waktu muat dari laptop tim | Ukur ulang dengan DevTools atau Playwright dari laptop ke server, dan catat perangkat serta jaringan. |
| 2.2.2 B (RAG) | Waktu generate RPS dan narasi | Diambil dari `keluaran-ai.json` (kolom `detik`). |
| Tabel 2.19 | HTTPS | Uji akses ke server tim lewat HTTPS, jika ada. |
| Tabel 2.19 (2×) | Pemindaian kerentanan | Misalnya OWASP ZAP baseline: nama alat, versi, tanggal, dan temuan. Jika tidak dilakukan, tulis sebagai keterbatasan dan hapus placeholder. |
| 2.2.2 E | Skor SUS | Kuesioner SUS 10 butir: jumlah dan peran responden, skor per responden, rata-rata, dan perbandingan dengan target 70. |
| 2.2.2 F | Uptime | Pemantauan minimal 1 bulan, misalnya UptimeRobot. Jika belum ada server tetap, tulis sebagai keterbatasan. |

## (b) Ketidakkonsistenan

**Basis RPS (perubahan dari tren industri).**

- C200 masih menulis SADEWA-07 sebagai RPS yang adaptif terhadap tren industri. C100 dan C300 juga masih memakai dasar lama.
- Kode sudah mengikuti dasar baru: fungsi tren industri sudah dihapus dan ada tes `test_prompt_rps_tidak_lagi_menyebut_skill_industri`.
- Naskah C500 mengikuti dasar baru. Dokumen C100–C300 perlu direvisi agar seragam.

**Target waktu RAG tidak konsisten di C200.** Ada tiga angka berbeda:

- 5–10 detik (bagian Waktu Respons)
- < 30 detik (Target Sistem)
- < 15 detik (contoh pengujian kinerja)

C300 juga menyebut 15 detik. Naskah memakai 5–10 detik dan menyebut adanya < 30 detik. Tim perlu menyepakati satu angka.

**Target lain di C200 yang tidak diuji:**

- Dasbor < 2 detik pada koneksi normal
- Minimal 10 request per detik secara bersamaan

Uji beban tidak dijalankan. Naskah hanya menyebut bahwa pengukuran dilakukan berurutan oleh satu klien.

**SRS-id dan tabel SRS:**

- SADEWA-08 tidak ada di C200 (penomoran melompat dari 07 ke 09).
- ID NF di C200 tertulis `SADEWA-NF-0x`, dan bentuk itu yang dipakai di naskah.
- Tabel endpoint di C300 memakai SADEWA-01..25 dengan arti lain, sehingga bertabrakan dengan SRS-id C200. Naskah memakai SRS-id dari C200.

**Tes tanpa SRS-id yang cocok** (lihat `matriks-keterlacakan.csv`):

- Lima tes `test_portofolio.py` (fitur portofolio mata kuliah) tidak punya padanan di SRS.
- 23 tes hanya cocok ke SRS-id terdekat:
  - arsip kurikulum
  - finalisasi nilai
  - status akademik mahasiswa
  - saran evaluasi CPMK
  - deteksi model embedding
  - alur validasi laporan T17–T21, yang dipetakan ke SADEWA-09 karena C200 tidak menulis alur ajukan/setujui secara eksplisit

**SRS-id tanpa kasus uji yang dijalankan:**

- SADEWA-NF-03 (SUS)
- SADEWA-NF-06 (uptime)
- SADEWA-NF-04 (akurasi RAG): hanya validitas format yang teruji, bukan akurasi isi
- SADEWA-NF-05: hanya Chromium

**Kode dan dokumen vs bukti uji:**

- README menyebut dua *head* Alembic, tetapi `alembic heads` hanya menunjukkan satu head (`20261109_011`). Yang terjadi sebenarnya ada dua *root* (`20261015_001` dan `5a78a3809846`), sehingga `upgrade heads` pada basis data kosong gagal.
- Rancangan menempatkan sinkronisasi SIAP sebagai jalur utama dan input manual sebagai cadangan. Pada kode, hanya input manual yang berjalan.
- SADEWA-05 menyebut tingkat universitas, sedangkan aplikasi hanya sampai tingkat fakultas (Dekan).
- SADEWA-10 menyebut hapus akun, sedangkan kode menonaktifkan akun (*soft delete*).
- Di C400 tertulis jumlah referensi C200 = 7. Yang benar 15 referensi. Mohon koreksi catatan C400.

**Rujukan.**

- Entri Rawis di C200 tidak memuat nama jurnal, sedangkan C100 memuat "Jurnal Manajemen Pendidikan". Naskah memakai versi C100.
- Entri Nadhifah diambil dari daftar pustaka laporan kakak tingkat, karena daftar referensi kelompok tidak punya jurnal tentang *black-box testing*.

**Sisa chatbot dan prediksi di kode.** Semua ini tidak diuji dan tidak ditulis sebagai fitur.

- `ChatbotPage.jsx` dan `ChatbotWindow.jsx` masih ada dan memanggil `/chatbot/tanya`, tetapi tidak dipasang di rute.
- Komponen sisa fitur prediksi:
  - `PrediksiCard` dan `FeatureImportanceChart`
  - `MataKuliahDetailPage`, yang memanggil `/analisis/prediksi-batch`
  - `EarlyWarningBadge`, yang masih dipakai di `MahasiswaDetailPage`
- `scikit-learn` dan `joblib` masih tercantum di `backend/requirements.txt`.
- Masih ada berkas `.pyc` `rag_service`.
- Docstring `rag_chain` sudah menyatakan fungsi tren industri dihapus.

Saran: hapus sisa-sisa ini sebelum serah terima.

## (c) Pengujian yang tidak bisa dijalankan di sesi ini dan perintah persisnya

Dari container, akses ke DashScope (Qwen) dan huggingface.co diblokir. Komputer tim juga tidak bisa dipakai untuk menjalankan perintah karena ruang disknya kurang. Perintah di bawah dijalankan dari root repositori `D:\Apps\SADEWA` dengan venv aktif.

1. **Model embedding dan AI Service:**
   ```
   cd ai
   python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"
   uvicorn sadewa_ai.api:app --port 8001 > ../bukti-uji/ai-service-startup-tim.txt 2>&1
   ```
2. **Ingestion knowledge base** (I101). Jalankan skrip ingestion sesuai README folder `ai` dan simpan keluarannya ke `bukti-uji/ingestion-tim.txt`. Catat jumlah dokumen dan potongan.
3. **Keluaran LLM asli** (H106, 2.1.2, waktu RAG). AI Service harus hidup dan `QWEN_API_KEY` valid:
   ```
   cd ai
   python ../bukti-uji/tes-tambahan/uji_keluaran_ai.py 3 ../bukti-uji/keluaran-ai.json
   ```
4. **Peramban lain** (Tabel 2.15). Pasang Playwright lalu ganti `chromium` dengan `firefox` di `uji_antarmuka_playwright.js`. Edge bisa dijalankan dengan `chromium.launch({channel: 'msedge'})`:
   ```
   cd bukti-uji
   npx playwright install firefox msedge
   node tes-tambahan/uji_antarmuka_playwright.js antarmuka-firefox
   ```
   Atau lakukan secara manual sambil mengambil tangkapan layar.
5. **Waktu muat dari laptop:**
   ```
   node tes-tambahan/uji_antarmuka_playwright.js antarmuka-laptop
   ```
   Arahkan ke server tim lewat jaringan, bukan localhost.
6. **Pemindaian kerentanan:**
   ```
   docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://<server>:8000 -r zap.html
   ```
7. **SUS:** sebarkan kuesioner SUS standar (10 butir, skala 1–5) ke dosen dan admin prodi. Skor = ((Σ butir ganjil − 5) + (25 − Σ butir genap)) × 2,5.
8. **Uptime:** pasang pemantau (misalnya UptimeRobot) pada server selama 1 bulan.

Untuk mengulang semua yang sudah dijalankan di sesi ini, perintahnya tertulis di baris pertama setiap log di `bukti-uji/`.

## (d) Hasil gagal atau parsial, dan rekomendasi

| Temuan | Bukti | Rekomendasi |
|---|---|---|
| Sinkronisasi SIAP UNDIP belum ada (`/nilai/sync` mengembalikan `not_configured`) | `tambahan-pytest.txt` T16 | Ajukan akses API SIAP, atau ubah SRS dan narasi agar input manual menjadi jalur utama. |
| Tidak ada tampilan tingkat universitas | `antarmuka-playwright.json` | Tambahkan peran atau tampilan universitas, atau revisi lingkup SADEWA-05. |
| `alembic upgrade heads` gagal pada basis data kosong | `backend-alembic.txt` | Jadikan `20261015_001` turunan dari revisi yang membuat `kurikulum_versions`, lalu uji ulang di basis data kosong. |
| `seed_demo` gagal tanpa `--reset` pada basis data baru | `seed-demo-postgresql.txt` | Tulis di README bahwa `--reset` wajib untuk basis data baru, atau buat tabel otomatis. |
| AI Service gagal start bila model embedding tidak ada di cache | `ai-service-startup.txt` | Unduh model saat instalasi atau sertakan di image, dan tampilkan pesan yang jelas. |
| Tidak ada header keamanan; `/docs` terbuka | `keamanan-server-hidup.txt` K9, K10 | Tambahkan middleware header keamanan dan matikan `/docs` di produksi. |
| Token tetap diterima setelah logout (masa berlaku bawaan 1.440 menit) | `keamanan-token-setelah-logout.txt` | Perpendek masa berlaku atau buat daftar token yang dicabut. |
| `SECRET_KEY` jatuh ke nilai bawaan `change-this-secret` jika `.env` tidak ada | Pengamatan kode `config.py` (tidak diuji, tidak dimasukkan ke naskah) | Hentikan aplikasi bila `SECRET_KEY` kosong di produksi. |
| `duckduckgo-search` dan `trafilatura` tidak ada di `pyproject.toml` maupun venv tim, padahal dipakai untuk mencari RPS web | `00-pip-freeze.txt` | Tambahkan ke dependensi. Saat ini pencarian RPS web diam-diam mengembalikan hasil kosong. |
| Lint menghasilkan 30 peringatan; berkas JS 1,29 MB | `frontend-lint.txt`, `frontend-build.txt` | Rapikan dependency hook dan pecah bundle dengan `import()` dinamis. |
| Label versi kurikulum tampil "2026 () (Draft)" | Gambar 2.4 | Jangan tampilkan tanda kurung bila deskripsi kosong. |
| Docker build backend gagal (temuan C400: `-e ../ai` di luar build context) | Tidak diuji ulang di C500 | Perbaiki Dockerfile atau compose. |

## (e) Klaim yang butuh referensi tetapi belum ada di daftar pustaka

- Rumus SIMAK-NG (2.1)–(2.4) dan Kasus Acuan 1 diambil dari spesifikasi formula SIMAK-NG yang dipakai tim. Jika dokumen itu resmi, sebaiknya dicantumkan sebagai pustaka. Untuk sementara naskah menyebutnya tanpa nomor rujukan.
- Kuesioner SUS dan rumus skornya belum punya rujukan di daftar referensi kelompok. Perlu ditambahkan saat bagian SUS diisi.
- Sumber RPS acuan (lihat poin a).
- Ada dua rujukan yang hanya saya pakai untuk klaim umum karena isi lengkap jurnalnya tidak saya baca, jadi mohon dicek:
  - Herwanto [4]: hanya dipakai untuk menyatakan bahwa perbandingan kinerja peramban sudah dikaji.
  - Rawis [2]: hanya dipakai untuk menyatakan bahwa evaluasi capaian merupakan bagian dari pengelolaan kurikulum OBE.

## (f) Asumsi yang diambil

- Kode yang diuji adalah salinan `D:\Apps\SADEWA` (berkas backend terakhir diubah 9 November 2026). Isi `.env` tidak dibaca; yang dicek hanya bahwa variabel yang dibutuhkan sudah terisi.
- Kode aplikasi dan tes bawaan tidak diubah. Untuk uji PostgreSQL, saya memakai salinan tes dengan `conftest` yang diarahkan ke PostgreSQL (`tes-tambahan/pg_suite`).
- Data uji adalah data sintetis dari `seed_demo` dan `app.core.seed`. Nama dosen yang muncul di tangkapan layar berasal dari data contoh tersebut.
- Hasil "Berhasil" untuk tes yang memakai AI tiruan hanya berarti logika backend dan AI Service di sekitar LLM berjalan, bukan bahwa keluaran Qwen benar.
- Butir E *Usability* dan F *Availability* saya tambahkan di bawah 2.2.2 karena target NF-03 dan NF-06 ada di spesifikasi, meskipun template hanya punya A–D. Jika dosen meminta template persis, isi keduanya bisa dipindah ke paragraf keterbatasan.
- Hasil "Gagal" untuk tingkat universitas (G104) didasarkan pada rute yang tersedia untuk kelima peran di uji antarmuka.
- Sampul hanya diisi Topik ("Support System", sama dengan C400) dan Judul. Siklus/tahun, nomor dokumen, tanggal, dan tabel pengusul dibiarkan sesuai template untuk diisi tim.
- Daftar Isi di docx akan diperbarui otomatis saat dibuka di Word. Jika Word bertanya untuk memperbarui *field*, pilih Yes.
- Profil gaya diambil dari laporan C500 kakak tingkat. Tidak ada kalimat, nama, atau angka dari laporan itu yang dipakai. Satu-satunya yang diambil dari sana adalah entri pustaka Nadhifah.
