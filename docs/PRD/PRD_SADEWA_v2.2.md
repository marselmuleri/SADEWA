# PRD — SADEWA

**Sistem Analisis Data Evaluasi Wawasan Akademik**
**Aplikasi Web (React + FastAPI + AI Service RAG)**

| | |
|---|---|
| **Version** | 2.2 (Selaras dengan Implementasi) |
| **Date** | November 2026 |
| **Status** | Dalam Pengembangan — sebagian besar fitur berjalan |
| **Author** | Tim SADEWA (Marsel Muleri, Rafi Athallah) |
| **Menggantikan** | PRD v2.1 (September 2026) |

> **Cara membaca dokumen ini.** PRD v2.2 ditulis ulang dari kode yang berjalan, bukan dari rencana awal. Setiap fitur diberi status: **Berjalan** (backend + UI ada), **Sebagian** (backend ada, UI belum lengkap, atau sebaliknya), **Belum** (belum dibangun). Jika kode dan dokumen ini berbeda, perlakukan sebagai bug yang harus dibereskan di salah satu sisi — jangan diam-diam mengikuti salah satunya.

---

## Daftar Isi

0. [Catatan Revisi v2.1 → v2.2](#0-catatan-revisi-v21--v22)
1. [Executive Summary](#1-executive-summary)
2. [Product Overview & Scope](#2-product-overview--scope)
3. [Multi-Tenancy, Peran, dan Isolasi Data](#3-multi-tenancy-peran-dan-isolasi-data)
4. [Matriks Hak Akses (Sumber Kebenaran RBAC)](#4-matriks-hak-akses-sumber-kebenaran-rbac)
5. [Framework OBE yang Diimplementasikan](#5-framework-obe-yang-diimplementasikan)
6. [Alur Sistem End-to-End](#6-alur-sistem-end-to-end)
7. [Spesifikasi Fitur](#7-spesifikasi-fitur)
8. [UI/UX & Navigasi per Role](#8-uiux--navigasi-per-role)
9. [Arsitektur Sistem & Data](#9-arsitektur-sistem--data)
10. [Ringkasan API](#10-ringkasan-api)
11. [Metodologi Kalkulasi](#11-metodologi-kalkulasi)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [Gap yang Diketahui & Backlog](#13-gap-yang-diketahui--backlog)
14. [Success Metrics](#14-success-metrics)

---

## 0. Catatan Revisi v2.1 → v2.2

| # | Perubahan | Alasan / Sumber |
|---|---|---|
| R1 | **Analitik OBE (dashboard capaian CPL/IK/CPMK & tren) dicabut dari Admin Prodi.** Yang berwenang: **Dosen, Kaprodi, Dekan**. Ikhtisar Admin Prodi diganti menjadi ringkasan kesiapan konfigurasi kurikulum. | Revisi dosen pembimbing: analisis capaian adalah wewenang akademik dosen & pimpinan, bukan administrator prodi. Backend menolak Admin Prodi (403) di `/dashboard/*` dan `/trending/*`. |
| R2 | **Struktur Fakultas → Program Studi.** Dekan terikat ke `fakultas_id` (bukan daftar `program_ids`) dan otomatis melihat semua prodi di fakultasnya. | Implementasi model `fakultas`, `program_studi`, `users.fakultas_id`. |
| R3 | **Pembagian pembuatan akun.** Super Admin membuat akun **Admin Prodi & Dekan**; Admin Prodi membuat akun **Dosen & Kaprodi** di prodinya. Password diisi saat pembuatan (belum ada email otomatis). | `users.py` (`SUPER_ADMIN_MANAGED_ROLES`, `ADMIN_PRODI_MANAGED_ROLES`). |
| R4 | **Model penilaian mengikuti SIMAK-NG**, bukan "Tugas/UTS/UAS → CPMK": Jenis Evaluasi → Bentuk Penilaian → bobot per mata kuliah → matriks bobot Bentuk Penilaian × IK. Nilai diinput per (mahasiswa, bentuk penilaian, IK). | `services/calculation/`, model `mk_bentuk_penilaian*`, `nilai_bentuk_penilaian`. |
| R5 | **Bobot wajib tepat 100%** sebelum nilai bisa diinput/dihitung (sebelumnya: "boleh ≠ 100%"). | `cek_siap_dinilai` di `calculation/engine.py`. |
| R6 | **Versi kurikulum** = label versi + deskripsi + tahun, status `draft`/`published`. Kolom `semester` pada versi kurikulum dihapus. | Migrasi `20261108_005`. |
| R7 | **Validasi laporan: hanya Kaprodi yang approve/reject.** Dekan melihat (view-only) lintas prodi di fakultasnya. | `validasi.py`. |
| R8 | **Tidak ada role switcher.** Login nyata (JWT); role ditentukan akun. | `AuthContext.jsx`. |
| R9 | **Mahasiswa & peserta kuliah** menjadi entitas tersendiri (data mahasiswa per prodi, peserta per mata kuliah). | Halaman Data Mahasiswa & Peserta Kuliah. |
| R10 | **Halaman Data Master** (read-only, lintas entitas: versi kurikulum, CPL, IK, CPMK) untuk semua role akademik. | `/data-master/*`. |
| R11 | **LLM yang dipakai: Qwen** (Alibaba Model Studio) lewat AI Service terpisah dengan RAG ChromaDB. | `ai/`. |
| R12 | Sinkronisasi SIAP UNDIP **belum tersedia**; upload nilai CSV/Excel **belum tersedia**. Input nilai saat ini manual. | `nilai.py` (`/sync` hanya mencatat log `not_configured`). |
| R13 | **Batas wewenang Admin Prodi diperjelas:** Admin Prodi tetap boleh melihat **semua data** prodinya (kurikulum, mata kuliah, mahasiswa, peserta, nilai, hasil kalkulasi per mata kuliah), tetapi **tidak** boleh melihat **Analitik OBE**. Rapor capaian mahasiswa (`/rapor/mahasiswa/{id}`) termasuk Analitik OBE, jadi Admin Prodi ditolak (403). Dosen hanya melihat rapor untuk mata kuliah yang diampu. | Keputusan tim atas gap G7 (November 2026). |
| R14 | **Capaian CPL disimpan per mata kuliah** (`cpl_achievement.mata_kuliah_id`, `bobot_cp`). Capaian CPL gabungan = rata-rata capaian per mata kuliah **dibobot dengan bobot IK** yang mengacu ke CPL itu: Σ(persen_cpl × bobot_cp) / Σ bobot_cp. Dosen dapat mengakses capaian CPL untuk mata kuliah yang diampu. | Keputusan tim atas gap G11 (November 2026). Sebelumnya kalkulasi satu mata kuliah menimpa capaian CPL mata kuliah lain. |
| R15 | **Data Master vs Data Current.** Halaman kerja (Kurikulum OBE, dsb.) = *Data Current*: data terbaru, boleh dikoreksi kapan saja. *Data Master* = **arsip data yang sudah fix dipakai**, diambil otomatis saat versi kurikulum dipublish dan oleh Admin Prodi saat menutup semester. Koreksi salah input **tidak** tercatat di Data Master. | Keputusan tim (November 2026). |
| R16 | **Analitik OBE diperluas** untuk Kaprodi & Dekan (cakupan prodi) dan **Dosen dengan fitur yang sama untuk cakupan mata kuliah yang diampu**: Ringkasan Evaluasi (kartu temuan + papan prioritas), Perbandingan Angkatan + heatmap, drill-down sampai CPMK, Simulator Threshold, Peta Kurikulum. **Rumus IK & CPMK diperbaiki** ke skala persen (sebelumnya CPMK dihitung dari poin sehingga mahasiswa sempurna hanya bernilai 52%). | Rekomendasi tim untuk bahan evaluasi kurikulum (November 2026). |
| R17 | **Dosen pengampu mengelola CPMK mata kuliah yang diampu**: tambah, ubah (termasuk **bobot**), hapus CPMK, dan memetakan CPMK → IK/CPL beserta bobotnya. Menggantikan larangan C10. Data dasar mata kuliah (kode, nama, SKS, semester) tetap wewenang Admin Prodi. Hapus CPMK tetap ditolak bila sudah ada nilai atau hasil evaluasi final. UI: menu Dosen **Mata Kuliah Saya** (`/mata-kuliah-saya`) dan **CPMK Saya** (`/cpmk-saya`). | Keputusan tim atas gap G4 (November 2026). |

---

## 1. Executive Summary

SADEWA adalah **sistem web multi-tenant** yang dapat diadopsi oleh berbagai program studi untuk mengotomatisasi evaluasi **Outcome-Based Education (OBE)** dan menyusun dokumen akademik (RPS, laporan evaluasi) dengan bantuan AI.

### Key Innovation

- **Multi-Tenant** — satu aplikasi & satu database untuk banyak prodi, data terisolasi per prodi/fakultas di level backend.
- **Hierarki OBE 3 level** — CPL → IK → CPMK, dengan matriks Bentuk Penilaian × IK (formula SIMAK-NG).
- **Kalkulasi deterministik** — semua angka capaian dihitung backend dengan `Decimal`; AI hanya menyusun narasi, tidak boleh mengarang angka.
- **Analitik berlapis sesuai kewenangan** — Dosen per mata kuliah, Kaprodi per prodi, Dekan lintas prodi di fakultas.
- **Trending** — tren capaian CPL per angkatan.
- **AI-Assisted Docs** — draf RPS 16 pertemuan & laporan evaluasi (RAG + Qwen), tetap direview manusia.

### Cakupan Fitur

| No | Fitur | Status |
|---|---|---|
| 1 | Login & RBAC (5 role) | Berjalan |
| 2 | Kurikulum OBE (versi, CPL, IK, CPMK, pemetaan) | Berjalan |
| 3 | Mata Kuliah & Dosen Pengampu | Berjalan |
| 4 | Evaluasi Pembelajaran (Jenis Evaluasi, Bentuk Penilaian) | Berjalan |
| 5 | Manajemen Akun Pengguna (per prodi & lintas prodi) | Berjalan |
| 6 | Data Mahasiswa & Peserta Kuliah | Berjalan |
| 7 | Penilaian & Kalkulasi Capaian (Dosen) | Berjalan |
| 8 | Ikhtisar (dashboard per role) | Berjalan |
| 9 | Analitik OBE 3-Level + Trending (Dosen, Kaprodi, Dekan) | Berjalan |
| 10 | Generate RPS (AI) | Berjalan (butuh AI Service) |
| 11 | Laporan Evaluasi (AI) & Validasi Kaprodi | Berjalan (butuh AI Service) |
| 12 | Data Master (read-only) | Berjalan |
| 13 | Panel Super Admin (fakultas, prodi, akun pimpinan) | Berjalan |
| 14 | Export | Sebagian (CSV dari dashboard/analitik/tren) |
| 15 | Sinkronisasi SIAP UNDIP | Belum |
| 16 | Upload nilai CSV/Excel | Belum |
| 17 | Skala nilai huruf, range nilai CPL, finalisasi/unlock hasil, rapor mahasiswa | Sebagian (API ada, UI belum) |

---

## 2. Product Overview & Scope

### 2.1 Problems Solved

| Problem | Kondisi Sekarang | Solusi SADEWA |
|---|---|---|
| Spreadsheet manual | Dosen menyalin nilai ke Excel berulang | Input nilai terstruktur per bentuk penilaian × IK |
| Hitung CPL rawan salah | Rumus manual, tidak teraudit | Kalkulasi otomatis formula SIMAK-NG, validasi bobot sebelum hitung |
| Laporan akreditasi lambat | Data tersebar | Analitik terintegrasi + laporan evaluasi berbantuan AI |
| Kurikulum kaku | Hardcoded per prodi | Versi kurikulum per prodi, dikelola mandiri |
| Tren tidak terpantau | Perbandingan antar angkatan manual | Trending CPL per angkatan |

### 2.2 Scope — IN

- Multi-tenancy fakultas → prodi, provisioning oleh Super Admin.
- Autentikasi JWT, RBAC 5 role.
- Kurikulum OBE per prodi: versi, CPL, IK, mata kuliah, pengampu, CPMK, pemetaan CPMK→IK, jenis evaluasi, bentuk penilaian.
- Data mahasiswa dan peserta mata kuliah.
- Input nilai manual, validasi bobot, kalkulasi capaian IK/CPMK/CPL.
- Ikhtisar per role, Analitik OBE 3-level, Trending per angkatan.
- Generate RPS & laporan evaluasi (AI), alur submit → approve/reject.
- Export CSV.

### 2.3 Scope — OUT (MVP)

- Generate Soal / Bank Soal.
- Mobile app (desktop-first).
- Email notifikasi & pengiriman kredensial otomatis.
- Predictive analytics.
- Multi-bahasa.
- Impersonate/support access untuk Super Admin.

### 2.4 Ditunda (bukan dibuang)

- Sinkronisasi SIAP UNDIP (menunggu akses API & kredensial institusional).
- Upload nilai CSV/Excel.
- Export PDF/Excel berformat.
- Landing page publik & form pengajuan prodi baru.

---

## 3. Multi-Tenancy, Peran, dan Isolasi Data

### 3.1 Model Tenant

```
Fakultas (mis. Fakultas Teknik)
 └── Program Studi (mis. Informatika, Teknik Elektro)
      └── Kurikulum, CPL, IK, Mata Kuliah, Mahasiswa, Jenis Evaluasi, ...
```

| Role | Terikat ke | Cakupan data |
|---|---|---|
| Super Admin | — | Metadata operasional saja (fakultas, prodi, akun). **Ditolak** di semua endpoint data akademik. |
| Admin Prodi | `program_studi_id` | Prodi miliknya |
| Kaprodi | `program_studi_id` | Prodi miliknya |
| Dosen | `program_studi_id` (dari prodi Admin yang membuatnya) | Mata kuliah yang diampu (via `pengampu_mata_kuliah`) |
| Dekan | `fakultas_id` | Semua prodi di fakultasnya, **view-only**; memilih satu prodi lewat selector untuk melihat data |

### 3.2 Prinsip Isolasi

- Scope selalu dibaca dari **akun yang login** di backend (`get_academic_scope`, `get_scoped_prodi_id`), bukan dari parameter client. Parameter `program_studi_id` dari client hanya dipakai Dekan, dan divalidasi harus berada di fakultasnya.
- Dosen yang bukan pengampu suatu mata kuliah ditolak (403) saat mengakses nilai/dashboard mata kuliah itu.
- Frontend menyembunyikan menu dan tombol yang tidak berwenang (tidak dirender di DOM), tetapi **guard backend adalah pertahanan utama**.

### 3.3 Super Admin

**Prinsip: akses operasional, bukan akses akademik.**

| Super Admin BISA | Super Admin TIDAK BISA |
|---|---|
| CRUD Fakultas & Program Studi | Melihat kurikulum, CPL/IK/CPMK |
| Membuat & mengelola akun **Admin Prodi** dan **Dekan** | Melihat nilai, capaian, laporan |
| Melihat daftar pengguna lintas prodi, aktif/nonaktifkan | Membuat akun Dosen/Kaprodi (didelegasikan ke Admin Prodi) |

### 3.4 Onboarding Prodi Baru

```
STEP 1  Super Admin membuat Fakultas (jika belum ada) dan Program Studi
STEP 2  Super Admin membuat akun Admin Prodi (dan Dekan untuk fakultas baru)
STEP 3  Admin Prodi login → Ikhtisar menampilkan checklist kesiapan kurikulum
STEP 4  Admin Prodi membuat akun Dosen & Kaprodi untuk prodinya
STEP 5  Admin Prodi menyusun kurikulum (lihat Bagian 6.2), lalu mem-publish versi
STEP 6  Prodi beroperasi mandiri tanpa Super Admin
```

> Registrasi publik (`POST /auth/register`) hanya untuk membuat **Super Admin pertama** di database kosong, lalu tertutup otomatis.

---

## 4. Matriks Hak Akses (Sumber Kebenaran RBAC)

> Legenda: **K** = kelola (buat/ubah/hapus) · **L** = lihat · **—** = tidak ada akses (menu tidak tampil, API 403).

### 4.1 Halaman

| Halaman (rute) | Super Admin | Admin Prodi | Dosen | Kaprodi | Dekan |
|---|---|---|---|---|---|
| Ikhtisar (`/dashboard`) | — | L (kesiapan konfigurasi, **tanpa angka capaian**) | L (per mata kuliah diampu) | L (capaian prodi) | L (capaian prodi terpilih) |
| **Analitik OBE** (`/analisis`) | — | **—** | L (per mata kuliah diampu) | L (drill-down + tren prodi) | L (drill-down + tren prodi terpilih) |
| Kurikulum OBE — kelola (`/kurikulum/*`: CPL, IK, Pemetaan, Mata Kuliah, CPMK, Jenis Evaluasi, Bentuk Penilaian) | — | K | — | — | — |
| Kurikulum OBE — lihat (`/kurikulum`) | — | (dialihkan ke halaman kelola) | L | L + ubah target (threshold) CPL | L |
| Data Master (`/data-master/*`, termasuk Arsip Kurikulum) | — | L + arsipkan semester | L | L | L (filter prodi) |
| Data Mahasiswa (`/mahasiswa`) | — | K | — | — | — |
| Peserta Kuliah (`/peserta`) | — | K | K (mata kuliah diampu) | — | — |
| Penilaian (`/penilaian`) | — | — | K (mata kuliah diampu) | — | — |
| Laporan Saya / Validasi Laporan (`/dokumen`) | — | — *(lihat Gap G3)* | K (buat, edit, submit; generate RPS) | Approve/Reject | L |
| Manajemen Pengguna Prodi (`/pengaturan`) | — | K (Dosen, Kaprodi) | — | — | — |
| Panel Super Admin (`/super-admin/prodi`, `/fakultas`, `/users`) | K | — | — | — | — |

### 4.2 Aturan Backend Kunci

| Area | Aturan |
|---|---|
| `/dashboard/*`, `/trending/*`, `/rapor/*` (Analitik OBE) | Hanya Dosen, Kaprodi, Dekan. Admin Prodi & Super Admin → 403. |
| Rapor mahasiswa untuk Dosen | Hanya mahasiswa yang menjadi peserta di mata kuliah yang diampu (selain itu 403). Isi rapor (hasil evaluasi, capaian CPMK, IK, dan **CPL per mata kuliah**) dibatasi ke mata kuliah tersebut; capaian CPL **gabungan** tidak dikirim karena memuat mata kuliah lain. Kaprodi & Dekan melihat rapor utuh termasuk `cpl_gabungan`. |
| Batas Admin Prodi | **Boleh melihat semua data** prodinya (kurikulum, MK, mahasiswa, peserta, nilai, hasil kalkulasi per MK). **Tidak boleh** melihat analitik capaian: dashboard CPL/IK/CPMK, tren, rapor capaian mahasiswa. |
| CPL, IK, versi kurikulum (tulis) | Admin Prodi. Threshold CPL: Admin Prodi & Kaprodi. |
| Mata kuliah, pengampu (tulis) | Admin Prodi. |
| CPMK & pemetaan CPMK→IK (tulis) | Admin Prodi, Kaprodi, Dosen (Dosen: hanya MK yang diampu, termasuk bobot CPMK dan hapus CPMK; lihat R17). UI: Admin Prodi di Kurikulum OBE, Dosen di Mata Kuliah Saya & CPMK Saya. |
| Jenis evaluasi | Admin Prodi, Kaprodi. Bentuk penilaian: Admin Prodi. |
| Bobot bentuk penilaian per MK & matriks IK | Admin Prodi, Dosen (MK diampu). |
| Nilai, kalkulasi | Admin Prodi, Dosen (MK diampu). Finalisasi: Admin Prodi, Kaprodi, Dosen. Unlock: Admin Prodi, Kaprodi. |
| RPS, narasi, laporan (buat/edit/submit) | Admin Prodi, Dosen. |
| Validasi laporan | Lihat: Kaprodi, Dekan. Approve/Reject: **Kaprodi saja**. |
| Akun pengguna | Super Admin → Admin Prodi & Dekan. Admin Prodi → Dosen & Kaprodi di prodinya. |
| Fakultas, Prodi (tulis) | Super Admin. |

---

## 5. Framework OBE yang Diimplementasikan

### 5.1 Hierarki

```
Versi Kurikulum (per prodi, draft/published)
 ├── CPL  (Capaian Pembelajaran Lulusan) — kode, deskripsi, threshold_capaian (default 70)
 │    └── IK (Indikator Kinerja) — kode, deskripsi, urutan
 └── Mata Kuliah — kode, nama, SKS, semester (Ganjil/Genap), tahun ajaran
      ├── Dosen Pengampu (koordinator/anggota)
      ├── CPMK — kode, deskripsi, level taksonomi (C1–C6), bobot (%)
      │    └── Pemetaan CPMK → IK dengan bobot (Σ bobot IK = bobot CPMK)
      └── Bentuk Penilaian MK — bobot (%) per bentuk
           └── Matriks Bentuk Penilaian × IK (bobot sel)
```

Master evaluasi per prodi: **Jenis Evaluasi** (mis. Tugas, Ujian, Proyek; opsional berbobot) → **Bentuk Penilaian** (mis. Kuis 1, UTS, UAS).

### 5.2 Aturan Kesiapan Dinilai (`cek_siap_dinilai`)

Sebuah mata kuliah baru bisa diinput nilainya dan dikalkulasi jika:

1. Total bobot CPMK = **100%**.
2. Setiap CPMK berbobot > 0 punya pemetaan IK, dan Σ bobot IK = bobot CPMK.
3. Total bobot bentuk penilaian mata kuliah = **100%**.
4. Jumlah tiap baris matriks (bentuk penilaian) = bobot bentuk itu.
5. Jumlah tiap kolom IK di matriks = total bobot IK itu pada pemetaan CPMK.
6. Matriks hanya berisi IK yang dipetakan ke CPMK mata kuliah tersebut.
7. Jika prodi mengatur bobot Jenis Evaluasi, totalnya = 100%.

Pelanggaran ditampilkan lewat `POST /kalkulasi/validasi-bobot`.

---

## 6. Alur Sistem End-to-End

### 6.1 Gambaran Besar

```
Super Admin ──► Fakultas, Prodi, akun Admin Prodi & Dekan
                     │
Admin Prodi ──► akun Dosen & Kaprodi ──► Kurikulum (versi, CPL, IK) ──► Mata Kuliah + Pengampu
                ──► CPMK + pemetaan IK ──► Jenis Evaluasi & Bentuk Penilaian ──► Data Mahasiswa ──► Peserta
                     │
Dosen ──► Peserta MK ──► atur bobot Bentuk Penilaian & matriks IK ──► validasi bobot
       ──► input nilai ──► kalkulasi ──► Analitik per MK ──► Generate RPS / Laporan ──► Submit
                     │
Kaprodi ──► Ikhtisar & Analitik prodi (drill-down, tren) ──► Validasi laporan (approve / kembalikan)
                     │
Dekan ──► pilih prodi ──► Ikhtisar & Analitik (view-only) ──► pantau laporan
```

### 6.2 Admin Prodi — Menyiapkan Kurikulum

```
1. Login → Ikhtisar "Kesiapan Konfigurasi Kurikulum" (checklist: versi published,
   CPL ber-IK, MK ber-CPMK, MK ber-pengampu). Tidak ada angka capaian.
2. Manajemen Pengguna → buat akun Dosen & Kaprodi.
3. Kurikulum OBE › CPL → buat versi kurikulum (versi, deskripsi, tahun) → tambah CPL
   (kode, deskripsi, threshold) → kelola IK per CPL.
4. Kurikulum OBE › Mata Kuliah → tambah MK + tetapkan dosen pengampu (koordinator/anggota).
5. Kurikulum OBE › CPMK → per MK: tambah CPMK (bobot, level taksonomi) → petakan ke IK dengan bobot.
6. Kurikulum OBE › Pemetaan IK → tinjau sebaran IK ke mata kuliah.
7. Kurikulum OBE › Jenis Evaluasi & Bentuk Penilaian → susun master evaluasi prodi.
8. Data Mahasiswa → input mahasiswa (angkatan diturunkan dari NIM bila kosong).
9. Peserta Kuliah → daftarkan mahasiswa ke MK.
10. Publish versi kurikulum.
```

### 6.3 Dosen — Penilaian Sampai Laporan

```
1. Login → Ikhtisar: pilih MK yang diampu → ringkasan CPMK & IK MK itu.
2. Peserta Kuliah → cek/tambah peserta MK yang diampu.
3. Penilaian → pilih MK:
   a. Atur komponen: pilih bentuk penilaian + bobot (total 100%),
      lalu isi matriks bobot ke IK.
   b. Validasi bobot → perbaiki jika ada pelanggaran.
   c. Input nilai (0–100) per mahasiswa × bentuk penilaian × IK.
   d. Jalankan kalkulasi → tab Hasil: nilai akhir, huruf, capaian CPMK/IK.
4. Analitik OBE → analisis per MK diampu (CPMK & IK breakdown).
5. Laporan Saya → Generate RPS (opsional) lalu edit/unduh/hapus drafnya.
   Buat Laporan Baru → Generate Narasi dengan AI (dari data capaian riil),
   sesuaikan isinya, simpan sebagai draf, lalu Submit ke Kaprodi.
6. Jika dikembalikan: baca catatan Kaprodi, revisi, submit ulang.
```

### 6.4 Kaprodi — Memantau & Memvalidasi

```
1. Login → Ikhtisar: rata-rata capaian CPL prodi, jumlah mahasiswa dievaluasi,
   MK aktif, laporan menunggu, bar chart CPL vs target, kartu CPL dengan tren.
2. Klik kartu CPL → Analitik OBE: CPL → IK → mata kuliah pendukung.
3. Tab Tren → capaian CPL per angkatan, insight naik/turun, export CSV.
4. Kurikulum OBE (mode lihat) → boleh mengubah target (threshold) CPL.
5. Validasi Laporan → buka laporan → Setujui, atau Kembalikan dengan catatan.
```

### 6.5 Dekan — Pengawasan Fakultas

```
1. Login → pilih Program Studi di selector (wajib sebelum data tampil).
2. Ikhtisar & Analitik OBE prodi terpilih (view-only), termasuk tren.
3. Validasi Laporan → lihat laporan lintas prodi (tanpa tombol approve/reject).
4. Kurikulum OBE & Data Master → lihat struktur kurikulum prodi.
```

### 6.6 Siklus Status Laporan

```
draft ──(Dosen submit)──► submitted ──(Kaprodi setujui)──► approved
                              │
                              └──(Kaprodi kembalikan + remarks)──► rejected ──(Dosen revisi & submit)──► submitted
```

---

## 7. Spesifikasi Fitur

### Feature 1 — Login & RBAC · *Berjalan*

- Form email + password; pesan error generik "Email/password salah".
- JWT berisi `sub` (email), `role`, `program_studi_id`, `fakultas_id`. Masa berlaku dari `ACCESS_TOKEN_EXPIRE_MINUTES` (default 1440 menit).
- Redirect setelah login: Super Admin → `/super-admin/prodi`; role lain → `/dashboard`.
- Akun nonaktif tidak bisa login.
- **Belum:** lupa password, remember me, auto-logout karena idle.

### Feature 2 — Kurikulum OBE · *Berjalan* (Admin Prodi)

- **Versi kurikulum:** field `versi` (label), `deskripsi`, `tahun`; status `draft` → `published`. Satu prodi bisa punya banyak versi; MK dan CPL terikat ke satu versi.
- **CPL:** CRUD, kode unik dalam versi, `threshold_capaian` (default 70; Kaprodi juga boleh ubah).
- **IK:** CRUD di bawah CPL, kolom `urutan`.
- **Pemetaan IK:** tampilan sebaran IK ke mata kuliah melalui CPMK.
- Dosen, Kaprodi, Dekan melihat versi read-only di `/kurikulum` ("Mode Lihat").

### Feature 3 — Mata Kuliah & Pengampu · *Berjalan* (Admin Prodi)

- CRUD mata kuliah: kode (unik per versi kurikulum), nama, SKS, semester (Ganjil/Genap), tahun ajaran.
- Penugasan pengampu: satu koordinator + anggota; hanya user ber-role Dosen.
- Penugasan pengampu menentukan MK apa yang dilihat Dosen di seluruh aplikasi.

### Feature 4 — CPMK & Evaluasi Pembelajaran · *Berjalan* (Admin Prodi)

- CPMK per MK: kode, deskripsi, level taksonomi (C1–C6), bobot %. Peringatan bila total ≠ 100%.
- Pemetaan CPMK → IK dengan bobot per IK.
- Jenis Evaluasi (per prodi, opsional berbobot) dan Bentuk Penilaian (di bawah jenis evaluasi).

### Feature 5 — Manajemen Akun Pengguna · *Berjalan*

- **Admin Prodi** (`/pengaturan`): daftar, tambah, ubah, aktif/nonaktifkan, hapus akun **Dosen & Kaprodi** di prodinya. Prodi dikunci ke prodi Admin.
- **Super Admin** (`/super-admin/users`): kelola akun **Admin Prodi & Dekan** lintas prodi/fakultas.
- Field: nama, NIP, email (unik), password, role, prodi/fakultas, status aktif.
- **Belum:** auto-generate password & kirim email, bulk action.

### Feature 6 — Data Mahasiswa & Peserta Kuliah · *Berjalan*

- Data Mahasiswa (Admin Prodi): CRUD + batch, NIM unik per prodi, angkatan diturunkan dari NIM bila tidak diisi, status masuk (Reguler/Transfer).
- Peserta Kuliah (Admin Prodi; Dosen untuk MK diampu): daftarkan mahasiswa ke MK, kelas, batch, hapus.

### Feature 7 — Penilaian & Kalkulasi · *Berjalan* (Dosen)

- Atur bobot bentuk penilaian per MK (total 100%) dan matriks bobot ke IK.
- Validasi bobot sebelum input (lihat Bagian 5.2).
- Input nilai manual 0–100 per (peserta, bentuk penilaian, IK); edit & hapus.
- Kalkulasi per MK menghasilkan `hasil_evaluasi` (nilai akhir, huruf, status outcome), `cpmk_achievement`, `ik_achievement`, `cpl_achievement`.
- Tab Hasil menampilkan ringkasan nilai akhir, capaian CPMK & IK.
- **API ada, UI belum:** finalisasi per peserta & unlock (Kaprodi/Admin Prodi dengan alasan), skala nilai huruf per versi kurikulum.

### Feature 8 — Ikhtisar · *Berjalan*

| Role | Isi |
|---|---|
| Admin Prodi | Kurikulum aktif, jumlah CPL/IK, MK, CPMK, penugasan pengampu, **checklist kesiapan konfigurasi** dengan tautan ke halaman terkait. **Tidak** memanggil endpoint analitik. |
| Dosen | Pilih MK diampu → ringkasan capaian CPMK & IK MK tersebut. |
| Kaprodi | 4 metrik (capaian OBE rata-rata, mahasiswa dievaluasi, MK aktif, laporan menunggu), bar chart CPL vs target, kartu CPL + tren, konteks prodi, filter semester, export CSV, print. |
| Dekan | Sama seperti Kaprodi untuk prodi yang dipilih; badge "Mode Lihat". |

### Feature 9 — Analitik OBE · *Berjalan* (Dosen, Kaprodi, Dekan)

> **Admin Prodi tidak memiliki akses** (revisi R1). Menu tidak tampil, rute `/analisis` mengalihkan ke Ikhtisar, API membalas 403.

**Cakupan:** fitur dan tab **sama** untuk semua role yang berwenang; yang berbeda hanya cakupan datanya.

| Role | Cakupan | Sumber data |
|---|---|---|
| Kaprodi | **Pilih cakupan:** seluruh prodi (capaian CPL = gabungan berbobot lintas mata kuliah) **atau satu mata kuliah mana pun di prodinya** | `GET /analitik/prodi` (+ API drill-down & tren lama), atau `GET /analitik/mata-kuliah/{id}` |
| Dekan | Sama seperti Kaprodi, untuk prodi terpilih di fakultasnya | `GET /analitik/prodi?program_studi_id=` atau `GET /analitik/mata-kuliah/{id}` |
| Dosen | **Satu mata kuliah yang diampu** (pilih MK di atas tab); hanya CPL/IK yang diukur MK itu, capaian CPL dari MK itu saja | `GET /analitik/mata-kuliah/{id}` + ringkasan `GET /dashboard/{id}` |

Kaprodi/Dekan memilih cakupan lewat kartu **Cakupan Analisis** di atas tab (filter semester disembunyikan saat satu mata kuliah dipilih). Perbedaan isi pada cakupan mata kuliah (Dosen maupun Kaprodi/Dekan): tab **Tren** dihitung dari data yang sama (CPL/CPMK per angkatan), **Drill-Down** menelusuri CPL → IK → CPMK di dalam MK itu dan menampilkan semua CPMK, **Peta** menjadi *Peta CPMK × IK*, dan kartu temuan tentang cakupan kurikulum (CPL tanpa/hanya 1 MK, MK penahan) tidak ditampilkan. Perbandingan Angkatan, Tren, dan Simulator dapat dipilih pada level **CPL atau CPMK** di kedua cakupan.

**Tab** (filter semester berlaku pada cakupan prodi untuk semua tab kecuali Tren):

| Tab | Isi | Tujuan evaluasi |
|---|---|---|
| **Ringkasan Evaluasi** (default) | *Kartu temuan* otomatis (deterministik, bukan AI): CPL terendah + IK terlemahnya, penurunan/kenaikan antar dua angkatan terakhir, kesenjangan lebar (simpangan baku), CPMK dengan ketuntasan terendah, CPL tanpa/hanya 1 MK pendukung, MK yang menahan capaian suatu CPL, CPL belum punya data. *Papan prioritas*: CPL/IK/CPMK di bawah target, diurutkan dari yang paling jauh, dengan alasan dan tautan telusur; filter level; export CSV. | Menjawab "apa yang harus dievaluasi lebih dulu" |
| **Drill-Down CPL → IK → CPMK** | Level 1 CPL, Level 2 IK (persen), **Level 3 CPMK pendukung IK terpilih** lintas mata kuliah (capaian IK per MK + CPMK yang dipetakan beserta ketuntasannya), lalu rincian CPMK per mata kuliah. | Menemukan akar masalah sampai CPMK |
| **Perbandingan Angkatan** | Pilih ≥2 angkatan; metrik rata-rata atau % mahasiswa mencapai target; grafik batang per CPL dengan garis target; tabel selisih angkatan pertama → terakhir; **heatmap CPL × angkatan** (warna relatif terhadap target, klik kolom untuk ikut dibandingkan); export CSV. | Efektivitas perubahan kurikulum antar angkatan |
| **Tren Antar Angkatan** | Grafik garis tren CPL per angkatan, insight, tabel matriks, export CSV (fitur lama). | Arah perkembangan jangka panjang |
| **Simulator Threshold** | Threshold seragam atau digeser dari threshold tiap CPL; target ketuntasan; filter angkatan; status CPL saat ini vs simulasi; histogram sebaran nilai satu CPL. **Tidak mengubah data**; target resmi diubah di Kurikulum OBE. | Menguji dampak perubahan target sebelum diputuskan |
| **Peta Kurikulum** | Matriks MK × CPL: bobot kontribusi (Σ bobot pemetaan CPMK→IK) dan capaian CPL di MK itu; mode warna capaian/bobot; jumlah MK pendukung per CPL (tanda merah bila 0–1); klik sel untuk IK & CPMK di baliknya; export CSV. | Bahan revisi struktur kurikulum |

- Data agregat untuk tab baru berasal dari `GET /analitik/prodi` (Kaprodi: prodinya; Dekan: `program_studi_id` di fakultasnya). Tidak memuat nama/NIM mahasiswa; capaian per mahasiswa dikirim sebagai daftar angka per (CPL, angkatan) agar simulasi dihitung di browser.
- Target ketuntasan default: 70% mahasiswa mencapai threshold CPL. Ambang CPMK: 70%.
- Dari Ikhtisar, klik kartu CPL membuka `/analisis?cpl_id=...` langsung di tab Drill-Down.

### Feature 10 — Generate RPS (AI) · *Berjalan* (Dosen; butuh AI Service)

- Halaman Laporan Saya, tombol **Generate RPS**: pilih MK, isi topik (opsional) → `POST /rps/{mata_kuliah_id}/generate`.
- AI Service: RAG atas dokumen pedoman (ChromaDB) + Qwen → draf RPS 16 pertemuan, langsung tersimpan sebagai draf.
- Validasi aturan OBE (16 pertemuan, UTS minggu 8, UAS minggu 16, total bobot 100); retry otomatis maks. 2 kali.
- **Kelola draf RPS** (daftar "Draf RPS" per MK):
  - **Edit:** kode MK, tahun ajaran, semester, deskripsi, daftar CPL & CPMK, dan tabel pertemuan (tambah/hapus baris, total bobot ditampilkan) → `PUT /rps/{rps_id}`.
  - **Hapus** dengan konfirmasi → `DELETE /rps/{rps_id}`.
  - **Unduh Word** (`.doc`) dan **Cetak / PDF** (dialog cetak browser, pilih "Simpan sebagai PDF"). Dibuat di sisi browser.
  - Hanya Dosen pengampu MK tersebut (dan Admin Prodi di prodinya) yang bisa mengedit/menghapus.

### Feature 11 — Laporan Evaluasi & Validasi · *Berjalan* (butuh AI Service untuk narasi)

- Dosen menekan **Buat Laporan Baru** → form berisi semester dan **Isi Laporan Evaluasi**:
  - Tombol **Generate Narasi dengan AI** (`POST /narasi/generate/{matkul_id}`) menyusun narasi dari data capaian riil (ringkasan capaian, analisis CPL, faktor penyebab, rekomendasi intervensi, kesimpulan) dan mengisi kolom isi. Ditolak 422 bila mata kuliah belum dikalkulasi.
  - Tombol **Import dari File** mengambil isi laporan yang sudah ditulis dosen sendiri (Word `.docx` atau `.txt`, maks. 5 MB) ke kolom isi. Dibaca di browser; teks saja (format seperti tabel dan gambar tidak ikut). `.doc` lama dan PDF belum didukung.
  - Isi bisa diedit sebelum disimpan, atau ditulis manual tanpa AI.
  - Simpan → `POST /laporan/generate/{matkul_id}` dengan `konten` (dan `sumber_narasi_ids`) sebagai draf.
- Dosen dapat mengedit draf, lalu **Submit** ke Kaprodi.
- Kaprodi: daftar laporan prodi dengan filter status, detail, **Setujui** atau **Kembalikan** (wajib catatan).
- Dekan: daftar laporan lintas prodi di fakultas, filter prodi, view-only.
- Pemetaan error AI: knowledge base belum siap → 503, timeout → 504, kegagalan LLM → 502.

### Feature 12 — Data Master · *Berjalan* (semua role akademik, read-only)

**Konsep: Data Current vs Data Master.**

| | Data Current | Data Master (Arsip Kurikulum) |
|---|---|---|
| Halaman | Kurikulum OBE (kelola & mode lihat), tab Versi Kurikulum/CPL/IK/CPMK di Data Master | Data Master › **Arsip Kurikulum** |
| Isi | Data terbaru, termasuk hasil koreksi salah input | Snapshot data yang **fix dipakai** pada sebuah versi kurikulum atau semester |
| Kapan berubah | Setiap kali diedit | Hanya pada titik arsip resmi (di bawah); tidak pernah diubah atau dihapus |
| Sumber | Tabel asli | Tabel `arsip_kurikulum` |

**Titik arsip:**

| Jenis | Pemicu | Isi snapshot |
|---|---|---|
| Publish Kurikulum | Otomatis saat versi kurikulum **pertama kali** dipublish (publish ulang tidak membuat arsip baru) | Versi kurikulum, CPL + IK, mata kuliah + CPMK + pemetaan IK, jenis evaluasi + bentuk penilaian, skala nilai |
| Tutup Semester | Admin Prodi menekan **Arsipkan Semester** (pilih semester & tahun ajaran) setelah semester selesai; satu kali per semester | Mata kuliah semester itu: pengampu, CPMK + pemetaan IK, bobot bentuk penilaian + matriks IK |

- **Edit setelah publish diperbolehkan** (mis. memperbaiki salah ketik) dan hanya mengubah Data Current; arsip tetap berisi data saat dipublish.
- Snapshot menyimpan **kode** (bukan id), sehingga arsip tetap terbaca walau data aslinya kemudian dikoreksi atau dihapus.
- **Bandingkan arsip:** pilih arsip sejenis sebelumnya untuk melihat CPL/IK/MK/CPMK yang *ditambah*, *diubah* (kolom sebelum → sesudah), dan *dihapus*, dicocokkan berdasarkan kode. Ini menunjukkan perubahan karena pergantian kurikulum atau semester.
- **Akses:** semua role akademik melihat arsip prodinya (Dekan memilih prodi di fakultasnya). Hanya Admin Prodi yang bisa mengarsipkan semester. Super Admin ditolak.
- Versi kurikulum yang sudah dipublish sebelum fitur ini aktif belum punya arsip; mempublish ulang versi tersebut akan membuat arsip pertamanya.
- Tab Versi Kurikulum, CPL, IK, CPMK di Data Master tetap menampilkan data terbaru (pencarian, filter, peringatan total bobot CPMK ≠ 100%).

### Feature 13 — Panel Super Admin · *Berjalan*

- Daftar Fakultas (CRUD), Daftar Program Studi (CRUD, terikat fakultas), Manajemen Pengguna Lintas Prodi (akun Admin Prodi & Dekan).
- Tidak menampilkan isi kurikulum, nilai, atau laporan.
- **Belum:** statistik ringkas per prodi (jumlah CPL/MK/user aktif), antrean pengajuan onboarding dari landing page.

### Feature 14 — Export · *Sebagian*

| Sumber | Format | Status |
|---|---|---|
| Ikhtisar (CPL overview) | CSV | Berjalan |
| Analitik tren | CSV | Berjalan |
| Print halaman | Browser print | Berjalan |
| RPS | Word (.doc) & Cetak/PDF | Berjalan |
| Laporan evaluasi | PDF | Belum |
| Analitik per level | Excel | Belum |

### Feature 15 — Sinkronisasi SIAP UNDIP · *Belum*

- `POST /nilai/sync` hanya mencatat log berstatus `not_configured`; riwayat di `GET /nilai/sync-logs/{mk_id}`.
- Rencana tetap: satu kredensial institusional terenkripsi, preview → confirm, fallback ke input manual.

---

## 8. UI/UX & Navigasi per Role

Detail visual (token warna, tipografi, layout) ada di [`design/DESIGN.md`](design/DESIGN.md). PRD ini sumber kebenaran **fungsional**; DESIGN.md sumber kebenaran **visual**.

### 8.1 Sidebar per Role (sesuai implementasi)

| Role | Menu |
|---|---|
| Super Admin | Daftar Prodi · Daftar Fakultas · Manajemen Pengguna Lintas Prodi |
| Admin Prodi | Ikhtisar · Peserta Kuliah · Data Mahasiswa · **Data Master** (grup) · **Kurikulum OBE** (grup: CPL, Pemetaan IK, Mata Kuliah, CPMK, Jenis Evaluasi, Bentuk Penilaian) · Validasi Laporan · Manajemen Pengguna |
| Dosen | Ikhtisar · Peserta Kuliah · Penilaian · Analitik OBE · Data Master · Kurikulum OBE (Mode Lihat) · Laporan Saya |
| Kaprodi | Ikhtisar · Analitik OBE · Data Master · Kurikulum OBE (Mode Lihat) · Validasi Laporan |
| Dekan | Ikhtisar · Analitik OBE · Data Master · Kurikulum OBE (Mode Lihat) · Validasi Laporan (Mode Lihat) |

### 8.2 Prinsip

- Menu & tombol yang tidak berwenang **tidak dirender** (bukan sekadar disabled).
- Rute dilindungi `ProtectedRoute`; role tidak berwenang dialihkan ke `/dashboard` (atau `/super-admin` untuk Super Admin).
- Topbar: breadcrumb, pencarian (non-Super Admin), notifikasi, indikator role + kode prodi, tombol Keluar.
- Kartu profil prodi di sidebar; untuk Dekan menampilkan prodi yang sedang dipilih.

---

## 9. Arsitektur Sistem & Data

### 9.1 Arsitektur

```
Browser ──► Frontend (React 18 + Vite + Tailwind + Recharts)   :5173
               │ axios  /api/v1  (Bearer JWT)
               ▼
           Backend (FastAPI + SQLAlchemy + Alembic)             :8000 ──► PostgreSQL
               │ httpx
               ▼
           AI Service (FastAPI, paket sadewa_ai)                :8001 ──► ChromaDB + Qwen
```

- Frontend hanya memanggil Backend.
- Backend menghitung semua angka; AI Service menerima angka jadi dan menyusun narasi.

### 9.2 Entitas Utama

| Tabel | Kolom penting |
|---|---|
| `fakultas` | kode, nama |
| `program_studi` | kode, nama, fakultas_id |
| `users` | nama, email, nip, password_hash, role, is_active, program_studi_id, fakultas_id |
| `kurikulum_versions` | program_studi_id, version_label, deskripsi, tahun, status (draft/published), published_at |
| `skala_nilai` | kurikulum_version_id, huruf, batas_min |
| `cpl` | kurikulum_version_id, program_studi_id, kode, deskripsi, threshold_capaian |
| `ik` | cpl_id, kode, deskripsi, urutan |
| `mata_kuliah` | kurikulum_version_id, program_studi_id, kode, nama, sks, semester, tahun_ajaran |
| `pengampu_mata_kuliah` | mata_kuliah_id, user_id, is_koordinator |
| `cpmk` | mata_kuliah_id, kode, deskripsi, level_taksonomi, bobot |
| `cpmk_ik_map` | cpmk_id, ik_id, bobot |
| `jenis_evaluasi` | program_studi_id, nama, urutan, bobot |
| `bentuk_penilaian` | jenis_evaluasi_id, nama |
| `mk_bentuk_penilaian` | mata_kuliah_id, bentuk_penilaian_id, bobot, semester |
| `mk_bentuk_penilaian_ik_map` | mk_bentuk_penilaian_id, ik_id, bobot |
| `mahasiswa` | program_studi_id, nim, nama, angkatan, semester_aktif, status_masuk, is_active |
| `peserta_mata_kuliah` | mata_kuliah_id, mahasiswa_id, kelas |
| `nilai_bentuk_penilaian` | peserta_mata_kuliah_id, mk_bentuk_penilaian_id, ik_id, nilai, semester, source (manual/upload/siap) — unik per (peserta, bentuk, IK) |
| `hasil_evaluasi` | peserta_mata_kuliah_id, nilai_akhir, nilai_huruf, status_outcome, is_final, finalized_by, unlocked_by, alasan_buka |
| `cpmk_achievement` | peserta_mata_kuliah_id, cpmk_id, nilai, status_tercapai |
| `ik_achievement` | mahasiswa_id, ik_id, mata_kuliah_id, semester, nilai |
| `cpl_achievement` | mahasiswa_id, cpl_id, **mata_kuliah_id**, semester, angkatan, nilai (persen CPL di MK itu), **bobot_cp** — satu baris per (mahasiswa, CPL, mata kuliah); baris lama tanpa MK hanya cadangan |
| `range_nilai_cpl` | program_studi_id, nama, batas_bawah, batas_atas, warna |
| `rps` | mata_kuliah_id, tahun_ajaran, semester, status, konten (JSON), sumber_dokumen_rag |
| `narasi_evaluasi` | mata_kuliah_id, peserta_mata_kuliah_id, tipe, konten, status |
| `laporan_evaluasi` | mata_kuliah_id, dosen_id, semester, konten, status, submitted_at, validated_by, validated_at, remarks, version |
| `arsip_kurikulum` | program_studi_id, jenis (publish_kurikulum / tutup_semester), kurikulum_version_id, semester, tahun_ajaran, judul, ringkasan (JSON), data (JSON snapshot berbasis kode), dibuat_oleh, created_at |
| `siap_sync_logs` | mata_kuliah_id, semester, status, total_records, triggered_by |

---

## 10. Ringkasan API

Semua endpoint berprefiks `/api/v1`, memakai `Authorization: Bearer <token>` kecuali login/register. Dokumentasi interaktif: Swagger `/docs`.

| Grup | Endpoint utama |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/register` (Super Admin pertama), `GET /auth/me` |
| Fakultas, Prodi | `/fakultas`, `/prodi` — CRUD (tulis: Super Admin) |
| Pengguna | `/users` — CRUD (Super Admin, Admin Prodi) |
| Kurikulum | `GET/POST /kurikulum/versions`, `POST /{id}/publish`, `GET/POST /{id}/skala-nilai` |
| CPL, IK | `/cpl` (+ `PUT /{id}/threshold`), `/ik` |
| Mata kuliah | `/mata-kuliah` (+ `GET /saya`), `/pengampu-mata-kuliah`, `/peserta-mata-kuliah` (+ `/batch`) |
| CPMK | `/cpmk`, `GET/PUT /cpmk/{id}/map-ik` |
| Evaluasi | `/jenis-evaluasi`, `/bentuk-penilaian`, `/mk-bentuk-penilaian` (+ `PUT /{id}/map-ik`) |
| Mahasiswa | `/mahasiswa` (+ `/batch`) |
| Nilai | `POST /nilai/manual`, `GET /nilai/{mk_id}`, `PUT/DELETE /nilai/{id}`, `POST /nilai/sync`, `GET /nilai/sync-logs/{mk_id}` |
| Kalkulasi | `POST /kalkulasi/validasi-bobot`, `POST /kalkulasi/run/{matkul_id}`, `POST /kalkulasi/peserta/{id}/finalize`, `POST /kalkulasi/peserta/{id}/unlock`, `GET /kalkulasi/{matkul_id}`, `GET /kalkulasi/hasil/{id}` |
| Analitik *(Dosen, Kaprodi, Dekan)* | `GET /dashboard/cpl-overview`, `GET /dashboard/ik-breakdown/{cpl_id}`, `GET /dashboard/{matkul_id}`, `GET /trending/cpl-by-angkatan`, `GET /rapor/mahasiswa/{id}`, `GET /analitik/prodi` (Kaprodi & Dekan), `GET /analitik/mata-kuliah/{id}` (Dosen pengampu, Kaprodi, Dekan) |
| Range nilai CPL | `GET/POST /prodi/{prodi_id}/range-nilai-cpl` |
| Arsip Kurikulum (Data Master) | `GET /arsip` (filter `jenis`, `program_studi_id` untuk Dekan), `GET /arsip/{id}`, `POST /arsip/semester` (Admin Prodi). Arsip publish dibuat otomatis oleh `POST /kurikulum/versions/{id}/publish` |
| Dokumen AI | `POST /rps/{mata_kuliah_id}/generate`, `GET /rps/{mata_kuliah_id}`, `PUT /rps/{rps_id}`, `DELETE /rps/{rps_id}`, `/narasi/*`, `/laporan/*` (generate, import-narasi, saya, update, submit), `/dokumen` |
| Validasi | `GET /validasi/laporan`, `GET /validasi/laporan/{id}`, `POST /validasi/laporan/{id}/approve`, `POST /validasi/laporan/{id}/reject` |
| Monitoring | `GET /health/ai` (di luar `/api/v1`) |

---

## 11. Metodologi Kalkulasi

Implementasi: `backend/app/services/calculation/` (formula SIMAK-NG). Semua operasi memakai `Decimal`, pembulatan `ROUND_HALF_UP` 2 desimal.

```
Poin sel        = bobot_sel × nilai / 100                     (per bentuk penilaian × IK)
Poin IK         = Σ poin sel IK itu lintas bentuk penilaian
Poin CPL        = Σ poin IK milik CPL itu pada mata kuliah tersebut
bobot_cp        = Σ bobot IK (pada pemetaan CPMK) milik CPL itu pada mata kuliah tersebut
Persen CPL      = poin_cpl / bobot_cp × 100                   (per mata kuliah; tidak disimpan jika bobot_cp = 0)
CPL gabungan    = Σ(persen_cpl_mk × bobot_cp_mk) / Σ bobot_cp_mk   (lintas mata kuliah, per mahasiswa)
Nilai akhir     = Σ poin sel mentah (belum dibulatkan), dibulatkan sekali di akhir
Huruf mutu      = huruf dengan batas_min terbesar yang ≤ nilai akhir (skala per versi kurikulum)
Persen IK       = poin IK / poin IK maksimal × 100            (poin maksimal = jumlah kolom IK di matriks penilaian MK)
Capaian CPMK    = Σ(persen IK × bobot pemetaan) / Σ bobot pemetaan   (rata-rata persen IK pendukung, 0–100)
```

**Contoh.** Bentuk "UTS" berbobot 30 dengan matriks IK-1.1 = 20 dan IK-1.2 = 10. Nilai mahasiswa UTS untuk IK-1.1 = 80 → poin sel = 20 × 80 / 100 = 16,00.

**Penyimpanan & penggabungan CPL.** Kalkulasi sebuah mata kuliah menyimpan capaian CPL per (mahasiswa, CPL, mata kuliah) beserta `bobot_cp`, jadi kalkulasi satu mata kuliah tidak menimpa mata kuliah lain. Capaian CPL mahasiswa adalah gabungan berbobot bobot IK (`services/calculation/cpl_aggregate.py`). Contoh: MK-1 80% dengan bobot IK 30 dan MK-2 40% dengan bobot IK 10 → (80×30 + 40×10) / 40 = **70,00** (bukan rata-rata biasa 60).

| Pemakai | Nilai CPL yang dipakai |
|---|---|
| Dashboard Kaprodi/Dekan (`cpl-overview`) | Gabungan per mahasiswa, lalu dirata-rata antar mahasiswa |
| Trending per angkatan | Gabungan per mahasiswa, lalu dirata-rata per angkatan |
| Rapor — Kaprodi/Dekan | Per mata kuliah + gabungan |
| Rapor — Dosen | Per mata kuliah yang diampu saja |
| Narasi/laporan evaluasi AI | Capaian CPL pada mata kuliah yang dilaporkan |

**Status tercapai** dibandingkan dengan `threshold_capaian` CPL (default 70). Dashboard menampilkan rata-rata capaian dan persentase mahasiswa yang mencapai threshold.

---

## 12. Non-Functional Requirements

| Requirement | Target | Implementasi / Catatan |
|---|---|---|
| Keamanan | JWT, RBAC, hash password | Guard per endpoint (`require_roles`, `get_academic_scope`); scope dari token |
| Multi-tenancy | Isolasi ketat antar prodi | Filter `program_studi_id` / `fakultas_id` di backend |
| Akurasi kalkulasi | Deterministik, teraudit | `Decimal` + `ROUND_HALF_UP`; validasi bobot sebelum hitung |
| AI tidak mengarang angka | Angka dari DB | Backend kirim capaian riil; tolak 422 jika belum ada kalkulasi |
| Ketersediaan AI | Gagal dengan jelas | Timeout eksplisit; 502/503/504 dengan pesan; UI tetap bisa manual |
| Performa | Halaman < 3 s, API < 1 s | Hindari N+1 di dashboard (agregasi di DB) |
| Skala | 5–9 prodi (≈250 user, ≈20.000 baris nilai/semester) | Database relasional standar |
| Browser | Chrome, Firefox, Edge terbaru | Desktop-first |
| Aksesibilitas | WCAG 2.1 AA | Label form, `aria-label`, focus ring |
| UX gagal | Shell tetap tampil | Error boundary per halaman, toast, banner error + "Coba Lagi" |

---

## 13. Gap yang Diketahui & Backlog

| ID | Gap | Dampak | Usulan |
|---|---|---|---|
| G1 | Sinkronisasi SIAP UNDIP belum ada | Nilai harus diinput manual | Tunggu akses API; desain preview → confirm sudah ada di v2.1 |
| G2 | Upload nilai CSV/Excel belum ada | Input massal lambat | Tambah endpoint upload + preview validasi |
| G3 | Menu "Validasi Laporan" tampil untuk Admin Prodi, tetapi halaman tidak memuat data (API validasi hanya Kaprodi/Dekan) | Halaman kosong untuk Admin Prodi | Putuskan: hapus menu dari Admin Prodi, atau beri tampilan monitoring status laporan |
| G4 | ~~Dosen bisa menulis CPMK lewat API, tetapi UI CPMK hanya untuk Admin Prodi~~ | **Selesai** (R17) | Dosen pengampu mengelola CPMK & pemetaan IK lewat UI sendiri |
| G5 | Finalisasi/unlock hasil, skala nilai huruf, range nilai CPL, rapor mahasiswa: API ada, UI belum | Fitur tidak terpakai | Tambahkan UI atau tandai ditunda |
| G6 | Form versi kurikulum & Data Master di frontend masih memakai field `semester` yang sudah dihapus dari backend | Label "(undefined)" di dropdown | Ganti ke `tahun` / `deskripsi` |
| G7 | ~~Rapor mahasiswa bisa diakses Admin Prodi~~ | — | **Selesai (R13):** rapor termasuk Analitik OBE, Admin Prodi ditolak 403 |
| G8 | Lupa password, auto-logout idle, email kredensial belum ada | Operasional akun manual | Backlog |
| G9 | Export PDF/Excel berformat belum ada | Laporan akreditasi perlu disusun manual | Backlog |
| G10 | Rantai migrasi Alembic perlu dirapikan; backend juga memakai `create_all` + `auto_sync_schema` | Risiko skema berbeda antar lingkungan. *(Sebagian diperbaiki: `auto_sync_schema` kini satu transaksi per perintah, sehingga satu perintah gagal tidak lagi membatalkan semua perubahan skema.)* | Satukan ke Alembic |
| G11 | ~~Capaian CPL tertimpa oleh kalkulasi mata kuliah terakhir~~ | — | **Selesai (R14):** disimpan per mata kuliah, digabung berbobot bobot IK. Data lama tetap dipakai sebagai cadangan; jalankan ulang kalkulasi tiap mata kuliah agar semua capaian memakai format baru |
| G12 | ~~Data `ik_achievement`/`cpmk_achievement`/`cpl_achievement` format lama di database pengembangan~~ | — | **Selesai:** database diisi ulang dengan `python -m app.core.seed_demo --reset` (semua capaian dihitung mesin terbaru). Database produksi yang sudah berisi data perlu kalkulasi ulang per mata kuliah |

---

## 14. Success Metrics

| Metrik | Target |
|---|---|
| Kelengkapan fitur | Semua fitur berstatus *Berjalan*, gap G1–G11 diputuskan (G7 & G11 selesai) |
| Isolasi data | 0 kebocoran lintas prodi pada uji akses (test backend RBAC lulus) |
| Akurasi | Hasil kalkulasi cocok dengan perhitungan manual SIMAK-NG |
| Error handling | Pesan ramah pengguna di semua kegagalan API/AI |
| Usability | SUS ≥ 70 |
| Performa | Dashboard < 3 s |
