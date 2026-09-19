# SADEWA Institutional — Design Brief

**Version:** 1.1 (Role-Aligned)
**Rujukan wajib:** `docs/PRD/PRD.md` v2.1 — dokumen ini adalah sumber kebenaran **visual**; PRD tetap sumber kebenaran **fungsional** (siapa boleh apa). Jika ada perbedaan soal kewenangan/akses, PRD yang berlaku.

Dokumen ini adalah arahan visual dan UX untuk membangun ulang tampilan SADEWA secara konsisten. Gunakan sebagai **design system + implementation brief**, bukan hanya sebagai deskripsi umum.

---

## 0. Peta Role → Halaman (WAJIB DIBACA SEBELUM IMPLEMENTASI)

> Perubahan utama dari draf sebelumnya: setiap halaman sekarang eksplisit ditandai **milik role mana**. Jangan render satu sidebar generik untuk semua role — sidebar, dan isi halaman itu sendiri, harus berbeda tergantung siapa yang login. Ini bukan detail kosmetik; ini prinsip isolasi kewenangan dari PRD Section 3.2.

| Halaman | Role yang bisa akses | Sumber PRD |
|---|---|---|
| Ikhtisar / Dashboard OBE | Admin Prodi, Dosen, Kaprodi, Dekan (data ter-scope ke `program_id` masing-masing) | Feature 6 |
| Analitik OBE (3-level drill-down) | Admin Prodi, Dosen, Kaprodi, Dekan | Feature 6, 7 |
| Kurikulum OBE (edit CPL/IK/CPMK) | **Admin Prodi** (CRUD penuh) · Dosen (lihat saja, CPMK miliknya) | Feature 2 |
| Validasi Laporan | **Kaprodi**, Dekan (approve/reject) · Dosen (lihat status laporan miliknya) | Feature 10 |
| Generate RPS / Laporan Evaluasi | Dosen (buat & submit) · Kaprodi (lihat sebagai bagian validasi) | Feature 8, 9 |
| Manajemen Pengguna (dalam 1 prodi) | **Admin Prodi** — kelola dosen/kaprodi di prodinya sendiri | Feature 3 |
| **Panel Super Admin** (daftar prodi, provisioning, user metadata lintas prodi) | **Super Admin SAJA** — role terpisah, tidak muncul untuk role lain | Feature 12, Section 3.2 |
| **Pengajuan/Provisioning Prodi Baru** | **Super Admin SAJA** — approve/reject provisioning bukan wewenang Kaprodi | Feature 12, Section 3.3 |

**Konsekuensi untuk demo:** karena ini demo visual dengan data lokal (tanpa auth sungguhan), gunakan **role switcher** di topbar (dropdown atau pill selector: "Lihat sebagai: Admin Prodi / Dosen / Kaprodi / Dekan / Super Admin"). Saat role diganti, sidebar dan konten halaman ikut berganti mengikuti tabel di atas — ini untuk membuktikan pemisahan kewenangan benar-benar berjalan di UI, bukan cuma label role di pojok atas yang tidak berpengaruh ke apapun.

---

## 1. Konteks Produk

SADEWA adalah aplikasi institutional untuk **Sistem Analisis Data Evaluasi Wawasan Akademik**. Aplikasi digunakan oleh Super Admin, Admin Prodi, Dosen, Kaprodi, dan Dekan untuk memantau evaluasi Outcome-Based Education (OBE), mengelola kurikulum, memvalidasi laporan, dan (khusus Super Admin) memproses provisioning program studi baru.

### Fokus MVP (demo visual)

1. Dashboard operasional OBE — Admin Prodi/Dosen/Kaprodi/Dekan.
2. Analitik 3-level: **CPL → IK → CPMK** — Admin Prodi/Dosen/Kaprodi/Dekan.
3. Analisis tren ketercapaian CPL — Kaprodi/Dekan (lintas angkatan).
4. Kurikulum OBE — Admin Prodi (edit), Dosen (lihat).
5. Validasi laporan evaluasi — Kaprodi/Dekan (approve/reject), Dosen (submit & lihat status).
6. Panel Super Admin: daftar prodi & provisioning — **khusus Super Admin, terpisah total dari 5 poin di atas**.

