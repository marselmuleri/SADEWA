# 2. Pengujian

## 2.1 Pengujian model

SADEWA tidak memakai model pembelajaran mesin yang dilatih dari data, sehingga tidak ada pengujian akurasi, presisi, atau recall terhadap dataset. Bagian yang berperan sebagai model pada SADEWA ada dua. Bagian pertama adalah mesin kalkulasi capaian di backend yang menghitung ketercapaian Indikator Kinerja (IK), CPMK, dan CPL secara deterministik dari nilai mahasiswa. Bagian kedua adalah modul AI yang menyusun draf RPS dan narasi evaluasi dengan pola Retrieval-Augmented Generation (RAG), yaitu mengambil potongan dokumen yang relevan dari knowledge base lalu menyisipkannya ke dalam prompt sebelum dikirim ke LLM [1]. Kedua bagian ini diuji dengan tolok ukur yang berbeda karena sifat keluarannya juga berbeda.

### 2.1.1 Pengujian Mesin Kalkulasi Capaian

Mesin kalkulasi diuji dengan membandingkan keluaran sistem terhadap nilai harapan yang dihitung dari rumus formula SIMAK-NG. Evaluasi ketercapaian capaian pembelajaran merupakan bagian dari pengelolaan kurikulum berbasis OBE [2], sehingga angka yang dihasilkan sistem perlu dapat ditelusuri ulang dari nilai mentah. Karena itu, pemeriksaan dilakukan pada setiap tahap pembulatan dan tidak berhenti pada nilai akhir. Seluruh operasi pada mesin kalkulasi memakai tipe `Decimal` dengan pembulatan dua desimal `ROUND_HALF_UP`. Tahap pertama adalah menghitung poin setiap sel matriks bentuk penilaian terhadap IK menggunakan Persamaan (2.1).

`poin_sel = (bobot_sel × nilai) / 100`  (2.1)

Pada Persamaan (2.1), bobot_sel adalah bobot sel pada matriks bentuk penilaian dan IK, sedangkan nilai adalah nilai mentah mahasiswa pada skala 0 sampai 100. Poin sel yang sudah dibulatkan kemudian dijumlahkan menjadi poin IK, dan poin IK dijumlahkan lagi menjadi poin CPL sesuai Persamaan (2.2).

`poin_IK = Σ poin_sel ;  poin_CPL = Σ poin_IK`  (2.2)

Persentase ketercapaian CPL pada satu mata kuliah diperoleh dengan membagi poin CPL dengan bobot_CP, yaitu jumlah bobot IK milik CPL tersebut pada pemetaan CPMK, seperti pada Persamaan (2.3). Jika bobot_CP bernilai nol, sistem mengembalikan 0,00 agar tidak terjadi pembagian dengan nol.

`persen_CPL = (poin_CPL / bobot_CP) × 100`  (2.3)

Capaian CPMK dihitung sebagai rata-rata persentase IK pendukungnya yang dibobot dengan bobot pemetaan CPMK ke IK. Persentase IK sendiri adalah poin IK dibagi bobot IK pada mata kuliah, dikali 100. Hubungan ini dituliskan pada Persamaan (2.4).

`persen_CPMK = Σ (persen_IK × bobot_map) / Σ bobot_map`  (2.4)

Ketepatan keluaran dinyatakan dengan selisih mutlak antara nilai harapan dan nilai sistem pada Persamaan (2.5). Keluaran dinilai sesuai apabila selisihnya 0,00 pada dua desimal, karena nilai pada dokumen evaluasi juga dicantumkan dengan dua desimal.

`selisih = | nilai_harapan − nilai_sistem |`  (2.5)

Pengujian dilakukan dengan dua cara. Cara pertama adalah menjalankan tes otomatis bawaan repositori yang berkaitan dengan kalkulasi menggunakan pytest, masing-masing pada basis data SQLite in-memory dan PostgreSQL 16.15. Cara kedua adalah menjalankan skrip verifikasi terhadap Kasus Acuan 1, yaitu data contoh dari spesifikasi formula SIMAK-NG yang berisi enam CPMK, sembilan IK, enam CPL, dan empat bentuk penilaian (Tugas, Kuis, UTS, dan UAS). Rekap tes otomatis untuk mesin kalkulasi ditunjukkan pada Tabel 2.1.

Tabel 2.1. Rekap Tes Otomatis Mesin Kalkulasi

