# SADEWA

**Sistem Analisis Data Evaluasi Wawasan Akademik** — aplikasi web multi-tenant untuk evaluasi **Outcome-Based Education (OBE)** dan penyusunan dokumen akademik (RPS dan laporan evaluasi) dengan bantuan AI.

> Rancang Bangun Sistem Analisis Data Evaluasi Wawasan Akademik (SADEWA) Berbasis Web dengan Asisten Cerdas LLM pada Lingkungan Outcome-Based Education

Dokumen perancangan lengkap ada di [`docs/PRD/PRD_SADEWA_v2.2.md`](docs/PRD/PRD_SADEWA_v2.2.md) dan [`docs/PRD/design/DESIGN.md`](docs/PRD/design/DESIGN.md).

---

## Daftar Isi

1. [Arsitektur](#arsitektur)
2. [Struktur Proyek](#struktur-proyek)
3. [Fitur dan Status](#fitur-dan-status)
4. [Prasyarat](#prasyarat)
5. [Instalasi dan Menjalankan](#instalasi-dan-menjalankan)
6. [Konfigurasi Environment](#konfigurasi-environment)
7. [Akun Seed](#akun-seed)
8. [Peran dan Hak Akses](#peran-dan-hak-akses)
9. [Metodologi Kalkulasi OBE](#metodologi-kalkulasi-obe)
10. [Modul AI (RAG)](#modul-ai-rag)
11. [Ringkasan API](#ringkasan-api)
12. [Halaman Frontend](#halaman-frontend)
13. [Testing](#testing)
14. [Masalah Umum dan Keterbatasan](#masalah-umum-dan-keterbatasan)

---

## Arsitektur

```text
Browser ──► Frontend (React + Vite)      :5173
                │  axios  /api/v1
                ▼
            Backend (FastAPI)            :8000 ──► PostgreSQL :5432
                │  httpx (REST/JSON)
                ▼
            AI Service (FastAPI)         :8001 ──► ChromaDB (vectorstore lokal)
                                                └─► Qwen (Alibaba Cloud Model Studio)
```

- **Frontend** memanggil Backend saja, tidak pernah langsung ke AI Service.
- **Backend** menghitung semua angka ketercapaian secara deterministik dari database, lalu mengirimkannya ke AI Service. LLM hanya menyusun narasi, tidak boleh mengarang angka.
- **AI Service** berjalan sebagai proses terpisah (RAG: PDF kurikulum → embedding → ChromaDB → prompt → Qwen → validasi aturan OBE).

## Struktur Proyek

```text
SADEWA/
├── frontend/                  # React 18, Vite, Tailwind, Recharts
│   └── src/ (pages, components, context, hooks, services, utils)
├── backend/                   # FastAPI, SQLAlchemy, Alembic
│   ├── app/
│   │   ├── api/               # Router per resource (+ v1/router.py)
│   │   ├── core/              # config, database, security, deps (RBAC), seed
│   │   ├── models/            # Model SQLAlchemy
│   │   ├── schemas/           # Skema Pydantic
│   │   └── services/          # ai_client, capaian_service, calculation/
│   ├── alembic/               # Migrasi database
│   └── tests/
├── ai/                        # Modul AI (package `sadewa_ai`)
│   ├── src/sadewa_ai/         # api, service, rag_chain, retriever, llm_client, prompts, validators, ingest, cli
│   ├── docs/                  # PDF sumber knowledge base
│   └── tests/
├── docs/PRD/                  # PRD dan design system
├── docker-compose.yml         # postgres + backend + ai-service
├── start.ps1                  # Menjalankan 3 service sekaligus (Windows)
└── start.sh                   # Menjalankan 3 service sekaligus (macOS / Linux)
```

Dokumentasi khusus modul AI ada di [`ai/README.md`](ai/README.md).

## Fitur dan Status

| Fitur | Status |
|---|---|
| Login JWT, RBAC 5 peran, isolasi data per prodi/fakultas | Berjalan |
| Manajemen fakultas, prodi, dan akun pengguna | Berjalan |
| Kurikulum OBE 3 level: CPL → IK → CPMK, pemetaan, versioning (draft/published) | Berjalan |
| Skala nilai huruf per versi kurikulum | Berjalan |
| Mata kuliah, dosen pengampu, peserta, jenis evaluasi, bentuk penilaian | Berjalan |
| Input nilai manual (per bentuk penilaian × IK) | Berjalan |
| Validasi bobot dan kalkulasi capaian IK/CPMK/CPL, finalisasi hasil | Berjalan |
| Dashboard drill-down, tren CPL per angkatan, rapor mahasiswa | Berjalan |
| Generate RPS 16 pertemuan (RAG + Qwen) | Berjalan, perlu AI Service dan API key |
| Generate narasi evaluasi dan laporan evaluasi, alur submit → approve/reject | Berjalan, perlu AI Service dan API key |
| Sinkronisasi SIAP UNDIP | **Belum tersedia.** Endpoint hanya mencatat log `not_configured`, gunakan input manual |

## Prasyarat

- Python 3.10+
- Node.js 18+ dan npm
- PostgreSQL 15 (atau Docker)
- API key Qwen dari [Alibaba Cloud Model Studio](https://bailian.console.aliyun.com) (hanya untuk fitur AI)

## Instalasi dan Menjalankan

Ada tiga cara. Pilih salah satu.

### Opsi A — Windows: `start.ps1` / macOS & Linux: `start.sh` (paling cepat)

`start.ps1` (Windows) dan `start.sh` (macOS/Linux) mengharapkan virtual environment bernama `venv` berada **satu tingkat di atas folder `SADEWA/`**, yaitu `../venv`.

```powershell
# Windows — dari folder induk SADEWA/
python -m venv venv
venv\Scripts\pip install -e "SADEWA/ai[api]"
venv\Scripts\pip install -r SADEWA\backend\requirements.txt
```

```bash
# macOS / Linux — dari folder induk SADEWA/
python3 -m venv venv
venv/bin/pip install -e "SADEWA/ai[api]"
venv/bin/pip install -r SADEWA/backend/requirements.txt
```

Siapkan file `.env` (lihat [Konfigurasi Environment](#konfigurasi-environment)), bangun knowledge base dan seed database (lihat Opsi B langkah 3–5), lalu:

```powershell
# Windows
cd SADEWA
.\start.ps1
```

```bash
# macOS / Linux
cd SADEWA
chmod +x start.sh   # hanya pertama kali
./start.sh
```

**Windows:** Script membuka 3 jendela terminal terpisah. Tutup ketiga jendela untuk menghentikan semuanya.

**macOS:** Script membuka 3 tab baru di Terminal. Tutup ketiga tab untuk menghentikan semuanya.

**Linux:** Script menjalankan ketiga service di background dalam satu terminal. Tekan `Ctrl+C` untuk menghentikan semuanya sekaligus.

`start.ps1` (Windows) dan `start.sh` (macOS/Linux) mengharapkan virtual environment bernama `venv` berada **satu tingkat di atas folder `SADEWA/`**, yaitu `../venv`.

```powershell
# Windows — dari folder induk SADEWA/
python -m venv venv
venv\Scripts\pip install -e "SADEWA/ai[api]"
venv\Scripts\pip install -r SADEWA\backend\requirements.txt
```

```bash
# macOS / Linux — dari folder induk SADEWA/
python3 -m venv venv
venv/bin/pip install -e "SADEWA/ai[api]"
venv/bin/pip install -r SADEWA/backend/requirements.txt
```

Siapkan file `.env` (lihat [Konfigurasi Environment](#konfigurasi-environment)), bangun knowledge base dan seed database (lihat Opsi B langkah 3–5), lalu:

```powershell
# Windows
cd SADEWA
.\start.ps1
```

```bash
# macOS / Linux
cd SADEWA
chmod +x start.sh   # hanya pertama kali
./start.sh
```

**Windows:** Script membuka 3 jendela terminal terpisah. Tutup ketiga jendela untuk menghentikan semuanya.

**macOS:** Script membuka 3 tab baru di Terminal. Tutup ketiga tab untuk menghentikan semuanya.

**Linux:** Script menjalankan ketiga service di background dalam satu terminal. Tekan `Ctrl+C` untuk menghentikan semuanya sekaligus.


### Opsi B — Manual (semua OS)

**1. Database**

```bash
createdb sadewa_db        # atau buat lewat pgAdmin
```

**2. Virtual environment dan dependensi**

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Dari folder ai/
cd ai && pip install -e ".[api,dev]" && cd ..

# Dari folder backend/ (requirements.txt memuat "-e ../ai", jadi harus dijalankan dari backend/)
cd backend && pip install -r requirements.txt && cd ..
```

**3. Environment**

```bash
cp backend/.env.example backend/.env
cp ai/.env.example ai/.env
cp frontend/.env.example frontend/.env
```

Isi nilainya sesuai [Konfigurasi Environment](#konfigurasi-environment).

**4. Knowledge base AI** (sekali saja, atau saat PDF di `ai/docs/` berubah)

```bash
cd ai
sadewa-ingest            # tambahkan --reset untuk membangun ulang dari nol
sadewa-ai health         # cek vectorstore dan konfigurasi LLM
cd ..
```

Folder `vectorstore/` sengaja tidak masuk Git. Download model embedding saat pertama kali bisa memakan waktu beberapa menit.

**5. Backend dan seed data**

```bash
cd backend
python -m app.core.seed                  # isi data contoh (hanya jalan jika tabel user masih kosong)
uvicorn app.main:app --reload --port 8000
```

Tabel dibuat otomatis lewat `create_all` saat backend start. Swagger: <http://localhost:8000/docs>.

**6. AI Service** (terminal terpisah)

```bash
cd ai
uvicorn sadewa_ai.api:app --reload --port 8001
```

Swagger: <http://localhost:8001/docs>. Cek status: <http://localhost:8001/health>, atau lewat backend di <http://localhost:8000/health/ai>.

**7. Frontend** (terminal terpisah)

```bash
cd frontend
npm install
npm run dev
```

Buka <http://localhost:5173>.

### Opsi C — Docker Compose

```bash
cp backend/.env.example backend/.env
cp ai/.env.example ai/.env      # isi QWEN_API_KEY
docker compose up --build
```

Menjalankan PostgreSQL, Backend (8000), dan AI Service (8001). Frontend tetap dijalankan manual (`npm run dev`).

Hal yang perlu diperhatikan, lihat juga [Masalah Umum](#masalah-umum-dan-keterbatasan):

- Di `backend/.env`, ubah `AI_SERVICE_URL` menjadi `http://ai-service:8001` (bukan `localhost`).
- Jalankan `sadewa-ingest` agar `ai/vectorstore/` terisi, karena folder itu di-mount ke container.
- Seed data: `docker compose exec backend python -m app.core.seed`.

## Konfigurasi Environment

### `backend/.env`

| Variabel | Keterangan | Default di kode |
|---|---|---|
| `DATABASE_URL` | Contoh: `postgresql://user:password@localhost:5432/sadewa_db` | `sqlite:///./sadewa.db` |
| `SECRET_KEY` | Kunci penandatangan JWT, minimal 32 karakter. **Wajib diganti.** | `change-this-secret` |
| `ALGORITHM` | Algoritma JWT | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Masa berlaku token | `1440` (`.env.example` memakai `60`) |
| `AI_SERVICE_URL` | Alamat AI Service | `http://localhost:8001` |
| `AI_SERVICE_TIMEOUT_SECONDS` | Timeout panggilan ke AI Service | `60` |

> Fitur AI tidak memakai Gemini lagi. LLM yang dipakai adalah **Qwen**, kuncinya diisi di `ai/.env`.

### `ai/.env`

| Variabel | Keterangan |
|---|---|
| `QWEN_API_KEY` | API key Model Studio. Wajib untuk generate RPS/narasi |
| `QWEN_BASE_URL` | Default region Singapore: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`. Untuk Beijing: `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `QWEN_MODEL` | Isi eksplisit. Default di kode (`qwen3.8-flash`) berbeda dengan contoh di `.env.example` (`qwen-plus-2025-07-28`) |
| `SADEWA_DOCS_DIR`, `SADEWA_VECTORSTORE_DIR` | Opsional, default ke `ai/docs` dan `ai/vectorstore` |

### `frontend/.env`

```env
VITE_API_BASE_URL=http://localhost:8000
```

Frontend otomatis menambahkan `/api/v1` ke alamat ini.

## Akun Seed

### Seed demo lengkap (disarankan)

```bash
cd backend
python -m app.core.seed_demo --reset   # MENGHAPUS semua tabel lalu mengisi ulang (±1 menit)
```

Isi: 2 fakultas, 5 prodi (Informatika, Teknik Elektro, Teknik Sipil, Manajemen, Akuntansi), kurikulum 2020 (diarsipkan) / 2024 (aktif) / 2026 (draf), 8 CPL × 3 IK per prodi, 62 mata kuliah dengan CPMK dan bobot yang lolos validasi, 600 mahasiswa angkatan 2022–2026, ±66 ribu nilai yang sudah dikalkulasi, 30 laporan evaluasi (draft/submitted/approved/rejected), 62 RPS, dan 20 arsip kurikulum/semester. Nilai dibuat dengan pola realistis (CPL lemah, menurun, dan kuat antar angkatan) agar Analitik OBE punya temuan. Akun utama sama dengan tabel di bawah; akun prodi lain memakai pola `adminprodi.<kode>@`, `kaprodi.<kode>@`, `dekan.feb@`, dan `nama.dosen@sadewa.ac.id`.

### Seed minimal


`python -m app.core.seed` membuat satu akun per peran. **Semua password: `password123`**.

| Peran | Email |
|---|---|
| Super Admin | `superadmin@sadewa.ac.id` |
| Admin Prodi | `adminprodi@sadewa.ac.id` |
| Kaprodi | `kaprodi@sadewa.ac.id` |
| Dekan | `dekan@sadewa.ac.id` |
| Dosen | `dosen@sadewa.ac.id` |

Data contoh yang ikut dibuat: Fakultas Teknik, Program Studi Informatika, kurikulum 2025 (published), 3 CPL, 6 IK, 3 mata kuliah (IF201 Machine Learning, IF202 Basis Data Lanjut, IF203 Rekayasa Perangkat Lunak), 6 CPMK, 4 jenis/bentuk penilaian, 20 mahasiswa, dan 240 nilai acak. Pemetaan IK pada seed bersifat acak. Setelah seed, jalankan `POST /api/v1/kalkulasi/run/{matkul_id}` untuk menghitung capaian.

Seed akan berhenti jika sudah ada data user. Registrasi publik (`POST /auth/register`) hanya bisa dipakai untuk membuat **Super Admin pertama** pada database kosong, lalu otomatis ditutup. Seed sudah mengisi user, jadi setelah seed endpoint itu tertutup.

**Ganti semua password dan `SECRET_KEY` sebelum deploy.**

## Peran dan Hak Akses

| Peran | Cakupan data | Wewenang utama |
|---|---|---|
| Super Admin | Metadata operasional saja | Kelola fakultas, prodi, dan akun. **Tidak** bisa melihat kurikulum, nilai, atau laporan |
| Admin Prodi | Prodi miliknya | Kelola kurikulum (CPL, IK, versi), mata kuliah, CPMK, mahasiswa, peserta, akun Dosen/Kaprodi. **Tidak** punya akses Analitik OBE |
| Dosen | Mata kuliah yang diampu | Bentuk penilaian, input nilai, kalkulasi, Analitik OBE per mata kuliah, generate RPS/laporan |
| Kaprodi | Prodi miliknya | Analitik OBE dan tren prodi, validasi laporan (approve/reject) |
| Dekan | Seluruh prodi di fakultasnya (view-only) | Analitik OBE dan tren per prodi, pantau laporan |

Isolasi dilakukan di backend lewat `program_studi_id` / `fakultas_id` pada token pengguna, bukan hanya di frontend.

## Metodologi Kalkulasi OBE

Implementasi di `backend/app/services/calculation/` mengikuti formula SIMAK-NG. Semua operasi memakai `Decimal` (bukan `float`) dengan pembulatan `ROUND_HALF_UP` ke 2 desimal.

- **Poin sel** = `bobot_sel × nilai / 100`
- **Poin IK** = jumlah poin sel lintas bentuk penilaian untuk IK tersebut
- **Poin CPL** = jumlah poin IK milik CPL pada mata kuliah itu
- **Persen CPL** = `poin_cpl / bobot_cp × 100` (0 jika `bobot_cp = 0`), disimpan per mata kuliah bersama `bobot_cp`
- **CPL gabungan** (lintas mata kuliah) = `Σ(persen_cpl × bobot_cp) / Σ bobot_cp`, dihitung saat dibaca (`calculation/cpl_aggregate.py`)
- **Nilai akhir** = akumulasi poin sel yang belum dibulatkan, dibulatkan sekali di akhir. Bisa berbeda 0,01 dari jumlah poin CPL yang sudah dibulatkan
- **Huruf mutu** = huruf dengan batas minimum terbesar yang masih ≤ nilai akhir, berdasarkan skala nilai kurikulum

Sebelum nilai bisa dimasukkan atau dikalkulasi, mata kuliah harus lolos pengecekan `cek_siap_dinilai`: total bobot CPMK = 100%, tiap CPMK terpetakan ke IK dengan jumlah bobot yang sama, total bobot bentuk penilaian = 100%, dan jumlah tiap baris matriks bentuk penilaian × IK sama dengan bobot bentuknya. Gunakan `POST /api/v1/kalkulasi/validasi-bobot` untuk melihat pelanggarannya.

## Modul AI (RAG)

Detail lengkap: [`ai/README.md`](ai/README.md).

| Keluaran | Endpoint AI Service | Dipanggil lewat Backend |
|---|---|---|
| Draf RPS 16 pertemuan | `POST /api/v1/rps` | `POST /api/v1/rps/{mata_kuliah_id}/generate` |
| Narasi evaluasi kurikulum | `POST /api/v1/narasi` | `POST /api/v1/narasi/generate/{matkul_id}` dan `POST /api/v1/laporan/generate/{matkul_id}` |

Cara kerja dan perilaku penting:

- **Knowledge base**: PDF di `ai/docs/` (Buku Pedoman Teknik Komputer 2024 dan RPS OBE Jaringan Syaraf Tiruan) dipecah per 500 karakter (overlap 100), di-embed dengan `paraphrase-multilingual-MiniLM-L12-v2`, disimpan di ChromaDB. Retrieval mengambil `top_k_chunks = 6` potongan teratas.
- **Retry RPS**: bila hasil generate tidak lolos validasi aturan OBE (16 pertemuan, UTS minggu 8, UAS minggu 16, total bobot 100), pipeline mengulang otomatis maksimal 2 kali dengan pelanggaran sebelumnya diumpankan balik ke LLM.
- **Data capaian nyata**: `capaian_service` mengagregasi capaian CPL dan CPMK dari database, lalu dikirim ke AI agar narasi tidak mengarang angka. Jika belum ada data kalkulasi, backend menolak dengan HTTP 422.
- **Pemetaan error dari AI Service**: knowledge base belum siap → 503, timeout → 504, API key/otorisasi LLM gagal → 502, lainnya → 502.
- **Ambang tercapai**: 70 (skala 0–100) di konfigurasi AI.

Cek cepat dari CLI:

```bash
cd ai
sadewa-ai health
sadewa-ai demo-rps
sadewa-ai demo-narasi
```

## Ringkasan API

Semua endpoint berprefiks `/api/v1` dan memakai `Authorization: Bearer <token>` kecuali login/register. Dokumentasi interaktif lengkap ada di Swagger (`/docs`).

| Grup | Prefiks | Keterangan |
|---|---|---|
| Auth | `/auth` | `POST /login`, `POST /register` (bootstrap Super Admin pertama), `GET /me` |
| Fakultas, Prodi | `/fakultas`, `/prodi` | CRUD, khusus Super Admin |
| Pengguna | `/users` | CRUD akun (Super Admin, Admin Prodi) |
| Kurikulum | `/kurikulum/versions` | Daftar/buat versi, `POST /{id}/publish`, `GET/POST /{id}/skala-nilai` |
| CPL, IK | `/cpl`, `/ik` | CRUD, `PUT /cpl/{id}/threshold` |
| Mata kuliah | `/mata-kuliah`, `/pengampu-mata-kuliah`, `/peserta-mata-kuliah` | Mata kuliah, dosen pengampu, peserta |
| CPMK | `/cpmk` | CRUD, `GET/PUT /{id}/map-ik` |
| Penilaian | `/jenis-evaluasi`, `/bentuk-penilaian`, `/mk-bentuk-penilaian` | Master evaluasi dan matriks bentuk × IK (`PUT /{id}/map-ik`) |
| Nilai | `/nilai` | `POST /manual`, `GET /{mk_id}`, `PUT/DELETE /{id}`, `POST /sync` (belum aktif), `GET /sync-logs/{mk_id}` |
| Kalkulasi | `/kalkulasi` | `POST /validasi-bobot`, `POST /run/{matkul_id}`, `POST /finalize`, `GET /hasil/{id}`, `GET /{matkul_id}` |
| Analitik | `/dashboard`, `/trending`, `/rapor` | `cpl-overview`, `ik-breakdown/{cpl_id}`, `cpl-by-angkatan`, `rapor/mahasiswa/{id}` |
| Dokumen AI | `/rps`, `/narasi`, `/laporan`, `/dokumen` | Generate dan kelola RPS, narasi, laporan, dokumen |
| Validasi | `/validasi` | `GET /laporan`, `POST /laporan/{id}/approve`, `POST /laporan/{id}/reject` (Kaprodi) |
| Monitoring | `/health/ai` (di luar `/api/v1`) | Status AI Service |

## Halaman Frontend

| Area | Rute |
|---|---|
| Umum | `/login`, `/dashboard`, `/analisis`, `/mahasiswa`, `/dokumen`, `/pengaturan` |
| Penilaian | `/peserta`, `/penilaian`, `/nilai` |
| Kurikulum | `/kurikulum`, `/kurikulum/cpl`, `/kurikulum/cpl/:cplId/indikator`, `/kurikulum/pemetaan`, `/kurikulum/mata-kuliah`, `/kurikulum/cpmk`, `/kurikulum/cpmk/mk/:mkId`, `/kurikulum/jenis-evaluasi`, `/kurikulum/bentuk-penilaian` |
| Super Admin | `/super-admin`, `/super-admin/prodi`, `/super-admin/fakultas`, `/super-admin/users` |

Rute akademik hanya untuk Admin Prodi, Dosen, Kaprodi, dan Dekan. Rute `/super-admin/*` hanya untuk Super Admin (lewat `ProtectedRoute`).

Perintah frontend: `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`.

## Testing

```bash
# Backend (dari backend/)
pytest

# AI (dari ai/, butuh extra [dev]; test_api.py juga butuh [api])
pytest
```

Test AI **tidak** memanggil LLM atau vector store sungguhan, jadi aman dijalankan tanpa `QWEN_API_KEY` dan tanpa internet.

## Masalah Umum dan Keterbatasan

**Git di Windows: `LF will be replaced by CRLF`**
Hanya peringatan karena `core.autocrlf`, bukan error. Untuk menyeragamkan, tambahkan `.gitattributes` di root repo:

```text
* text=auto
*.ps1 text eol=crlf
*.py  text eol=lf
```

**`git push` ditolak (`fetch first`)**
Remote punya commit yang belum ada di lokal. Jalankan `git pull --rebase origin main`, selesaikan konflik bila ada, lalu `git push origin main`.

**Alembic: `Multiple head revisions`**
Dua file migrasi di `backend/alembic/versions/` sama-sama memiliki `down_revision = None`, sehingga `alembic upgrade head` bisa gagal. Untuk database baru, cukup jalankan backend (tabel dibuat lewat `create_all`). Sebelum memakai Alembic di database yang sudah berisi, rantai revisinya perlu dirapikan terlebih dahulu.

**Docker: build backend gagal pada `-e ../ai`**
`backend/requirements.txt` memuat `-e ../ai`, sedangkan build context Docker hanya `./backend`, sehingga path itu tidak ada di dalam image. Solusi: pasang `sadewa-ai` lewat jalur lain di Dockerfile atau ubah context build ke root repo. Untuk saat ini, Opsi A/B lebih aman.

**Backend di Docker tidak bisa menjangkau AI Service**
`localhost` di dalam container backend menunjuk ke container itu sendiri. Gunakan `AI_SERVICE_URL=http://ai-service:8001`.

**AI Service "menggantung" saat pertama kali jalan**
Model embedding sedang diunduh (bisa beberapa menit). Tunggu sebelum menekan Ctrl+C.

**`QWEN_API_KEY belum diisi` / `Folder 'vectorstore' tidak ditemukan`**
Isi `ai/.env`, lalu jalankan `sadewa-ingest` dari folder `ai/`.

**Dosen tidak terfilter per prodi pada endpoint baca**
Scope Dosen berbasis penugasan di `pengampu_mata_kuliah` dan baru diterapkan pada sebagian endpoint (lihat `AcademicScope` di `backend/app/core/deps.py`).