Gunakan data demo lokal untuk membuat tampilan dan alur terasa hidup. Jangan mengharuskan login sungguhan atau integrasi eksternal pada demo visual — tapi role switcher tetap wajib ada agar perbedaan akses terlihat.

## 2. Karakter Visual

### Kata Kunci

- Formal.
- Institutional.
- Akademik.
- Terstruktur.
- Berwibawa.
- High-contrast.
- Data-dense tetapi tetap mudah dipindai.
- Desktop-first.

### Jangan Gunakan

- Gradient ungu atau violet.
- Tampilan startup/SaaS yang terlalu playful.
- Glassmorphism.
- Shadow besar.
- Kartu dengan sudut sangat bulat.
- Layout yang seluruhnya terpusat.
- Warna-warni tanpa fungsi status.
- Font default browser, Arial, atau gaya mobile-app.

Gunakan border 1px dan whitespace yang terukur untuk membangun struktur. Warna hanya boleh dominan pada brand, CTA, dan status data.

## 3. Design Tokens

### Warna Utama

```css
--primary: #1A3A6B;       /* navy institusional */
--primary-dark: #142B4A;  /* heading / hover */
--secondary: #6D778E;     /* slate grey */
--tertiary: #F4A300;      /* orange status / accent */
--success: #10B981;       /* berhasil / tercapai */
--error: #EF4444;         /* gagal / ditolak */
--background: #F8FAFC;    /* canvas aplikasi */
--surface: #FFFFFF;       /* card / table */
--border: #E2E8F0;        /* garis struktur */
--muted: #F2F4F7;         /* area sekunder */
--text: #142B4A;          /* body dan heading utama */
--text-muted: #64748B;    /* metadata */
```

### Aturan Warna

- Sidebar: `#132D50` atau navy yang sedikit lebih gelap dari primary.
- Tombol utama: navy `#1A3A6B` dengan teks putih.
- Tombol sekunder: surface putih dengan border slate.
- Status tercapai: hijau lembut dengan teks hijau tua.
- Status perlu perhatian: amber lembut dengan teks amber tua.
- Status kritis/ditolak: merah lembut dengan teks merah tua.
- Background utama harus tetap terang dan netral.

### Tipografi

Jika font tersedia, gunakan:

- Heading: **Public Sans** atau sans-serif institutional yang tegas, weight 600–700.
- Body: **Inter** atau **IBM Plex Sans**, weight 400–500.
- Label/table header: body font, weight 500–600, uppercase kecil dengan letter spacing.

Gunakan hierarchy berikut:

- Page title: 28–32px, semibold, tracking tight.
- Section title: 16–18px, semibold.
- Body: 13–14px.
- Metadata: 11–12px.
- Table header: 10–11px, uppercase, letter spacing 0.12em.

### Radius, Border, Shadow

- Global radius maksimal: 8px.
- Card: `border: 1px solid #E2E8F0`, background putih.
- Shadow default: none.
- Hover: boleh memakai `shadow-sm` dan translateY negatif 1px.
- Jangan gunakan `transition: all`; gunakan transition property spesifik seperti `transition-colors` atau `transition-transform`.

## 4. Struktur Layout

Gunakan layout dashboard desktop dengan dua zona utama:

```text
┌──────────────────────┬──────────────────────────────────────────┐
│                      │ Topbar                                   │
│  Fixed Sidebar       ├──────────────────────────────────────────┤
│  240–250px           │                                          │
│                      │ Main content                             │
│                      │ max-width besar, left aligned             │
└──────────────────────┴──────────────────────────────────────────┘
```

### Sidebar — berbeda per role

Struktur visual sidebar (lebar, warna, logo) **sama** untuk semua role. Yang berbeda adalah **isi menu**-nya, mengikuti tabel Section 0.

- Lebar sekitar 240–250px.
- Fixed di sisi kiri.
- Background navy gelap.
- Logo berbentuk kotak kecil berwarna orange dengan huruf `S`.
- Wordmark `SADEWA` dan label kecil `INSTITUTIONAL`.
- Deskripsi pendek: `Sistem Analisis Data Evaluasi Wawasan Akademik`.
- Item aktif: background putih, teks navy, icon navy.
- Item nonaktif: teks biru-putih dengan hover background putih transparan.
- Bagian bawah sidebar berisi profile card berisi nama, role aktif, dan (jika Admin Prodi/Dosen/Kaprodi/Dekan) badge kode program studi.