| Berkas Tes | Aspek yang Diuji | Jumlah | SQLite | PostgreSQL |
|---|---|---|---|---|
| `test_obe_formula.py` | Rumus poin sel, pembulatan, Kasus Acuan 1, nilai kosong, multi-CPL, bobot_CP nol | 6 | 6 lulus | 6 lulus |
| `test_ik_contribution.py` | Kontribusi bentuk penilaian terhadap IK dan kasus bobot nol | 7 | 7 lulus | 7 lulus |
| `test_cpl_aggregate.py` | Gabungan capaian CPL lintas mata kuliah | 3 | 3 lulus | 3 lulus |
| `test_analitik.py` | Rumus persen IK dan CPMK serta analitik prodi | 4 | 4 lulus | 4 lulus |
| `test_integrasi_obe.py` | Alur kalkulasi lengkap dengan mahasiswa tanpa nilai | 1 | 1 lulus | 1 lulus |
| `test_skala_nilai.py` | Penentuan nilai huruf dan snapshot nilai final | 4 | 4 lulus | 4 lulus |
| Jumlah |  | 25 | 25 lulus | 25 lulus |

Berdasarkan Tabel 2.1, seluruh 25 tes yang berkaitan dengan mesin kalkulasi lulus pada kedua basis data. Tes tersebut mencakup aturan pembulatan per sel, kasus nilai kosong, satu CPMK yang memetakan lebih dari satu CPL, bobot_CP bernilai nol, serta penggabungan capaian CPL dari beberapa mata kuliah. Hasil perbandingan per CPL pada Kasus Acuan 1 ditunjukkan pada Tabel 2.2.

Tabel 2.2. Hasil Perhitungan Kasus Acuan 1

| CPL | Poin Harapan | Poin Sistem | Selisih | Persen Harapan | Persen Sistem | Selisih |
|---|---|---|---|---|---|---|
| CP1 | 3,50 | 3,50 | 0,00 | 70,00 | 70,00 | 0,00 |
| CP2 | 17,50 | 17,50 | 0,00 | 87,50 | 87,50 | 0,00 |
| CP4 | 27,13 | 27,13 | 0,00 | 72,35 | 72,35 | 0,00 |
| CP6 | 9,38 | 9,38 | 0,00 | 75,04 | 75,04 | 0,00 |
| CP7 | 8,50 | 8,50 | 0,00 | 68,00 | 68,00 | 0,00 |
| CP8 | 8,25 | 8,25 | 0,00 | 66,00 | 66,00 | 0,00 |
| Nilai akhir | 74,25 | 74,25 | 0,00 | – | – | – |

Pada Tabel 2.2, keenam CPL dan nilai akhir mahasiswa pada Kasus Acuan 1 memiliki selisih 0,00 terhadap nilai harapan. Sebagai contoh, CP4 hanya dipetakan ke IK4c dengan bobot_CP 37,5. Poin selnya adalah 6 × 100 / 100 = 6,00 untuk Tugas, 4 × 100 / 100 = 4,00 untuk Kuis, 13,5 × 75 / 100 = 10,125 yang dibulatkan menjadi 10,13 untuk UTS, dan 14 × 50 / 100 = 7,00 untuk UAS. Jumlahnya 27,13 poin, sehingga persentase CP4 menurut Persamaan (2.3) adalah 27,13 / 37,5 × 100 = 72,35 persen. CP7 (68,00 persen) dan CP8 (66,00 persen) berada di bawah ambang ketercapaian bawaan 70, dan sistem tetap menampilkannya apa adanya. Cakupan uji ini terbatas pada satu kasus acuan dan data uji pada tes otomatis, sehingga belum mewakili seluruh variasi konfigurasi kurikulum yang mungkin dipakai program studi. [ISI: hasil pencocokan kalkulasi SADEWA dengan rekap nilai manual dosen pada satu kelas nyata, jika tersedia]

### 2.1.2 Pengujian Keluaran Modul AI

Modul AI dijalankan sebagai layanan terpisah pada port 8001 dan menghasilkan draf RPS 16 pertemuan, narasi evaluasi capaian, serta saran evaluasi CPMK untuk portofolio mata kuliah. Draf RPS disusun dari pedoman kurikulum program studi dan RPS mata kuliah sejenis dari program studi Teknik Komputer lain yang sudah diindeks ke ChromaDB [ISI: sumber RPS acuan, yaitu nama program studi, universitas, dan tahun]. Karena isi keluaran LLM tidak dapat dibandingkan dengan satu jawaban benar, pengujian pada bagian ini diarahkan pada hal yang dapat diperiksa secara otomatis, yaitu validitas format, ketahanan parser terhadap variasi respons, dan kesesuaian prompt dengan data masukan.

