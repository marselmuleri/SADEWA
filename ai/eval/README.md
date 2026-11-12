# Pengujian AI SADEWA (C500 subbab 2.1)

Mengukur **kepatuhan format** (lolos `validate_rps` / `validate_narasi`) dan
**ketepatan angka** narasi terhadap data backend, serta mencatat **waktu generate**.
Memakai LLM Qwen asli, jadi setiap percobaan memakan kuota API.

## Langkah

1. Isi `kasus_uji.json`:
   - `rps`: mata kuliah uji (disarankan 5).
   - `narasi`: data capaian **asli** dari backend (`capaian_service.get_capaian_cpl_mata_kuliah`).
   - Hapus entri berawalan `CONTOH` sebelum uji final.
2. Jalankan dari folder `ai/` (venv proyek, `QWEN_API_KEY` terisi di `ai/.env`):
   ```bash
   ../venv/Scripts/python.exe eval/uji_ai.py
   ```
3. Buka `hasil/narasi_angka.csv`, lalu periksa manual setiap baris `cocok=0`.
   Pencocokan angka bersifat otomatis (heuristik), jadi angka yang ditandai belum tentu salah
   (misalnya pembulatan yang tidak biasa). Koreksi kolom `cocok` bila perlu.
4. Buat grafik dan ringkasan angka:
   ```bash
   ../venv/Scripts/python.exe eval/grafik.py --target 10 15
   ```

## Keluaran (`hasil/`)

| File | Isi |
|---|---|
| `konfigurasi.json` | model, temperature, top-k, jumlah chunk, waktu uji (untuk subbab skenario) |
| `rps.csv` | per RPS: lolos percobaan pertama, lolos akhir, jumlah percobaan LLM, durasi |
| `rps_pelanggaran.csv` | setiap pelanggaran validator beserta kategorinya |
| `narasi.csv` | per narasi: lolos validator, angka cocok/total, status benar/total, durasi |
| `narasi_angka.csv` | setiap angka di narasi beserta konteks kalimatnya |
| `ringkasan.csv` | angka siap pakai untuk tabel laporan |
| `mentah/*.json` | keluaran AI apa adanya (untuk lampiran / cuplikan gambar) |
| `grafik/*.png` | diagram alur, kepatuhan per MK, jenis kegagalan, ketepatan angka, waktu (300 dpi) |

## Catatan untuk analisis

- Minggu UTS/UAS dipaksa oleh `rapikan_rps` sebelum validasi, sehingga kegagalan
  "UTS/UAS salah minggu" memang tidak akan muncul. Ini hasil desain, bukan kebetulan.
- `generate_rps` mencoba ulang maks. 2 kali. Laporkan **lolos percobaan pertama** (kemampuan
  LLM) dan **lolos akhir** (yang diterima pengguna) secara terpisah.
- Angka di `rekomendasi_intervensi` tidak diperiksa karena isinya rencana tindakan, bukan data capaian.
- Status Tercapai/Belum diperiksa dengan aturan prompt: Belum Tercapai bila nilai rata-rata < ambang (70).
- Referensi web di-cache per mata kuliah (file `ai/.cache/web_rps_cache.json`, 30 hari). Tanpa opsi
  tambahan, percobaan ke-2 dan ke-3 memakai cache seperti aplikasi sebenarnya. Tambahkan
  `--web-dingin` agar cache dihapus sebelum setiap generate, sehingga waktu web selalu diukur dari nol.
  Kolom `durasi_web_detik` di `rps.csv` mencatat waktu langkah web secara terpisah.