**Menu untuk Admin Prodi / Dosen / Kaprodi / Dekan** (grup "RUANG KERJA"):
- Ikhtisar
- Analitik OBE
- Kurikulum OBE *(Dosen: read-only, tanpa tombol edit)*
- Validasi Laporan *(Dosen: judul menu jadi "Laporan Saya", tanpa tombol approve/reject)*

Grup "ADMINISTRASI" **hanya muncul untuk Admin Prodi**, berisi:
- Manajemen Pengguna *(khusus user di prodinya sendiri)*

**Menu untuk Super Admin** — sidebar terpisah total, tidak berbagi grup "RUANG KERJA" di atas:
- **RUANG KERJA SUPER ADMIN**
  - Daftar Prodi
  - Pengajuan Onboarding Prodi *(dengan badge notifikasi orange untuk yang pending)*
  - Manajemen Pengguna Lintas Prodi *(metadata saja — lihat status aktif/nonaktif, bukan isi akademik; lihat PRD Section 3.2)*

> Super Admin **tidak** melihat menu Kurikulum OBE, Analitik OBE, atau Validasi Laporan sama sekali — itu di luar kewenangannya per PRD Section 3.2.

### Topbar

- Tinggi sekitar 70px.
- Background putih.
- Border bottom slate.
- Breadcrumb kiri: `SADEWA > [halaman aktif]`.
- Search field kanan dengan placeholder `Cari di SADEWA...` (disembunyikan pada tampilan Super Admin jika tidak relevan).
- Notification icon dengan titik notifikasi orange.
- Role indicator: nama role aktif (`Kaprodi`, `Admin Prodi`, `Super Admin`, dst.) dan, untuk role selain Super Admin, badge kode program studi (`TK`).
- **Role switcher** (khusus demo, lihat Section 0): dropdown di sebelah role indicator untuk berpindah role tanpa reload.
- Topbar boleh sticky.

### Main Content

- Background `#F8FAFC`.
- Padding desktop sekitar 32px.
- Konten rata kiri, jangan center-align seluruh halaman.
- Page header selalu memiliki:
  - Eyebrow uppercase kecil dengan garis orange pendek.
  - Judul utama.
  - Deskripsi singkat.
  - Action buttons di sisi kanan jika diperlukan (dan hanya untuk role yang berwenang atas aksi itu).

## 5. Halaman dan Komponen

### A. Ikhtisar / Dashboard

**Role:** Admin Prodi, Dosen, Kaprodi, Dekan. Konten sama secara struktur; data selalu ter-scope ke `program_id` milik user (Dekan bisa punya selector prodi jika mengawasi lebih dari satu — lihat PRD Section 3.1).

Header:

- Eyebrow: `DASHBOARD OPERASIONAL`.
- Title: `Selamat pagi, [Nama User]`.
- Description: `Pantau ketercapaian OBE dan aktivitas akademik program studi Anda.`
- Filter semester: `2024 Genap`.
- Tombol `Export` dan `Print`.

#### Metric Cards

Tampilkan empat kartu datar dalam satu baris:

1. `Ketercapaian OBE` — `79.6%`, caption `Target institusi 70%`.
2. `Mahasiswa dievaluasi` — `45`, caption `Pada semester berjalan`.
3. `Mata kuliah aktif` — `12`, caption `Dengan pemetaan CPMK`.
4. `Laporan menunggu` — `3`, caption `Perlu validasi Kaprodi` *(untuk Dosen, ubah caption jadi "Laporan yang Anda kirim")*.

Setiap kartu memiliki icon kecil di kanan atas. Gunakan warna icon sebagai pembeda, bukan background gradient.

#### Widget Dashboard

Buat grid asimetris:

