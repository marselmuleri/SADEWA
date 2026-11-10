# 1. Pendahuluan

## 1.1 Ringkasan isi dokumen

Dokumen ini memuat hasil pengujian SADEWA (Sistem Analisis Data Evaluasi Wawasan Akademik), aplikasi web untuk menghitung ketercapaian Capaian Pembelajaran Lulusan (CPL) dan Capaian Pembelajaran Mata Kuliah (CPMK) pada lingkungan Outcome-Based Education (OBE), sekaligus menyusun draf Rencana Pembelajaran Semester (RPS) dan narasi evaluasi dengan bantuan Large Language Model (LLM). Pengujian dibagi menjadi pengujian mesin kalkulasi dan modul AI pada subbab 2.1, lalu pengujian aplikasi pada subbab 2.2 yang mencakup aspek fungsional dengan metode black-box serta aspek non-fungsional berupa portability, response time, safety, dan security.

Seluruh hasil pada dokumen ini berasal dari pengujian yang dijalankan pada 10 November 2026 di sebuah container cloud Ubuntu 24.04 dengan 2 vCPU dan RAM 7 GiB. Di lingkungan tersebut, 129 tes otomatis backend lulus pada SQLite dan pada PostgreSQL 16.15, 53 tes AI Service lulus, dan 28 tes tambahan yang ditulis untuk dokumen ini juga lulus. Pengujian antarmuka dilakukan dengan Playwright pada Chromium headless terhadap lima peran pengguna dan 21 halaman. Bukti dari tim, seperti tangkapan layar pada perangkat nyata, hasil kuesioner, dan catatan uji pengguna, belum dilampirkan pada versi ini sehingga bagian yang membutuhkannya diberi tanda [ISI].

Akses dari container ke layanan Qwen dan ke huggingface.co diblokir. Akibatnya, LLM tidak pernah dipanggil secara langsung dan seluruh tes modul AI memakai LLM tiruan (mock). Kualitas isi draf RPS dan narasi, waktu generate dokumen, skor System Usability Scale (SUS), kompatibilitas pada Firefox dan Edge, serta ketersediaan layanan belum dapat diukur dan dicatat sebagai keterbatasan. Beberapa hasil juga tercatat gagal, yaitu sinkronisasi nilai dari SIAP UNDIP yang belum tersedia, migrasi Alembic pada basis data kosong, start AI Service tanpa model embedding di cache, serta belum adanya header keamanan pada respons backend.

Draf RPS pada versi aplikasi yang diuji disusun dari pedoman kurikulum program studi dan RPS mata kuliah sejenis dari program studi Teknik Komputer lain yang diindeks ke knowledge base [ISI: sumber RPS acuan, yaitu nama program studi, universitas, dan tahun]. Pengujian modul AI pada dokumen ini mengikuti dasar tersebut.

## 1.2 Aplikasi Dokumen

Dokumen ini berlaku berfungsi untuk menjelaskan:

1) Tahap pengujian produk yang telah dibuat dalam dokumen C300 dan C400
2) Acuan keberhasilan produk sesuai spesifikasi yang telah dijabarkan dalam dokumen C200
3) Menjadi catatan pengerjaan dan proses pengujian produk yang dilakukan
4) Catatan proses pengerjaan dan revisi yang sedang berlangsung

*(butir 1.2 dipertahankan persis dari template)*

## 1.3 Referensi

Dokumen ini disusun dengan mengacu pada dokumen capstone SADEWA sebelumnya, yaitu C100 (Penentuan Masalah dan Spesifikasi Awal), C200 (Spesifikasi Kebutuhan dan Target Sistem), C300 (Perancangan), dan C400 (Implementasi) [ISI: sesuaikan judul resmi dokumen C100–C400 kelompok]. Pustaka ilmiah yang dirujuk di dalam naskah dicantumkan pada bagian Daftar Pustaka di akhir dokumen.

## 1.4 Daftar Singkatan

Tabel 1.1. Daftar Singkatan

| Singkatan | Kepanjangan |
|---|---|
| AI | Artificial Intelligence |
| API | Application Programming Interface |
| CORS | Cross-Origin Resource Sharing |
| CPL | Capaian Pembelajaran Lulusan |
| CPMK | Capaian Pembelajaran Mata Kuliah |
| HTTP | Hypertext Transfer Protocol |
| IK | Indikator Kinerja |
| JSON | JavaScript Object Notation |
| JWT | JSON Web Token |
| LLM | Large Language Model |
| OBE | Outcome-Based Education |
| RAG | Retrieval-Augmented Generation |
| RBAC | Role-Based Access Control |
| RPS | Rencana Pembelajaran Semester |
| SADEWA | Sistem Analisis Data Evaluasi Wawasan Akademik |
| SIAP | Sistem Informasi Akademik, Penelitian, dan Pengabdian |
| SKS | Satuan Kredit Semester |
| SQL | Structured Query Language |
| SSE | Server-Sent Events |
| SUS | System Usability Scale |
| UAS | Ujian Akhir Semester |
| UTS | Ujian Tengah Semester |