Seluruh tes pada bagian ini dijalankan dengan pytest di folder `ai` dan memakai LLM tiruan yang mengembalikan respons buatan. Dengan demikian, hasilnya menunjukkan bahwa logika di sekitar LLM bekerja sesuai rancangan, tetapi tidak menunjukkan kualitas isi yang dihasilkan Qwen. Aturan validasi RPS yang diuji adalah jumlah pertemuan 16, UTS pada minggu ke-8, UAS pada minggu ke-16, total bobot 100, nomor minggu tidak ganda, kode CPMK terdaftar, dan kelengkapan field wajib. Rekap hasilnya ditunjukkan pada Tabel 2.3.

Tabel 2.3. Rekap Tes Modul AI dengan LLM Tiruan

| Kelompok | Aspek yang Diuji | Jumlah | Hasil |
|---|---|---|---|
| Validator RPS | 16 pertemuan, UTS minggu 8, UAS minggu 16, total bobot 100, minggu ganda, CPMK terdaftar, field wajib, tipe data | 10 | 10 lulus |
| Validator narasi | Field wajib, daftar analisis kosong, ringkasan kosong | 4 | 4 lulus |
| Parser JSON dari respons LLM | JSON polos, pagar markdown, kalimat pembuka dan penutup, JSON bersarang, JSON rusak | 11 | 11 lulus |
| Isi prompt RPS dan narasi | Parameter mata kuliah, tanpa instruksi keterampilan industri, angka capaian, capaian kosong | 4 | 4 lulus |
| Skema permintaan | SKS, semester, nama mata kuliah, capaian kosong, nilai bukan angka | 7 | 7 lulus |
| Endpoint API dengan LLM tiruan | `/health`, generate RPS sukses dan gagal validasi, generate narasi | 4 | 4 lulus |
| Streaming SSE | Urutan event, pengulangan saat validasi gagal, penutupan event saat gagal | 4 | 4 lulus |
| Saran evaluasi CPMK | Validator, prompt, pengulangan bila CPMK terlewat, endpoint | 5 | 5 lulus |
| Deteksi model embedding di cache | Model lengkap, model tanpa bobot, mode luring | 4 | 4 lulus |
| Jumlah |  | 53 | 53 lulus |

Berdasarkan Tabel 2.3, 53 tes modul AI lulus dalam 3,13 detik. Validator berhasil mendeteksi setiap pelanggaran yang sengaja disisipkan, misalnya total bobot yang tidak sama dengan 100 dan UTS yang tidak berada di minggu ke-8. Parser juga mampu mengambil objek JSON dari respons yang dibungkus pagar markdown atau diawali kalimat pembuka. Salah satu tes memeriksa bahwa prompt RPS tidak lagi memuat instruksi berbasis keterampilan industri, sesuai dengan perubahan dasar penyusunan RPS. Tes narasi memeriksa bahwa angka capaian masukan ikut tertulis di prompt, sehingga model diberi data nyata dari hasil kalkulasi.

Pengujian dengan LLM asli belum dilakukan karena akses ke layanan Qwen dan ke huggingface.co diblokir dari lingkungan uji, dan AI Service gagal dijalankan tanpa model embedding yang tersimpan di cache. Skrip `uji_keluaran_ai.py` telah disiapkan untuk dijalankan tim pada mesin yang memiliki akses tersebut. Skrip ini mengukur durasi generate, persentase draf RPS yang lolos validator, dan kecocokan status Tercapai atau Belum Tercapai pada narasi terhadap nilai rata-rata masukan dengan ambang 70. Kebenaran materi dan kesesuaian draf dengan RPS acuan tetap harus dinilai secara manual oleh dosen. [ISI: hasil `uji_keluaran_ai.py` dengan Qwen asli, yaitu jumlah percobaan, persentase lolos validator, rata-rata dan maksimum waktu generate, serta kecocokan status narasi] [ISI: hasil penilaian manual dosen terhadap minimal satu draf RPS, termasuk kesalahan isi yang ditemukan]