- Kiri lebih lebar: bar chart `Ringkasan ketercapaian CPL`.
- Kanan lebih sempit: `Aktivitas terbaru`.
- Bar chart menampilkan CPL-A sampai CPL-F dan target 70%.
- Gunakan navy untuk capaian normal dan orange untuk capaian di bawah target.
- Aktivitas memakai timeline/list dengan icon status.

#### CPL Overview

Tampilkan grid 3 kolom berisi kartu CPL:

- Kode: `CPL-A`.
- Nama: `Problem Solving`.
- Nilai capaian: `81.5%`.
- Progress bar tipis.
- Jumlah mahasiswa: `35/45 mahasiswa`.
- Trend: `↑ 8.4%` atau `↓ 4.2%`.
- Badge `Tercapai` atau `Perlu Perhatian`.

Kartu harus dapat diklik untuk membuka halaman Analitik OBE dengan CPL terpilih.

#### Context Card

Buat satu card navy untuk konteks program studi:

- `Teknik Komputer`.
- `Fakultas Teknik`.
- Semester, tahun akademik, versi kurikulum, terakhir sinkron.
- CTA `Lihat struktur kurikulum` *(Dosen: label jadi "Lihat kurikulum", mengarah ke versi read-only)*.

---

### B. Analitik OBE

**Role:** Admin Prodi, Dosen, Kaprodi, Dekan.

Gunakan breadcrumb yang menunjukkan hirarki:

```text
Level 1 · CPL Overview > Level 2 · CPL-A / IK Breakdown > Level 3 · CPMK detail
```

Layout:

- Panel kiri sempit: daftar CPL dan nilai capaian.
- Panel kanan luas: tabel IK dan chart tren.

Tabel IK harus memuat:

- Kode IK.
- Nama indikator.
- Progress bar ketercapaian.
- Jumlah mahasiswa tercapai.
- CPMK pendukung.

Chart tren *(khususnya relevan untuk Kaprodi/Dekan — Dosen boleh melihat tapi bukan fokus utamanya)*:

- Line chart tahun 2021–2024.
- Garis CPL-A navy, CPL-B orange, CPL-C hijau.
- Legend dan tooltip.
- Insight cards di bawah chart:
  - `CPL-A: Naik 20% sejak 2021`.
  - `CPL-B: Turun 4% · perlu review`.
  - `CPL-C: Stabil di atas target`.

---

### C. Kurikulum OBE

**Role:** Admin Prodi (CRUD penuh — sesuai PRD Feature 2) · Dosen (lihat saja, tanpa tombol edit/tambah).

Tampilkan empat statistik:

- CPL: 8.
- IK: 35.
- CPMK: 60.
- Mata kuliah: 12.

Tabel hierarki memuat:

- Kode CPL.
- Nama CPL.
- Jumlah IK.
- CPMK terpetakan.
- Status `Aktif`.

Tombol `Tambah CPL` **hanya render untuk role Admin Prodi**. Untuk Dosen, sembunyikan tombol ini sepenuhnya (bukan disabled dengan tooltip) — dan tambahkan badge kecil "Mode Lihat" di header halaman supaya jelas Dosen sedang di tampilan read-only.

---

### D. Validasi Laporan

**Role:** Kaprodi, Dekan (approve/reject) · Dosen (lihat status laporan miliknya, submit laporan baru — mengarah ke alur Generate Laporan Evaluasi, PRD Feature 9).

Tabel laporan berisi:

- Dosen pengampu.
- Mata kuliah.
- Tanggal dikirim.
- Status.
- Tombol `Setujui` dan `Kembalikan` — **hanya render untuk Kaprodi/Dekan**.

Untuk role Dosen, ganti judul halaman jadi "Laporan Saya" dan kolom aksi jadi status badge saja (`Menunggu Validasi` / `Disetujui` / `Perlu Revisi`) tanpa tombol approve/reject, plus tombol `+ Buat Laporan Baru` yang mengarah ke form Generate Laporan Evaluasi.

Tambahkan tiga summary cards:

- Pending review *(Kaprodi/Dekan)* atau "Laporan Terkirim" *(Dosen)*.
- Disetujui bulan ini.
- Arsip evaluasi.

---

### E. Panel Super Admin — Daftar Prodi & Pengajuan Onboarding

