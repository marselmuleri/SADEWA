# PRD — SADEWA

**Sistem Analisis Data Evaluasi Wawasan Akademik**
**Frontend — React.js Web Application**

| | |
|---|---|
| **Version** | 2.1 (Multi-Tenancy Update) |
| **Date** | September 2026 |
| **Status** | Ready for Development |
| **Author** | Claude (with Marsel Muleri) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview & Strategy](#2-product-overview--strategy)
3. [Multi-Tenancy & Onboarding Prodi](#3-multi-tenancy--onboarding-prodi)
4. [OBE Framework (3-Level Hierarchy)](#4-obe-framework-3-level-hierarchy)
5. [User Personas & Journeys](#5-user-personas--journeys)
6. [Feature Specifications (12 Fitur)](#6-feature-specifications-12-fitur)
7. [UI/UX Design System](#7-uiux-design-system)
8. [Data Architecture & API Contracts](#8-data-architecture--api-contracts)
9. [Calculation Methodology](#9-calculation-methodology)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Success Metrics](#11-success-metrics)

---

## 1. Executive Summary

SADEWA adalah **sistem web generic/template** yang dapat diadopsi oleh **berbagai program studi di universitas** untuk mengotomatisasi evaluasi Outcome-Based Education (OBE) dan menghasilkan dokumen akademik.

### Key Innovation

- **Multi-Tenant Architecture** — satu aplikasi, satu database, dipakai banyak prodi sekaligus dengan data yang terisolasi ketat per prodi
- **3-Level Hierarchy Management** — CPL → IK → CPMK (bukan 2-level)
- **Trending Analysis** — year-over-year comparison of CPL achievement
- **Flexible Hierarchy** — setiap prodi bisa customize CPL, IK, CPMK sesuai kebutuhan, sepenuhnya independen dari prodi lain
- **Editable Everything** — CPL, IK, CPMK, bobot, pemetaan; semua bisa di-edit anytime

### MVP Scope — 12 Fitur

| No | Fitur |
|---|---|
| 1 | Login & RBAC (5 roles: Super Admin, Admin Prodi, Dosen, Kaprodi, Dekan) |
| 2 | Setup Kurikulum OBE (CPL, IK, CPMK, pemetaan) |
| 3 | Manajemen Akun Pengguna |
| 4 | Sinkronisasi SIAP UNDIP (preview & confirm) |
| 5 | Manual Input Fallback (bulk upload + one-by-one) |
| 6 | Dashboard Analitik 3-Level (CPL → IK → CPMK drill-down) |
| 7 | Trending Analysis (by angkatan) |
| 8 | Generate RPS (AI-assisted) |
| 9 | Generate Laporan Evaluasi (AI-drafted, editable) |
| 10 | Validasi Laporan (Kaprodi/Dekan approval) |
| 11 | Export & Printing (Excel, PDF) |
| 12 | Panel Super Admin — Provisioning & Manajemen Prodi *(baru)* |

> Lihat [Section 3](#3-multi-tenancy--onboarding-prodi) untuk penjelasan lengkap arsitektur multi-tenant dan alur onboarding prodi baru.

---

## 2. Product Overview & Strategy

### 2.1 Problems Solved

| Problem | Current State | SADEWA Solution |
|---|---|---|
| Manual Excel spreadsheets | Dosen replikasi nilai 2x (SIAP → Excel) | Automated sync + manual fallback |
| CPL/CPMK tidak terverifikasi | Hitung manual, rawan kesalahan | Automatic calculation + audit trail |
| Laporan akreditasi sulit | Kompilasi data dari berbagai sumber | Integrated reporting + trending |
| Kurikulum tidak flexible | Hardcoded per universitas | Generic template + easy config |
| Tidak ada trend analysis | Year-by-year comparison manual | Automated trending feature |

### 2.2 Strategic Goals

```
GOAL 1: Standardize OBE Evaluation Across Universitas
├─ Enable any prodi to adopt SADEWA
├─ Reduce manual effort 80%
└─ Improve evaluation accuracy to 100%

GOAL 2: Generate Actionable Insights
├─ Identify performance gaps per CPL/IK/CPMK
├─ Track improvement trends (year-over-year)
└─ Support data-driven curriculum improvement

GOAL 3: Automate Document Generation
├─ AI-assisted RPS generation (dosen review)
├─ AI-drafted evaluation reports (editable)
└─ Akreditasi-ready documentation

GOAL 4: Scale to University Level
├─ Generic template (not hardcoded)
├─ Multi-faculty support
└─ Role-based access control
```

### 2.3 Scope — IN

- Multi-tenancy: isolasi data antar prodi, provisioning prodi baru oleh Super Admin
- Authentication (JWT, RBAC — 5 role termasuk Super Admin)
- OBE Setup (CPL, IK, CPMK, pemetaan, versioning) — dikelola mandiri oleh tiap prodi
- Data Input (manual + SIAP sync, kredensial institusional tunggal)
- 3-level Dashboard (CPL → IK → CPMK)
- Trending Analysis (by angkatan/tahun)
- Document Generation (RPS, Laporan)
- Validation Workflow (Kaprodi/Dekan)
- Export (Excel, PDF)

### 2.4 Scope — OUT

- Generate Soal / Bank Soal (removed for scope)
- Mobile App (desktop-first only)
- Real-time SIAP API (use preview + manual fallback)
- Predictive analytics
- Email notifications
- Multi-language support

---

## 3. Multi-Tenancy & Onboarding Prodi

> SADEWA adalah sistem **multi-tenant**: satu aplikasi & satu database dipakai oleh banyak program studi sekaligus, dengan data yang terisolasi ketat antar prodi. Bagian ini menjelaskan bagaimana isolasi itu bekerja dan bagaimana sebuah prodi baru mulai menggunakan SADEWA.

### 3.1 Model Isolasi Data

Setiap entitas utama (CPL, IK, CPMK, Mata Kuliah, User, Nilai, Laporan) ditandai dengan `program_id`. Prinsipnya:

- Isolasi terjadi **di level backend/API**, bukan disembunyikan lewat UI. Setiap request otomatis difilter berdasarkan `program_id` yang tertanam di JWT token milik user, bukan dari parameter yang dikirim client.
- Admin Prodi, Dosen, dan Kaprodi terkunci ke **satu** `program_id`.
- Dekan bisa mengawasi lebih dari satu prodi dalam fakultasnya, sehingga modelnya adalah "daftar `program_id` yang diizinkan", bukan satu nilai tunggal.
- Prodi Teknik Komputer secara teknis **tidak mungkin** mengakses data Teknik Lingkungan meskipun mencoba lewat manipulasi request, karena validasi scope dilakukan di server, bukan di frontend.

### 3.2 Role Baru: Super Admin

Super Admin adalah role tambahan di atas 4 role yang sudah ada (Admin Prodi, Dosen, Kaprodi, Dekan). Dipegang oleh tim pengelola SADEWA di tingkat universitas (bukan bagian dari struktur akademik prodi).

**Prinsip: akses operasional, bukan akses akademik.**

| Super Admin BISA | Super Admin TIDAK BISA (default) |
|---|---|
| Provisioning prodi baru | Melihat isi CPL / IK / CPMK / kurikulum prodi |
| Membuat & reset akun Admin Prodi pertama | Melihat nilai mahasiswa |
| Melihat daftar user & status aktif per prodi | Melihat isi Laporan Evaluasi |
| Melihat statistik ringkas (jumlah CPL, MK, user aktif) | Mengedit data akademik prodi manapun |
| Menonaktifkan / mengaktifkan akun | — |

Pembatasan ini disengaja: isi akademik (CPL, kurikulum, laporan evaluasi) adalah ranah kewenangan fakultas/prodi, bukan tim IT pusat. Fitur "impersonate/support access" (Super Admin masuk sementara sebagai Admin Prodi untuk keperluan debugging, dengan audit log) **tidak termasuk MVP** dan dipertimbangkan untuk versi berikutnya.

### 3.3 Alur Onboarding Prodi Baru

```
STEP 1: Prodi baru (mis. Teknik Lingkungan) mengajukan penggunaan SADEWA
        → via form kontak di landing page, atau pengajuan manual ke tim IT

STEP 2: Super Admin login ke Panel Super Admin
        → Klik "Tambah Prodi Baru"
        → Isi: Nama Prodi, Fakultas
        → Sistem generate program_id baru

STEP 3: Super Admin membuat SATU akun Admin Prodi pertama
        → Isi: NIP, Nama, Email
        → Sistem auto-generate password, kirim kredensial ke email

STEP 4: Super Admin selesai — tidak ikut campur lebih jauh
        → Admin Prodi Teknik Lingkungan login pertama kali
        → Masuk ke empty state "Kurikulum belum dikonfigurasi"
        → Admin Prodi mandiri mengisi sendiri: CPL, IK, CPMK,
          Mata Kuliah, bobot penilaian (lihat Feature 2, Section 6)

STEP 5: Prodi beroperasi independen
        → Semua kustomisasi selanjutnya dilakukan oleh prodi itu sendiri,
          tanpa perlu developer/Super Admin terlibat lagi
```

Dengan alur ini, tiap prodi (Teknik Komputer, Teknik Lingkungan, dst.) berjalan di atas **kode dan database yang sama**, tetapi punya struktur CPL/CPMK/kurikulum yang sepenuhnya berbeda dan independen satu sama lain — bukan instalasi terpisah per prodi.

### 3.4 Landing Page Publik (Sebelum Login)

Landing page **bukan** tempat kustomisasi — kustomisasi terjadi setelah login, di dalam scope prodi masing-masing (Feature 2). Landing page publik berperan sebagai:

- Penjelasan singkat tentang SADEWA, untuk prodi yang belum familiar
- Tombol Login
- Form "Ajukan Penggunaan SADEWA" — submission masuk sebagai request provisioning ke Super Admin (bukan self-register langsung), supaya identitas prodi bisa diverifikasi dulu sebelum akun dibuat

Setelah login, user langsung diarahkan ke dashboard yang sudah otomatis ter-scope ke prodinya — tidak ada halaman "pilih prodi", karena akun sudah terikat ke satu `program_id` sejak dibuat.

### 3.5 Integrasi SIAP UNDIP: Kredensial Tunggal Institusional

SIAP UNDIP adalah sistem akademik tingkat universitas, bukan sistem terpisah per prodi/fakultas. Karena itu, integrasi SADEWA ↔ SIAP menggunakan **satu kredensial institusional**, bukan kredensial berbeda per prodi:

- Kredensial (API key/service account) diurus **sekali** oleh tim pengelola SADEWA ke pihak SIAP UNDIP di awal proyek, bukan per onboarding prodi
- Disimpan **terenkripsi** di sisi backend (bukan plaintext di database) — kalau database bocor, kredensial SIAP tidak ikut bocor mentah
- Pemisahan data antar prodi saat sync (Feature 4) terjadi lewat **parameter query** (kode MK, NIM mahasiswa yang relevan), bukan lewat kredensial yang berbeda-beda
- Super Admin **tidak perlu** mengatur ulang kredensial ini setiap ada prodi baru — cukup sekali di setup awal sistem

---

## 4. OBE Framework (3-Level Hierarchy)

### 4.1 Why 3-Level? (NOT 2-Level)

```
❌ WRONG APPROACH (2-level):
   CPL → directly to CPMK
   (Loses operational clarity — no measurement bridge)

✅ CORRECT APPROACH (3-level):
   CPL (Macro) → IK (Operational) → CPMK (Course)

   CPL: "Mampu problem solving"
   ├─ IK-A.1: "Explain engineering principles" (measurable indicator)
   ├─ IK-A.2: "Formulate problems" (measurable indicator)
   └─ IK-A.3: "Analyze solutions" (measurable indicator)

   Each IK ← supported by multiple CPMK
   IK-A.1 supported by [CPMK-1, CPMK-3, CPMK-5]
```

### 4.2 Hierarchy Definition

#### Level 1 — CPL (Capaian Pembelajaran Lulusan)

| Aspek | Keterangan |
|---|---|
| Scope | Program Studi Level |
| Frequency | Setup once per prodi (can be edited) |
| Jumlah | 6–12 per prodi, bervariasi |
| Role | Admin Prodi |
| Action | Define, Edit, Delete CPL |

Contoh: `CPL-A: Problem Solving`, `CPL-B: Technical Skills`, `CPL-C: Communication`

#### Level 2 — IK (Indikator Kinerja)

| Aspek | Keterangan |
|---|---|
| Scope | Performance indicator untuk setiap CPL |
| Relationship | 1 CPL → 3–5 IK (typical) |
| Role | Admin Prodi |
| Action | Define IK per CPL, Edit, Delete |

> **Catatan:** IK adalah titik ukur dari CPL.

Contoh untuk CPL-A:

- `IK-A.1` — Menjelaskan prinsip rekayasa
- `IK-A.2` — Memformulasikan masalah
- `IK-A.3` — Memahami solusi alternatif
- `IK-A.4` — Menganalisis solusi
- `IK-A.5` — Memberikan justifikasi pemilihan

#### Level 3 — CPMK (Capaian Pembelajaran Mata Kuliah)

| Aspek | Keterangan |
|---|---|
| Scope | Course-level outcomes |
| Relationship | Setiap CPMK mendukung 1–3 IK |
| Role | Dosen (with Admin oversight) |
| Action | Define CPMK per course, Map to IK, Edit |

> **Catatan:** CPMK dievaluasi melalui nilai mahasiswa.

Contoh:

- `CPMK-1` — Implementasi Queue Data Structure → mendukung `[IK-A.1, IK-B.2]`
- `CPMK-2` — Analisis Kompleksitas Algoritma → mendukung `[IK-A.4, IK-A.5]`

### 4.3 Calculation Flow (Backend → Frontend Display)

```
STEP 1: Input
        └─ Dosen input nilai per komponen (Tugas, UTS, UAS, dst.)

STEP 2: Aggregate to CPMK level
        └─ Nilai_CPMK = weighted avg(nilai_tugas, UTS, UAS)
           Contoh: CPMK-1 = 82.5

STEP 3: Aggregate to IK level
        └─ Nilai_IK = avg(CPMK yang support IK itu)
           Contoh: IK-A.1 = avg(CPMK-1, CPMK-3, CPMK-5) = 80.2

STEP 4: Aggregate to CPL level
        └─ Nilai_CPL = avg(semua IK di CPL itu)
           Contoh: CPL-A = avg(IK-A.1, IK-A.2, ..., IK-A.5) = 81.4

STEP 5: Calculate achievement stats
        └─ % Mahasiswa mencapai target CPL (e.g. target 70%)
           Contoh: 78% dari 45 mahasiswa capai CPL-A ≥ 70%

STEP 6: Frontend Display
        └─ Show all levels with visualizations & drill-down
```

---

## 5. User Personas & Journeys

### 5.1 User Personas

#### Persona A — Admin Prodi

| | |
|---|---|
| **Goal** | Setup & maintain kurikulum OBE, kelola akun |
| **Volume** | ~1–2 per prodi |
| **Frequency** | Weekly (setup), Daily (monitoring) |
| **Key Features** | Kurikulum mgmt, user mgmt, dashboard monitoring |
| **Pain Points** | Complex kurikulum setup, butuh UI guidance yang jelas |

#### Persona B — Dosen Pengampu

| | |
|---|---|
| **Goal** | Input nilai, monitor CPL/CPMK, generate dokumen |
| **Volume** | ~20–30 per prodi |
| **Frequency** | Daily (during semester), Weekly (reviews) |
| **Key Features** | Data input, dashboard view, doc generation |
| **Pain Points** | Excel manual repetitif, beban dokumentasi |

#### Persona C — Kaprodi

| | |
|---|---|
| **Goal** | Monitor prodi performance, validate reports |
| **Volume** | 1 per prodi |
| **Frequency** | Weekly (review), End of semester (validation) |
| **Key Features** | Dashboard level prodi, validasi laporan |
| **Pain Points** | Agregasi data memakan waktu |

#### Persona D — Dekan

| | |
|---|---|
| **Goal** | Monitor all faculties, high-level insights |
| **Volume** | 1 per faculty |
| **Frequency** | Monthly (trending), Quarterly (reporting) |
| **Key Features** | Dashboard level universitas, trending analysis |
| **Pain Points** | Perbandingan lintas prodi sulit |

#### Persona E — Super Admin

| | |
|---|---|
| **Goal** | Provisioning prodi baru, kelola akun tingkat operasional |
| **Volume** | 1–2 (tim IT pengelola SADEWA di universitas) |
| **Frequency** | Jarang — saat ada prodi baru bergabung, atau isu akun |
| **Key Features** | Panel provisioning prodi, manajemen user lintas prodi (metadata saja) |
| **Pain Points** | Harus bisa membantu tanpa mengakses data akademik sensitif prodi |

> Lihat [Section 3](#3-multi-tenancy--onboarding-prodi) untuk detail lengkap peran dan batasan akses Super Admin.

### 5.2 User Journey — Admin Setup Kurikulum (Day 1)

```
Timeline: ~2 jam per prodi (first-time setup)

STEP 1: Login as Admin
        → See dashboard with "Setup Kurikulum" CTA

STEP 2: Navigate to "Manajemen Kurikulum OBE"
        → Empty state: "No kurikulum configured"
        → Option 1: "Import Template" (dari prodi lain)
        → Option 2: "Create from Scratch"
        → Choose Option 2

STEP 3: Define CPL
        → Add CPL-A, CPL-B, ... CPL-H (8 CPL)
        → Fields: Kode, Nama, Deskripsi
        → [SAVE] → Success "8 CPL berhasil disimpan"

STEP 4: Define IK per CPL
        → Click pada CPL-A → expand
        → Add IK-A.1, IK-A.2, ... IK-A.5 (5 IK)
        → Fields: Kode, Nama, Deskripsi
        → [SAVE] → Success "5 IK untuk CPL-A berhasil disimpan"
        → Repeat untuk CPL-B ... CPL-H
        → Total: ~35 IK

STEP 5: Define CPMK & Map to IK
        → Go to "Mata Kuliah" section
        → Add MK-1 (TK101), MK-2 (TK102), dst.
        → For each MK:
           - Add CPMK-1, CPMK-2, CPMK-3, ...
           - Map each CPMK to IK (multi-select)
             Example: CPMK-1 → [IK-A.1, IK-B.2]
           - Set bobot komponen (Tugas 20%, UTS 30%, UAS 50%)
           - [SAVE]

STEP 6: Define Bobot Penilaian (if needed)
        → For each MK, set default component weights
        → Atau biarkan kosong agar dosen customize per semester

STEP 7: Review & Publish
        → Summary: "12 Mata Kuliah, 35 IK, 60 CPMK"
        → [PUBLISH] → Kurikulum active untuk semester ini
        → Version: v1.0 (2024 Genap)

STEP 8: Admin ready for dosen to input nilai
        → Send email: "Kurikulum setup complete. Ready to input grades."
```

### 5.3 User Journey — Dosen Input Nilai (Mid-Semester → End)

```
Timeline: ~1 jam per MK (end of semester)

STEP 1: Login as Dosen
        → Dashboard: "Kelola Data Nilai" button

STEP 2: Select Mata Kuliah & Method
        → Dialog: "Bagaimana Anda ingin input nilai?"
        → Option A: "Tarik dari SIAP UNDIP" (1-click)
        → Option B: "Upload File CSV/Excel" (bulk)
        → Option C: "Input Manual" (one-by-one)
        → Choose Option A

STEP 3: Sync SIAP (Option A flow)
        → Click [TARIK DATA SIAP]
        → Sistem cek koneksi...
        → IF success:
           - Tampilkan preview tabel (10 rows + pagination)
           - "45 mahasiswa siap di-import"
           - [APPROVE] button
           → Data saved, "45 data berhasil diimport"
        → IF fail:
           - "Koneksi SIAP gagal. Gunakan input manual."
           - User pivot to Option B/C

STEP 4: Validasi & Mapping (Backend auto)
        → Sistem map nilai ke CPMK otomatis
        → Validasi format & range (0-100)
        → IF validation fail:
           - Show error: "Row 15: Nilai Tugas = 'A' (harus angka)"
           - Dosen fix & retry
        → IF success:
           - Simpan ke database
           - Trigger backend calculation

STEP 5: Monitor Dashboard
        → Dosen lihat CPL/CPMK achievement real-time
        → "MK TK101: CPL-A 82%, CPL-B 79%, CPL-C 85%"
        → Per mahasiswa view: individual progress

STEP 6: Generate Laporan (optional, end of semester)
        → Access "Generasi Dokumen Akademik"
        → Choose: "Laporan Evaluasi Mata Kuliah"
        → System generates draft (with AI assistance)
        → Dosen review & edit
        → [SUBMIT] → goes to Kaprodi for validation
```

### 5.4 User Journey — Kaprodi Review Trending & Validate

```
Timeline: ~30 menit per laporan (end of semester)

STEP 1: Login as Kaprodi
        → Dashboard shows: "Program Studi Level Analytics"
        → CPL trend visualization (last 3 years)
        → Example: "CPL-A trending up from 72% (2023) → 85% (2024)"

STEP 2: View Trending Analysis
        → Menu: "Analisis Tren Ketercapaian CPL"
        → Show:
           - Line chart: CPL achievement over time
           - Bar chart: Angkatan 2022 vs 2023 vs 2024
           - Table: Detailed numbers + gap analysis
        → Insights: "CPL-B underperforming, recommend kurikulum review"
        → [EXPORT] to Excel for reporting

STEP 3: Validate Laporan from Dosen
        → Menu: "Validasi Laporan Evaluasi"
        → List: "Laporan pending dari 12 dosen"
        → Click laporan → review content
        → See supporting data: CPL/CPMK tabel, student breakdown
        → Decision:
           → [SETUJUI] → status "Validated", archive
           → [KEMBALIKAN] → input remarks → notif ke dosen
        → Dosen menerima: "Laporan perlu revisi: [catatan]"

STEP 4: Generate Program Studi Report
        → Menu: "Laporan Program Studi"
        → AI generate: agregat dari semua laporan dosen
        → Content: CPL summary, IK breakdown, gap analysis
        → Kaprodi edit (WYSIWYG) + finalize
        → [SUBMIT] untuk Dekan

STEP 5: Export for Akreditasi
        → [EXPORT] → PDF/Excel
        → Ready untuk borang akreditasi
```

---

## 6. Feature Specifications (12 Fitur)

### Feature 1 — Login & Authentication (SADEWA01)

**User Story**

> **AS** a Dosen/Admin/Kaprodi/Dekan
> **I WANT TO** login dengan username & password
> **SO THAT** saya dapat mengakses sistem sesuai role saya

**Acceptance Criteria**

- [ ] Form: Username + Password (+ forgot password link)
- [ ] Validation: username required, password min 6 karakter
- [ ] Error handling: "Username atau password salah" (generic)
- [ ] JWT token: issued on success, valid 24 jam
- [ ] RBAC: redirect ke dashboard sesuai role
  - Admin Prodi → Kurikulum mgmt dashboard
  - Dosen → Data input dashboard
  - Kaprodi → Program studi analytics dashboard
  - Dekan → University-level dashboard
- [ ] Session timeout: auto logout setelah 30 menit idle
- [ ] Secure: HTTPS only, password hashed (backend)

**Wireframe**

```
┌─────────────────────────────────────┐
│   SADEWA Institutional              │
│   [Logo/Header]                     │
│                                     │
│   ┌───────────────────────────────┐ │
│   │ Username/Email:               │ │
│   │ [_______________________]     │ │
│   │                               │ │
│   │ Password:                     │ │
│   │ [_______________________]     │ │
│   │                               │ │
│   │ ☐ Remember me                 │ │
│   │                               │ │
│   │ [LOGIN BUTTON - Primary Navy] │ │
│   │                               │ │
│   │ Lupa password? [Link]         │ │
│   └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

### Feature 2 — Setup Kurikulum OBE (SADEWA11 + New)

**User Story**

> **AS** an Admin Prodi
> **I WANT TO** setup & configure kurikulum OBE (CPL, IK, CPMK, pemetaan)
> **SO THAT** sistem bisa menghitung CPL/CPMK dengan akurat

#### Section A — CPL Management

- [ ] CRUD: tambah, edit, hapus CPL
- [ ] Fields per CPL:
  - Kode (mis. A, B, C, D) — unique
  - Nama/Description (mis. "Problem Solving")
  - Full definition (text area)
- [ ] Validation: kode unique, required fields
- [ ] Display: table dengan kapasitas 50+ rows (pagination)
- [ ] Version tracking: tampilkan "Created by, Date, Last modified"

#### Section B — IK Management (per CPL)

- [ ] Nested di bawah masing-masing CPL
- [ ] CRUD: tambah, edit, hapus IK (under specific CPL)
- [ ] Fields per IK:
  - Kode (mis. A.1, A.2, A.3)
  - Nama/Description
  - Full indicator definition
- [ ] Validation: kode unique per CPL, required
- [ ] Ordering: drag-to-reorder IK dalam satu CPL
- [ ] Show count: badge "CPL-A: 5 IK"

#### Section C — Mata Kuliah & CPMK

- [ ] Define courses: MK-1 (TK101), MK-2 (TK102), dst.
- [ ] Fields per MK: Kode MK, Nama MK, Semester
- [ ] Per MK, define CPMK: Kode CPMK, Nama CPMK, Description
- [ ] Map CPMK ke IK — multi-select
  - Example: CPMK-1 → [IK-A.1, IK-B.2]
  - Tampilkan checkbox untuk semua IK
  - Validation: minimal 1 IK terpilih per CPMK
- [ ] Set bobot penilaian (per MK): Tugas, UTS, UAS, Others
  - Warning jika total ≠ 100% ("Sebaiknya total 100%, sekarang 95%")
  - **Tetap boleh disimpan** meski ≠ 100%

#### Section D — Versioning

- [ ] Setiap save → auto-version (v1.0, v1.1, v2.0)
- [ ] Version terhubung ke semester (v1.0 = 2024 Genap)
- [ ] Version history: "v1.0 (2024 Genap) → v1.1 (minor update)"
- [ ] Bisa revert, tetapi history tetap disimpan

**Wireframe**

```
┌─────────────────────────────────────────────────────┐
│ Manajemen Kurikulum OBE - Teknik Komputer           │
│ Version: v1.0 (2024 Genap) | [Version History]      │
├─────────────────────────────────────────────────────┤
│ TAB: CPL | IK | Mata Kuliah | Preview               │
│                                                     │
│ [TAB: CPL]                                          │
│ [+ TAMBAH CPL BARU]                                 │
│ ┌────────────────────────────────────────────────┐  │
│ │ Kode │ Nama         │ Deskripsi │ IK   │ Aksi │  │
│ ├──────┼──────────────┼───────────┼──────┼──────┤  │
│ │ A    │ Problem...   │ ...       │ 5 IK │ ✎ 🗑 │  │
│ │ B    │ Technical... │ ...       │ 4 IK │ ✎ 🗑 │  │
│ │ C    │ Communication│ ...       │ 5 IK │ ✎ 🗑 │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ EXPAND CPL-A (click):                               │
│ ┌────────────────────────────────────────────────┐  │
│ │ CPL-A: Problem Solving                         │  │
│ │ [+ TAMBAH IK BARU]                             │  │
│ │ Kode │ Nama        │ Deskripsi │ Aksi         │  │
│ ├──────┼─────────────┼───────────┼──────────────┤  │
│ │ A.1  │ Explain...  │ ...       │ ✎ 🗑         │  │
│ │ A.2  │ Formulate...│ ...       │ ✎ 🗑         │  │
│ │ A.3  │ Understand..│ ...       │ ✎ 🗑         │  │
│ │ A.4  │ Analyze...  │ ...       │ ✎ 🗑         │  │
│ │ A.5  │ Justify...  │ ...       │ ✎ 🗑         │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ [TAB: Mata Kuliah]                                  │
│ [+ TAMBAH MATA KULIAH]                              │
│ ┌────────────────────────────────────────────────┐  │
│ │ Kode │ Nama  │ Smt │ CPMK │ Bobot │ Aksi      │  │
│ ├──────┼───────┼─────┼──────┼───────┼───────────┤  │
│ │TK101 │Algo.. │ 1   │ 3    │ View  │ ✎ 🗑      │  │
│ │TK102 │Web..  │ 2   │ 2    │ View  │ ✎ 🗑      │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ EXPAND TK101 (click View):                          │
│ ┌────────────────────────────────────────────────┐  │
│ │ MK: TK101 - Algoritma & Data Structure         │  │
│ │ [+ TAMBAH CPMK]                                │  │
│ │                                                │  │
│ │ CPMK-1: Queue Implementation                   │  │
│ │ Map to IK: ☑ IK-A.1  ☑ IK-B.2  ☐ IK-C.1       │  │
│ │ [SAVE]                                         │  │
│ │ ──────────────────────────────────────────     │  │
│ │ Bobot Penilaian:                               │  │
│ │ Tugas:    [20]% ✓                              │  │
│ │ UTS:      [30]% ✓                              │  │
│ │ UAS:      [50]% ✓                              │  │
│ │         ──────────                             │  │
│ │ Total:    100% ✓ (Sesuai)                      │  │
│ │                                                │  │
│ │ [SAVE KURIKULUM]                               │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ [TAB: Preview] → Show full hierarchy                │
└─────────────────────────────────────────────────────┘
```

---

### Feature 3 — Manajemen Akun Pengguna (SADEWA10)

**User Story**

> **AS** an Admin Prodi
> **I WANT TO** manage user accounts (CRUD)
> **SO THAT** dosen/kaprodi/dekan dapat mengakses sistem

**Acceptance Criteria**

- [ ] List users: tabel dengan NIP, Nama, Email, Role, Status
- [ ] Create: form → NIP, Nama, Email, Role (dropdown), Status
  - Validation: NIP unique, format email valid
  - Auto-generate password (dikirim via email)
- [ ] Edit: ubah nama, role, status (aktif/non-aktif)
- [ ] Delete: soft delete (logical, bukan physical)
- [ ] Search/Filter: by role, by status, by name
- [ ] Bulk action: select multiple → change role/status
- [ ] Permission matrix: tampilkan hak akses tiap role

**Wireframe**

```
┌──────────────────────────────────────────────────────┐
│ Manajemen Pengguna Sistem SADEWA                     │
├──────────────────────────────────────────────────────┤
│ [+ TAMBAH PENGGUNA BARU]                             │
│ Search: [____________] [CLEAR]                       │
│ Filter: [All] [Dosen] [Admin] [Kaprodi] [Dekan]      │
│ ┌──────────────────────────────────────────────────┐ │
│ │☐ NIP │ Nama  │ Email │ Role   │ Status │ Aksi   │ │
│ ├──────┼───────┼───────┼────────┼────────┼────────┤ │
│ │☑ 1.. │ Andi  │a@...  │Dosen   │Aktif   │ ✎ 🗑   │ │
│ │☐ 2.. │ Budi  │b@...  │Admin   │Aktif   │ ✎ 🗑   │ │
│ │☐ 3.. │ Citra │c@...  │Kaprodi │Tidak   │ ✎ 🗑   │ │
│ └──────┴───────┴───────┴────────┴────────┴────────┘ │
│ [Bulk Select] → [Change Role] [Deactivate] [Delete]  │
│ Showing 1-10 of 45 users | [Prev] [1 2 3] [Next]     │
└──────────────────────────────────────────────────────┘
```

---

### Feature 4 — Sinkronisasi SIAP UNDIP (SADEWA02A)

**User Story**

> **AS** a Dosen
> **I WANT TO** sync nilai mahasiswa dari SIAP UNDIP dengan 1 klik
> **SO THAT** saya tidak perlu copy-paste manual

**Acceptance Criteria**

- [ ] Trigger: tombol "Tarik Data dari SIAP UNDIP"
- [ ] Process:
  1. Klik tombol
  2. Sistem cek koneksi ke SIAP API
  3. Jika sukses → preview tabel (10 rows + load more)
  4. Summary: "45 mahasiswa siap di-import"
  5. Tombol [APPROVE IMPORT]
  6. Simpan ke database + trigger calculation
- [ ] Error handling: "Koneksi SIAP gagal" → sarankan input manual
- [ ] Preview menampilkan: NIM, Nama, Nilai per komponen
- [ ] Auto-validation: format & range (0–100)
- [ ] Success message: "45 records berhasil disinkronisasi"

**Wireframe**

```
┌────────────────────────────────────────┐
│ Kelola Data Nilai - TK101              │
├────────────────────────────────────────┤
│ Semester: [2024 Genap]                 │
│ Mata Kuliah: [TK101 - Algoritma]       │
│                                        │
│ Pilih metode pengumpulan data:         │
│ ○ Tarik dari SIAP UNDIP                │
│ ○ Upload File (CSV/Excel)              │
│ ○ Input Manual                         │
│                                        │
│ [LANJUT]                               │
└────────────────────────────────────────┘
       ↓ (jika SIAP dipilih)
┌────────────────────────────────────────┐
│ Sinkronisasi SIAP UNDIP                │
├────────────────────────────────────────┤
│ [🔄 TARIK DATA DARI SIAP]              │
│ Loading... Connecting to SIAP API...   │
└────────────────────────────────────────┘
       ↓ (success)
┌────────────────────────────────────────┐
│ Preview Data Ter-pull                  │
├────────────────────────────────────────┤
│ Total: 45 mahasiswa siap di-import     │
│ ┌────────────────────────────────────┐ │
│ │ NIM  │ Nama  │Tugas│ UTS │ UAS    │ │
│ ├──────┼───────┼─────┼─────┼────────┤ │
│ │211.. │ Andi  │ 80  │ 75  │ 85     │ │
│ │211.. │ Budi  │ 70  │ 80  │ 75     │ │
│ │211.. │ Citra │ 85  │ 90  │ 88     │ │
│ │ ...  │ ...   │ ... │ ... │ ...    │ │
│ └────────────────────────────────────┘ │
│ [BATALKAN] [SETUJU & IMPORT]           │
└────────────────────────────────────────┘
       ↓
✅ "45 records berhasil disinkronisasi"
```

---

### Feature 5 — Manual Input Fallback: Upload & Form (SADEWA02B + 02C)

**User Story**

> **AS** a Dosen
> **I WANT TO** input nilai via file upload ATAU form manual
> **SO THAT** saya punya opsi ketika SIAP tidak tersedia

**Acceptance Criteria — Upload Option**

- [ ] Format: CSV, Excel (.xlsx)
- [ ] Validation (submit-time):
  - Cek kolom wajib ada (NIM, Nama, Tugas, UTS, UAS)
  - Cek tipe data (angka untuk nilai)
  - Cek range (0–100)
  - Cek duplikasi NIM
- [ ] Error display: daftar semua error per row
- [ ] Preview: 10 rows + pagination sebelum confirm
- [ ] Confirm dialog: "Import 45 records?"
- [ ] Success: "45 records berhasil diimport"
- [ ] Max file size: 5 MB

**Acceptance Criteria — Manual Form**

- [ ] Form: autocomplete mahasiswa + field nilai
- [ ] Fields: Tugas (0–100), UTS (0–100), UAS (0–100)
- [ ] Tombol "Tambah Mahasiswa Lain" (repeat)
- [ ] Tombol "Simpan Semua" (batch save)
- [ ] Confirm: "Simpan 3 records?"
- [ ] Success: "3 records berhasil disimpan"

**Wireframe — Upload**

```
┌────────────────────────────────────────┐
│ Input Nilai - Upload File              │
├────────────────────────────────────────┤
│ Pilih file CSV/Excel:                  │
│ [Choose File]  [grades_TK101.xlsx]     │
│                                        │
│ Format: NIM, Nama, Tugas, UTS, UAS     │
│ [Download Template]                    │
│                                        │
│ [PREVIEW HASIL] [RESET]                │
└────────────────────────────────────────┘
       ↓ (preview clicked)
┌────────────────────────────────────────┐
│ Preview Import                         │
├────────────────────────────────────────┤
│ ✅ Validasi sukses - 45 valid records  │
│ ⚠️  2 records punya warning:           │
│    - Row 15: Nilai UAS kosong          │
│    - Row 32: Format NIM tidak standar  │
│ ┌────────────────────────────────────┐ │
│ │ NIM  │ Nama │Tugas│UTS │UAS│Status │ │
│ ├──────┼──────┼─────┼────┼───┼───────┤ │
│ │211.. │ Andi │ 80  │ 75 │85 │ ✅    │ │
│ │211.. │ Budi │ 70  │ 80 │ - │ ⚠️    │ │
│ └────────────────────────────────────┘ │
│ [CANCEL] [CONFIRM & IMPORT]            │
└────────────────────────────────────────┘
```

**Wireframe — Manual Form**

```
┌────────────────────────────────────────┐
│ Input Nilai - Form Manual              │
├────────────────────────────────────────┤
│ Mahasiswa:                             │
│ [Autocomplete: Cari nama/NIM...]       │
│                                        │
│ Tugas (0-100):     [__]                │
│ UTS   (0-100):     [__]                │
│ UAS   (0-100):     [__]                │
│                                        │
│ [CANCEL] [SAVE & ADD MORE]             │
│          [SAVE & TUTUP]                │
│ ─────────────────────────────────────  │
│ Saved: 2 records                       │
│ ├─ Andi: 80, 75, 85                    │
│ └─ Budi: 70, 80, 75                    │
│                                        │
│ [SUBMIT ALL (2 records)]               │
└────────────────────────────────────────┘
```

---

### Feature 6 — Dashboard Analitik 3-Level (SADEWA05)

**User Story**

> **AS** a Dosen/Kaprodi/Dekan
> **I WANT TO** melihat dashboard dengan drill-down 3 level (CPL → IK → CPMK)
> **SO THAT** saya memahami ketercapaian CPL secara detail

**Acceptance Criteria — Level 1: CPL Overview**

- [ ] Card grid, tiap CPL menampilkan:
  - Nama CPL (mis. "Problem Solving")
  - Achievement % (mis. "81.5%")
  - Status badge: ✅ Achieved, ⚠️ Below Target, ❌ Critical
  - "X% dari Y students mencapai target 70%"
- [ ] Filter: by semester, by academic year
- [ ] Sort: by name, by achievement, by status
- [ ] Klik card → drill-down ke Level 2 (IK breakdown)

**Acceptance Criteria — Level 2: IK Breakdown**

- [ ] Tabel semua IK di bawah CPL terpilih
- [ ] Kolom: IK Code & Name, Achievement % (inline bar), jumlah mahasiswa mencapai target, status badge
- [ ] Klik row → drill-down ke Level 3 (CPMK detail)
- [ ] Breadcrumb: "CPL-A > IK-A.1 > ..." untuk navigasi

**Acceptance Criteria — Level 3: CPMK Detail**

- [ ] Card/section detail IK terpilih
- [ ] Daftar CPMK pendukung: nama CPMK, achievement %, mata kuliah pengampu
- [ ] Average: rata-rata CPMK pendukung = nilai IK
- [ ] Tombol back → kembali ke Level 2

**Acceptance Criteria — Actions (semua level)**

- [ ] [Export to Excel] → download tabel per level
- [ ] [Print] → print-friendly view
- [ ] [Trending] → compare by angkatan (Feature 7)

**Wireframe — Level 1**

```
┌────────────────────────────────────────────────────┐
│ Dashboard Analitik CPL/CPMK                        │
│ Semester: [2024 Genap ▼]  Year: [2024 ▼]           │
│ [Trending] [Export] [Print]                        │
├────────────────────────────────────────────────────┤
│ LEVEL 1: CPL OVERVIEW                              │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │ CPL-A       │ │ CPL-B       │ │ CPL-C       │    │
│ │ Problem     │ │ Technical   │ │ Design      │    │
│ │ Solving     │ │ Skills      │ │ Skills      │    │
│ │             │ │             │ │             │    │
│ │ 81.5% ✅    │ │ 68% ⚠️      │ │ 92% ✅      │    │
│ │             │ │             │ │             │    │
│ │ 78% dari 45 │ │ 65% dari 45 │ │ 89% dari 45 │    │
│ │ students    │ │ students    │ │ students    │    │
│ │[LIHAT DETAIL│ │[LIHAT DETAIL│ │[LIHAT DETAIL│    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │ CPL-D...    │ │ CPL-E...    │ │ CPL-F...    │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
└────────────────────────────────────────────────────┘
```

**Wireframe — Level 2 (drill-down)**

```
┌────────────────────────────────────────────────────┐
│ Dashboard Analitik CPL/CPMK                        │
│ [< Back] CPL-A: Problem Solving                    │
├────────────────────────────────────────────────────┤
│ LEVEL 2: IK BREAKDOWN                              │
│ Total CPL-A Achievement: 81.5% (avg of 5 IK)       │
│ ┌──────────────────────────────────────────────┐   │
│ │ IK     │ Nama      │ Achievement │ Students  │   │
│ ├────────┼───────────┼─────────────┼───────────┤   │
│ │ IK-A.1 │ Explain   │ 79.8% ████  │ 36/45 [>] │   │
│ │ IK-A.2 │ Formulate │ 83.2% █████ │ 37/45 [>] │   │
│ │ IK-A.3 │ Understand│ 80.1% ████  │ 35/45 [>] │   │
│ │ IK-A.4 │ Analyze   │ 82.4% █████ │ 38/45 [>] │   │
│ │ IK-A.5 │ Justify   │ 82.5% █████ │ 39/45 [>] │   │
│ └──────────────────────────────────────────────┘   │
│ [< Back] [> CPMK Detail for IK-A.1]                │
└────────────────────────────────────────────────────┘
```

---

### Feature 7 — Trending Analysis (by Angkatan)

> **Unique feature** — pembeda utama SADEWA.

**User Story**

> **AS** a Kaprodi/Dekan
> **I WANT TO** menganalisis tren ketercapaian CPL antar tahun (angkatan 2021 vs 2022 vs 2023 vs 2024)
> **SO THAT** saya bisa mengidentifikasi area perbaikan & mengukur efektivitas kurikulum

**Acceptance Criteria**

- [ ] Visualization: line chart (CPL achievement over time)
  - X-axis: Angkatan (2021, 2022, 2023, 2024)
  - Y-axis: % Achievement (0–100%)
  - Multi-line: tiap CPL satu garis
- [ ] Table view: detail numerik per CPL per angkatan
- [ ] Gap analysis: "CPL-B turun 5% dari 2023 → 2024"
- [ ] Insights: AI-generated summary
- [ ] Filter: by CPL, by rentang angkatan
- [ ] Export: Excel dengan data tren

**Wireframe**

```
┌────────────────────────────────────────────────────┐
│ Analisis Tren Ketercapaian CPL                     │
│ Filter: [CPL-A, CPL-B, CPL-C] [Angkatan: 2021-24]  │
│ [Export]                                           │
├────────────────────────────────────────────────────┤
│ LINE CHART: CPL Achievement Trends                 │
│                                                    │
│ 100% ┐                                             │
│      │          ╱─CPL-A (92%)                      │
│  85% ├─────╱───                                    │
│      │    ╱                                        │
│  70% ├──╱─────────CPL-B (68%, declining)           │
│      │ ╱                                           │
│  55% ├─────────────────────                        │
│   0% └─────────────────────────                    │
│      2021  2022  2023  2024                        │
│ ─────────────────────────────────────────────      │
│ TABLE VIEW: Detailed Numbers                       │
│ ┌──────────────────────────────────────────────┐   │
│ │ CPL   │ 2021 │ 2022 │ 2023 │ 2024 │ Trend   │   │
│ ├───────┼──────┼──────┼──────┼──────┼─────────┤   │
│ │ CPL-A │ 72%  │ 76%  │ 82%  │ 92%  │ ↑ +20%  │   │
│ │ CPL-B │ 68%  │ 71%  │ 72%  │ 68%  │ ↓ -4%   │   │
│ │ CPL-C │ 85%  │ 86%  │ 88%  │ 92%  │ ↑ +7%   │   │
│ └──────────────────────────────────────────────┘   │
│ INSIGHTS:                                          │
│ • CPL-A: Excellent trend, 20% improvement          │
│ • CPL-B: ⚠️ Declining, needs curriculum review     │
│ • CPL-C: Steady improvement                        │
└────────────────────────────────────────────────────┘
```

---

### Feature 8 — Generate RPS (SADEWA07)

**User Story**

> **AS** a Dosen
> **I WANT TO** membuat RPS (Rencana Pembelajaran Semester)
> **SO THAT** saya punya rencana pembelajaran yang terstruktur

**Acceptance Criteria**

- [ ] Form input (manual): Nama MK, Kode, Semester, SKS
- [ ] Target CPMK: auto-populate dari kurikulum
- [ ] Learning outcomes (text area)
- [ ] Teaching strategy (text area)
- [ ] Assessment methods (checkbox list)
- [ ] References (text area)
- [ ] AI Assist (opsional):
  - Klik [AI ASSIST] → generate saran
  - Modal: "AI suggestions berdasarkan CPMK + industry trends"
  - Dosen bisa copy-paste atau abaikan
- [ ] WYSIWYG Editor: bold, italic, lists, tables, real-time preview
- [ ] Save: simpan draft ke database (versioning)
- [ ] Export: PDF (print-ready)
- [ ] Metadata: created by, date, last edited

**Wireframe**

```
┌────────────────────────────────────────────────────┐
│ Generasi Dokumen Akademik - RPS                    │
├────────────────────────────────────────────────────┤
│ STEP 1: Form Input                                 │
│ ┌──────────────────────────────────────────────┐   │
│ │ Nama MK:   [Algoritma & Data Struktur]       │   │
│ │ Kode:      [TK101]                           │   │
│ │ Semester:  [1]                               │   │
│ │ SKS:       [3]                               │   │
│ │                                              │   │
│ │ Target CPMK (from kurikulum):                │   │
│ │ ☑ CPMK-1: Queue Implementation               │   │
│ │ ☑ CPMK-2: Stack Operations                   │   │
│ │ ☑ CPMK-3: Complexity Analysis                │   │
│ │                                              │   │
│ │ Learning Outcomes:                           │   │
│ │ [Text area multiline...]                     │   │
│ │                                              │   │
│ │ [PREVIEW] [AI ASSIST]                        │   │
│ └──────────────────────────────────────────────┘   │
│                                                    │
│ STEP 2: Preview & Edit (WYSIWYG)                   │
│ ┌──────────────────────────────────────────────┐   │
│ │ [B] [I] [U] [List] [Table] [Link]            │   │
│ │                                              │   │
│ │ # Rencana Pembelajaran Semester              │   │
│ │ [Editable content area - wysiwyg]            │   │
│ │                                              │   │
│ │ Mata Kuliah: Algoritma & Data Struktur       │   │
│ │ SKS: 3 | Semester: 1                         │   │
│ │                                              │   │
│ │ Capaian Pembelajaran Mata Kuliah:            │   │
│ │ Setelah menyelesaikan mata kuliah ini...     │   │
│ │                                              │   │
│ │ [CANCEL] [SAVE DRAFT] [EXPORT PDF]           │   │
│ └──────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

---

### Feature 9 — Generate Laporan Evaluasi (SADEWA06)

**User Story**

> **AS** a Dosen/Kaprodi
> **I WANT TO** generate laporan evaluasi dengan bantuan AI
> **SO THAT** saya punya laporan akademik untuk akreditasi

**Acceptance Criteria**

- [ ] Trigger: menu "Generasi Dokumen" → "Laporan Evaluasi"
- [ ] AI generate draft:
  - Sumber: data ketercapaian CPL/CPMK + template standar
  - Dari ChromaDB: dokumen akademik referensi universitas
  - Output: draft terstruktur, siap diedit di WYSIWYG
- [ ] WYSIWYG editor: edit konten di dalam sistem
- [ ] Preview: formatted report view
- [ ] Save: simpan draft (versioning)
- [ ] Submit: kirim ke Kaprodi untuk validasi
- [ ] Export: PDF

**Wireframe**

```
┌────────────────────────────────────────────────────┐
│ Generasi Dokumen Akademik - Laporan Evaluasi       │
├────────────────────────────────────────────────────┤
│ Mata Kuliah: [TK101 ▼]                             │
│ Semester:    [2024 Genap ▼]                        │
│                                                    │
│ [GENERATE LAPORAN DENGAN AI]                       │
│ Processing... Menganalisis data CPL/CPMK...        │
└────────────────────────────────────────────────────┘
       ↓ (AI draft generated)
┌────────────────────────────────────────────────────┐
│ Preview & Edit Laporan Evaluasi                    │
├────────────────────────────────────────────────────┤
│ [B] [I] [U] [List] [Table]                         │
│                                                    │
│ LAPORAN EVALUASI MATA KULIAH                       │
│ TK101: Algoritma & Data Struktur                   │
│ Semester Genap Tahun Akademik 2023/2024            │
│                                                    │
│ 1. Ringkasan Capaian Pembelajaran                  │
│    Mata kuliah ini bertujuan untuk... [editable]   │
│                                                    │
│ 2. Analisis Ketercapaian CPMK                      │
│    - CPMK-1: 82.5% (Baik)   [editable]             │
│    - CPMK-2: 79.8% (Cukup)  [editable]             │
│    - CPMK-3: 85.2% (Baik)   [editable]             │
│                                                    │
│ 3. Rekomendasi Perbaikan [editable]                │
│    Untuk meningkatkan ketercapaian CPMK...         │
│                                                    │
│ [CANCEL] [SAVE DRAFT] [SUBMIT FOR VALIDATION]      │
└────────────────────────────────────────────────────┘
```

---

### Feature 10 — Validasi Laporan (SADEWA06 — Kaprodi/Dekan)

**User Story**

> **AS** a Kaprodi/Dekan
> **I WANT TO** review & approve laporan evaluasi
> **SO THAT** kualitas laporan terjaga

**Acceptance Criteria**

- [ ] Menu: "Validasi Laporan Evaluasi"
- [ ] List pending: tabel berisi nama dosen, tanggal, status
- [ ] Open laporan: lihat konten + supporting data (tabel CPL/CPMK)
- [ ] Decision:
  - [SETUJUI] → status "Validated", diarsipkan
  - [KEMBALIKAN] → input remarks → notifikasi ke dosen "Needs Revision"
- [ ] Tracking: riwayat approval/rejection

**Wireframe**

```
┌────────────────────────────────────────────────────┐
│ Validasi Laporan Evaluasi                          │
├────────────────────────────────────────────────────┤
│ Status Filter: [All] [Pending] [Approved] [Rejected]│
│ ┌──────────────────────────────────────────────┐   │
│ │ Dosen │ MK    │ Submit     │ Status  │ Aksi  │   │
│ ├───────┼───────┼────────────┼─────────┼───────┤   │
│ │ Andi  │ TK101 │ 2024-06-15 │ Pending │[View] │   │
│ │ Budi  │ TK102 │ 2024-06-14 │ Pending │[View] │   │
│ │ Citra │ TK103 │ 2024-06-12 │ Approved│[View] │   │
│ └──────────────────────────────────────────────┘   │
│                                                    │
│ [VIEW DETAIL - laporan Andi]                       │
│ ┌──────────────────────────────────────────────┐   │
│ │ LAPORAN EVALUASI - TK101                     │   │
│ │ Oleh: Andi                                   │   │
│ │ Submitted: 2024-06-15                        │   │
│ │ [Content of laporan - formatted]             │   │
│ │ ─────────────────────────────────────────    │   │
│ │ Supporting Data: CPL/CPMK Achievement        │   │
│ │ ┌────────────────────────────────────────┐   │   │
│ │ │ CPL   │ Achievement │ Target │ Status │   │   │
│ │ ├───────┼─────────────┼────────┼────────┤   │   │
│ │ │ CPL-A │ 81.5%       │ 70%    │ ✅     │   │   │
│ │ │ CPL-B │ 68%         │ 70%    │ ⚠️     │   │   │
│ │ └────────────────────────────────────────┘   │   │
│ │ DECISION:                                    │   │
│ │ ○ Setujui                                    │   │
│ │ ○ Kembalikan dengan catatan:                 │   │
│ │   [Catatan: CPL-B perlu ditingkatkan...]     │   │
│ │ [CANCEL] [SUBMIT DECISION]                   │   │
│ └──────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

---

### Feature 11 — Export & Printing (Multi-format)

**User Story**

> **AS** a Dosen/Kaprodi
> **I WANT TO** export data & laporan ke Excel/PDF
> **SO THAT** saya bisa membagikan & mencetaknya

**Acceptance Criteria**

| Sumber | Format | Catatan |
|---|---|---|
| Dashboard | Excel | Per level drill-down (CPL, IK, CPMK), spreadsheet terstruktur |
| Laporan | PDF | Formatted, print-ready, dengan header, footer, logo |
| Rapor | Print / PDF | Per mahasiswa atau batch |
| Trending | Excel | Tabel + data tren |

---

### Feature 12 — Panel Super Admin: Provisioning & Manajemen Prodi

**User Story**

> **AS** a Super Admin
> **I WANT TO** mendaftarkan prodi baru dan membuat akun Admin Prodi pertamanya
> **SO THAT** prodi tersebut bisa mulai menggunakan SADEWA secara mandiri

**Acceptance Criteria**

- [ ] Dashboard daftar seluruh prodi: nama prodi, fakultas, tanggal onboard, jumlah user aktif, status ringkas (jumlah CPL/MK terisi — indikator apakah prodi sudah mulai setup atau belum)
- [ ] [+ TAMBAH PRODI BARU]: form Nama Prodi + Fakultas → sistem generate `program_id` baru
- [ ] Setelah prodi dibuat, wajib membuat **satu** akun Admin Prodi pertama (NIP, Nama, Email) → password auto-generate, dikirim ke email
- [ ] Klik satu prodi di daftar → tampilkan **metadata & user saja**:
  - Info prodi (nama, fakultas, tanggal onboard)
  - Daftar user di prodi itu (nama, role, status aktif/nonaktif)
  - Statistik ringkas non-sensitif (jumlah CPL, jumlah MK, jumlah user aktif)
- [ ] **Tidak** menampilkan isi CPL/IK/CPMK, nilai mahasiswa, atau isi Laporan Evaluasi — ini di luar kewenangan Super Admin (lihat Section 3.2)
- [ ] Aksi terhadap user: reset password, nonaktifkan/aktifkan akun
- [ ] Search/filter daftar prodi: by nama, by fakultas

**Wireframe**

```
┌────────────────────────────────────────────────────┐
│ Panel Super Admin - Daftar Prodi                   │
├────────────────────────────────────────────────────┤
│ [+ TAMBAH PRODI BARU]     Search: [____________]   │
│ ┌──────────────────────────────────────────────┐   │
│ │ Prodi      │ Fakultas │ Onboard   │ User │CPL│   │
│ ├────────────┼──────────┼───────────┼──────┼───┤   │
│ │Tek. Komputer│ Teknik  │2025-01-10 │  24  │ 8 │   │
│ │Tek. Lingkungan│Teknik │2025-08-02 │   3  │ 0 │   │
│ └──────────────────────────────────────────────┘   │
│                                                    │
│ [KLIK "Tek. Lingkungan"]                           │
│ ┌──────────────────────────────────────────────┐   │
│ │ Teknik Lingkungan — Fakultas Teknik            │  │
│ │ Onboard: 2025-08-02                            │  │
│ │ Statistik: 0 CPL · 0 MK · 3 user aktif         │  │
│ │                                                │  │
│ │ Daftar User:                                   │  │
│ │ Nama   │ Role        │ Status  │ Aksi         │  │
│ │ Rina   │ Admin Prodi │ Aktif   │ Reset · Nonaktifkan│
│ │ ...                                            │  │
│ │                                                │  │
│ │ ⓘ Isi CPL/kurikulum/laporan tidak ditampilkan  │  │
│ │   di sini — itu kewenangan Admin Prodi.        │  │
│ └──────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

---

## 7. UI/UX Design System

### 7.1 Design Tokens

```css
/* Colors */
--primary:   #1A3A6B; /* Navy  */
--secondary: #6D778E; /* Grey  */
--tertiary:  #F4A300; /* Orange */
--success:   #10B981; /* Green */
--error:     #EF4444; /* Red   */

/* Typography */
--font-headline: 'Public Sans', sans-serif; /* Bold 700 */
--font-body:     'Inter', sans-serif;       /* Regular 400 */
--font-label:    'Inter', sans-serif;       /* Medium 500 */

/* Spacing */
--spacing-base: 8px; /* 8px grid */
```

### 7.2 Component Library

Buttons (6 varian), Form Inputs, Cards, Tables, Modals, Navigation, Badges.

---

## 8. Data Architecture & API Contracts

### 8.1 Database Schema (Logical)

```javascript
// Program (Prodi) Master — NEW: fondasi multi-tenancy
{
  program_id: "TEKNIK_KOMPUTER",
  program_name: "Teknik Komputer",
  faculty_name: "Fakultas Teknik",
  onboarded_at,
  created_by: "SUPER_ADMIN_ID"
}

// User — diperbarui: setiap user terikat ke program_id
// (Dekan bisa punya lebih dari satu, via array program_ids)
{
  user_id: "D001",
  nip: "...",
  nama: "Andi",
  email: "andi@...",
  role: "ADMIN_PRODI" | "DOSEN" | "KAPRODI" | "DEKAN" | "SUPER_ADMIN",
  program_id: "TEKNIK_KOMPUTER",        // null untuk SUPER_ADMIN
  program_ids: ["TEKNIK_KOMPUTER", "TEKNIK_LINGKUNGAN"], // dipakai khusus role DEKAN
  status: "AKTIF" | "NONAKTIF",
  created_at
}

// CPL Master
{
  cpl_id: "CPL-A",
  program_id: "TEKNIK_KOMPUTER",
  cpl_name: "Problem Solving",
  description: "Mampu menyelesaikan masalah rekayasa...",
  version: "v1.0",
  created_at,
  updated_at
}

// IK Master (LEVEL BARU)
{
  ik_id: "IK-A.1",
  cpl_id: "CPL-A",              // Parent
  ik_name: "Menjelaskan prinsip rekayasa",
  description: "...",
  version: "v1.0",
  created_at,
  updated_at
}

// CPMK Master (dengan referensi IK)
{
  cpmk_id: "CPMK-1",
  mk_id: "TK101",
  cpmk_name: "Queue Implementation",
  supported_ik: ["IK-A.1", "IK-B.2"],   // Array of IK
  version: "v1.0",
  created_at,
  updated_at
}

// Mata Kuliah
{
  mk_id: "TK101",
  program_id: "TEKNIK_KOMPUTER",
  mk_name: "Algoritma & Data Structure",
  semester: 1,
  sks: 3,
  cpmk_ids: ["CPMK-1", "CPMK-2", "CPMK-3"],
  bobot_penilaian: {
    tugas: 20,
    uts: 30,
    uas: 50                     // Total 100 (sistem juga izinkan < 100)
  }
}

// Student Grades (per course)
{
  student_id: "21120123...",
  mk_id: "TK101",
  semester: "2024_GENAP",
  nilai_tugas: 80,
  nilai_uts: 75,
  nilai_uas: 85,
  nilai_akhir: 81.5             // (80*0.2 + 75*0.3 + 85*0.5)
}

// Aggregated Achievement (computed by backend)
{
  student_id: "21120123...",
  program_id: "TEKNIK_KOMPUTER",
  semester: "2024_GENAP",
  angkatan: 2024,
  ik_achievement: {
    "IK-A.1": 79.8,             // Avg CPMK pendukung IK ini
    "IK-A.2": 83.2
    // ...
  },
  cpl_achievement: {
    "CPL-A": 81.5,              // Avg semua IK di CPL-A
    "CPL-B": 79.0
    // ...
  }
}

// Laporan Evaluasi
{
  laporan_id: "LAP-2024-TK101-001",
  mk_id: "TK101",
  dosen_id: "D001",
  semester: "2024_GENAP",
  content: "... (WYSIWYG/HTML)",
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED",
  submitted_date,
  validated_by: "KAPRODI_ID",
  validated_date,
  remarks: "...",               // untuk rejection
  version: "v1.0"
}
```

### 8.2 API Endpoint Examples

```javascript
// 1. GET Dashboard CPL Overview
GET /api/dashboard/cpl-overview
Params: { program_id, semester }
Response: {
  status: "success",
  data: [
    {
      cpl_id: "CPL-A",
      name: "Problem Solving",
      achievement: 81.5,
      target: 70,
      students_achieved: 35,    // dari 45
      students_total: 45
    }
    // ...
  ]
}

// 2. GET IK Breakdown (drill-down)
GET /api/dashboard/ik-breakdown/:cpl_id
Response: {
  cpl_id: "CPL-A",
  ik_list: [
    {
      ik_id: "IK-A.1",
      name: "Explain principles",
      achievement: 79.8,
      supporting_cpmk: ["CPMK-1", "CPMK-3"]
    }
    // ...
  ]
}

// 3. POST Import Nilai (dari SIAP)
POST /api/nilai/import-siap
Body: { mk_id, semester, action: "preview" | "confirm" }
Response (preview): {
  total_records: 45,
  preview: [
    { nim, nama, nilai_tugas, nilai_uts, nilai_uas }
    // ...
  ]
}

// 4. GET Trending Analysis
GET /api/trending/cpl-by-angkatan
Params: { program_id, cpl_id, year_range: "2021-2024" }
Response: {
  cpl_id: "CPL-A",
  trend_data: [
    { angkatan: 2021, achievement: 72 },
    { angkatan: 2022, achievement: 76 },
    { angkatan: 2023, achievement: 82 },
    { angkatan: 2024, achievement: 92 }
  ]
}

// 5. POST Generate Laporan
POST /api/dokumen/generate-laporan
Body: { mk_id, semester, type: "evaluasi" | "rps" }
Response: {
  laporan_id: "LAP-2024-TK101-001",
  content: "... (HTML/formatted)"
}
```

---

## 9. Calculation Methodology

> Perhitungan dilakukan di backend; frontend hanya menampilkan hasilnya.

```
STEP A: Input → Nilai per komponen
  Tugas: 80, UTS: 75, UAS: 85

STEP B: Komponen → CPMK Value
  Nilai_CPMK = (80×20% + 75×30% + 85×50%) = 81.5

STEP C: CPMK → IK Value
  Nilai_IK = avg(CPMK yang support IK)
  Contoh: IK-A.1 = avg(CPMK-1: 82.5, CPMK-3: 78.1) = 80.3

STEP D: IK → CPL Value
  Nilai_CPL = avg(semua IK di CPL)
  Contoh: CPL-A = avg(IK-A.1: 80.3, IK-A.2: 83.2, ...) = 81.5

STEP E: Achievement Stats
  % Students achieved = (jumlah student ≥ target) / total × 100
  Contoh: 35 dari 45 students capai CPL-A ≥ 70% = 77.8%
```

**Frontend menampilkan:**

| Level | Contoh tampilan |
|---|---|
| Level 1 (CPL) | `CPL-A: 81.5% (77% dari 45 students)` |
| Level 2 (IK) | `IK-A.1: 80.3% (36 dari 45 students)` |
| Level 3 (CPMK) | `CPMK-1: 82.5% (from TK101)` |

---

## 10. Non-Functional Requirements

| Requirement | Target | Implementation |
|---|---|---|
| Performance | Page load < 3s | React.lazy, pagination, caching |
| Response time | API < 1s | Async operations, DB indexing |
| Accessibility | WCAG 2.1 AA | Alt text, keyboard nav, color contrast |
| Browser Support | Chrome, Firefox, Edge | Modern browsers (ES6+) |
| Security | HTTPS, JWT, RBAC | Input validation, sanitization |
| Availability | 95% uptime | Error handling, graceful fallback |
| Scalability | 5–9 prodi aktif (≈250 user, ≈20.000 baris nilai/semester) | Volume ini kecil untuk database relasional standar; fokus utama ada di kualitas query, bukan kapasitas server |
| Multi-tenancy | Isolasi ketat antar prodi | `program_id` di-index di semua tabel utama; filter scope dilakukan di backend berbasis token, bukan parameter client |
| Query performance dashboard | Hindari N+1 query | Kalkulasi CPL/IK/CPMK di Dashboard (Feature 6) & Trending (Feature 7) memakai agregasi di level database (`GROUP BY` / materialized view), bukan loop per-item di aplikasi |
| Proses berat (AI generation, export, sync SIAP) | Tidak boleh blocking | Generate RPS/Laporan (Feature 8, 9), Export PDF/Excel (Feature 11), dan Sync SIAP (Feature 4) dijalankan sebagai background job dengan notifikasi status, bukan request synchronous yang menahan browser |
| Ketergantungan API eksternal (SIAP UNDIP) | Tidak boleh menggantung tanpa batas | Timeout eksplisit untuk panggilan ke SIAP; jika gagal/timeout, fallback otomatis ke opsi manual input (Feature 5) |
| Kredensial integrasi eksternal | Tidak boleh plaintext | Kredensial SIAP UNDIP (satu kredensial institusional, lihat Section 3.5) disimpan terenkripsi di backend |
| Scalability | 1000+ users | Horizontal scaling, efficient queries |

---

## 11. Success Metrics

| Metrik | Target |
|---|---|
| Feature Completeness | 12/12 fitur terimplementasi |
| Functionality | Semua operasi CRUD berjalan |
| Error Handling | Pesan user-friendly untuk semua kasus |
| Data Accuracy | Perhitungan CPL/CPMK terverifikasi |
| Usability | SUS score ≥ 70 |
| Performance | Dashboard < 3s, Export < 10s |
| Code Quality | Komponen reusable, tanpa console error |

---

## Summary

**Key Highlights**

- **Multi-Tenant Architecture** — satu sistem dipakai banyak prodi, data terisolasi ketat per prodi lewat `program_id`
- **3-Level Hierarchy** — CPL → IK → CPMK (model OBE yang benar)
- **Generic Template** — dapat dipakai program studi / fakultas mana pun, dikustomisasi mandiri oleh tiap prodi setelah onboarding
- **Trending Feature** — perbandingan year-over-year
- **Flexible Bobot** — ditampilkan apa adanya, tanpa keharusan 100%
- **Editable Everything** — CPL, IK, CPMK, plus versioning
- **3-Level Dashboard** — drill-down dari CPL sampai CPMK
- **AI-Assisted Docs** — RPS & Laporan (tetap direview/diedit dosen)
- **Super Admin Panel** — provisioning prodi baru dengan batasan akses yang jelas (operasional, bukan akademik)

**Next Steps**

1. Marsel & tim review PRD v2.1
2. Konfirmasi ke pihak SIAP UNDIP: model kredensial integrasi institusional
3. Klarifikasi ambiguitas yang tersisa
4. Mulai pengembangan frontend (React)
5. Koordinasi dengan tim backend, terutama skema `program_id` & guard API di setiap endpoint