**Role:** Super Admin SAJA. Halaman ini menggantikan posisi "Pengajuan Prodi" pada draf sebelumnya, dan **tidak pernah muncul** di sidebar role lain manapun.

Header:

- Eyebrow: `PANEL SUPER ADMIN`.
- Title: `Manajemen Program Studi`.
- Description: `Provisioning prodi baru dan tinjau pengajuan onboarding.`
- Button primary: `+ Tambah Prodi Baru`.

#### Tabel Daftar Prodi

Kolom:

- Nama program studi.
- Fakultas.
- Tanggal onboard.
- Jumlah user aktif.
- Statistik ringkas (jumlah CPL, jumlah MK — **bukan isi CPL-nya**, hanya angka).

Klik satu baris prodi membuka panel detail berisi **metadata & daftar user saja** (nama, role, status aktif/nonaktif, tombol reset password/nonaktifkan) — **tidak** menampilkan isi CPL/IK/CPMK, nilai mahasiswa, atau isi Laporan Evaluasi. Tambahkan catatan kecil di panel: *"Isi kurikulum dan laporan evaluasi adalah kewenangan Admin Prodi/Kaprodi masing-masing prodi."*

#### Form Provisioning Prodi Baru

Form ditampilkan sebagai card putih dengan border navy tipis ketika aktif.

Fields:

- Nama program studi.
- Fakultas.
- Nama & email Admin Prodi pertama (akun ini yang akan dibuatkan sistem).

Action:

- `Batal` sebagai outline.
- `Buat Prodi & Kirim Kredensial` sebagai primary navy dengan icon send.

#### Tabel Pengajuan Onboarding (jika memakai alur pengajuan via landing page, PRD Section 3.4)

Kolom:

- Referensi.
- Program studi yang diajukan.
- Nama pengusul & email.
- Tanggal.
- Status.
- Aksi.

Contoh data:

- `REQ-240615-001` · Teknik Lingkungan · Dalam Review.
- `REQ-240610-002` · Statistika · Disetujui.

Pengajuan `PENDING` atau `REVIEW` memiliki tombol approve hijau (memicu alur provisioning di atas) dan reject outline merah — **tombol ini hanya ada di tampilan Super Admin**.

Tambahkan search `Cari prodi...` dan tombol filter.

---

## 6. Interaction dan Motion

- Animasi halaman sangat ringan: fade-up 200–300ms.
- Hover card: translateY `-1px` dan shadow kecil.
- Hover link: perubahan warna navy ke orange.
- Button click harus memberi toast feedback.
- Loading state menggunakan skeleton atau label singkat, bukan blank screen.
- Jika API gagal, shell, navigasi, dan data demo tetap tampil.
- Jangan membuat modal/full-screen error yang menggantikan seluruh halaman.
- Saat role switcher diganti (demo), transisi sidebar & konten memakai fade singkat, bukan reload halaman penuh.

## 7. Accessibility

- Pastikan kontras teks navy terhadap background memenuhi WCAG AA.
- Semua tombol memiliki label yang jelas.
- Semua icon-only button memiliki `aria-label`.
- Semua form input punya label.
- Gunakan keyboard focus ring yang terlihat.
- Gunakan table header yang semantik.
- Tombol/menu yang disembunyikan karena role tidak berwenang harus benar-benar tidak dirender di DOM, bukan hanya disembunyikan lewat CSS (`display: none`) — supaya tidak bisa diakses lewat keyboard navigation atau screen reader.

## 8. Data dan State Demo

Gunakan data demo berikut agar screenshot dan flow terlihat realistis:

```json
{
  "program": "Teknik Komputer",
  "faculty": "Fakultas Teknik",
  "semester": "2024 Genap",
  "students": 45,
  "active_courses": 12,
  "overall_achievement": 79.6,
  "target": 70,
  "cpl": [
    { "code": "CPL-A", "name": "Problem Solving", "achievement": 81.5, "status": "ACHIEVED" },
    { "code": "CPL-B", "name": "Technical Skills", "achievement": 68, "status": "WARNING" },
    { "code": "CPL-C", "name": "Communication", "achievement": 87.2, "status": "ACHIEVED" },
    { "code": "CPL-D", "name": "Professionalism", "achievement": 76.8, "status": "ACHIEVED" },
    { "code": "CPL-E", "name": "Data Literacy", "achievement": 72.4, "status": "ACHIEVED" },
    { "code": "CPL-F", "name": "Innovation", "achievement": 69.8, "status": "WARNING" }
  ],
  "demo_roles": [
    { "role": "SUPER_ADMIN", "name": "Tim IT SADEWA", "program": null },
    { "role": "ADMIN_PRODI", "name": "Budi", "program": "Teknik Komputer" },
    { "role": "DOSEN", "name": "Andi", "program": "Teknik Komputer" },
    { "role": "KAPRODI", "name": "Dr. Bima", "program": "Teknik Komputer" },
    { "role": "DEKAN", "name": "Prof. Citra", "program": "Fakultas Teknik" }
  ],
  "provisioning_requests": [
    { "ref": "REQ-240615-001", "program": "Teknik Lingkungan", "status": "REVIEW" },
    { "ref": "REQ-240610-002", "program": "Statistika", "status": "DISETUJUI" }
  ]
}
```

## 9. Implementation Rules untuk Agent AI

- Gunakan React + TypeScript strict.
- Gunakan Tailwind CSS dan komponen UI yang konsisten.
- Gunakan Recharts untuk bar chart dan line chart.
- Gunakan icon library seperti Lucide.
- Gunakan toast untuk feedback aksi.
- Gunakan data-testid yang unik pada setiap tombol, link, input, form, card utama, dan chart.
- Hindari file JavaScript biasa jika proyek menggunakan TypeScript.
- Pertahankan desktop-first; mobile tidak menjadi prioritas MVP.
- Jangan menambahkan auth, SIAP, AI, email, atau payment integration ke demo kecuali diminta eksplisit.
- Semua API yang dibuat untuk demo harus dapat diganti dengan backend nyata tanpa mengubah struktur UX.
- **Wajib:** implementasikan role switcher di demo (Section 0) dan pastikan sidebar/menu/tombol aksi benar-benar berubah mengikuti tabel Role → Halaman di Section 0 — ini bukan opsional, karena ini yang membuktikan struktur RBAC dari PRD benar-benar tercermin di UI.
- Jangan render menu atau tombol aksi untuk role yang tidak berwenang, meskipun secara visual di-disable — lihat Section 7 soal DOM rendering.

## 10. Prompt Singkat Siap Salin

> Bangun dashboard web SADEWA Institutional dengan gaya formal akademik dan institutional, dan dengan **role-based access yang benar-benar berfungsi** di UI (lihat peta Role → Halaman di Section 0 dokumen ini). Gunakan fixed sidebar navy 240–250px yang isinya berubah sesuai role aktif, topbar putih dengan breadcrumb, search, notification, role indicator, dan role switcher untuk keperluan demo. Gunakan palette `#1A3A6B` navy, `#6D778E` slate, `#F4A300` orange, `#10B981` green, `#EF4444` red, background `#F8FAFC`, surface putih, dan border `#E2E8F0`. Gunakan heading Public Sans atau sans-serif institutional tegas, body Inter atau IBM Plex Sans. Hindari gradient, glassmorphism, shadow besar, radius berlebihan, dan layout yang terlalu terpusat. Buat halaman Ikhtisar, Analitik OBE, Kurikulum OBE, dan Validasi Laporan untuk role Admin Prodi/Dosen/Kaprodi/Dekan (dengan variasi kewenangan tiap role sesuai Section 5), serta Panel Super Admin (Daftar Prodi & Pengajuan Onboarding) yang terpisah total dan hanya terlihat oleh Super Admin. Dashboard harus menampilkan metrik OBE, bar chart CPL, aktivitas terbaru, kartu CPL, context card program studi, line chart tren 2021–2024, tabel IK/CPMK, tabel status pengajuan prodi (khusus Super Admin), statistik kurikulum, dan workflow approve/reject laporan (khusus Kaprodi/Dekan). Gunakan data demo lokal realistis. Semua interaksi penting harus memberi toast feedback, memiliki state loading/fallback, dan diberi data-testid unik.
