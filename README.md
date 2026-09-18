
**SADEWA (Sistem Analisis Data Evaluasi Wawasan Akademik)** adalah sistem web multi-tenant untuk evaluasi **Outcome-Based Education (OBE)** dan dokumen akademik.

Judul resmi:

> Rancang Bangun Sistem Analisis Data Evaluasi Wawasan Akademik (SADEWA) Berbasis Web Menggunakan Random Forest dan Asisten Cerdas LLM pada Lingkungan Outcome-Based Education

## Struktur Proyek

```text
sadewa/
├── frontend/          # React + Vite + Tailwind
└── backend/           # FastAPI + SQLAlchemy + ML + LLM
```

## Fitur Utama

- Auth JWT (`/api/auth/login`, `/api/auth/register`, `/api/auth/me`)
- RBAC 5 peran: Super Admin, Admin Prodi, Dosen, Kaprodi, Dekan
- Isolasi data prodi di backend melalui `program_studi_id`
- Kurikulum OBE 3 level: CPL → IK → CPMK dan pemetaan CPMK ke IK
- Input nilai, dashboard drill-down, tren angkatan, dokumen RPS/laporan dan validasi

---

## 1) Setup PostgreSQL

1. Install PostgreSQL.
2. Buat database:
   - `sadewa_db`
3. Sesuaikan credential pada `backend/.env` (copy dari `backend/.env.example`).

Contoh isi `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/sadewa_db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
GEMINI_API_KEY=your-gemini-api-key
```

---

## 2) Install Backend Requirements

Dari folder `backend/`:

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 3) Alembic Migration

Jika belum inisialisasi Alembic:

```bash
alembic init alembic
```

Set `sqlalchemy.url` di `alembic.ini` ke nilai `DATABASE_URL`, lalu generate migration:

```bash
alembic revision --autogenerate -m "init sadewa schema"
alembic upgrade head
```

> Catatan: aplikasi juga melakukan `create_all` saat startup untuk memudahkan development awal.

---

## 4) Run Seed Data

Dari folder `backend/`:

```bash
python -m app.core.seed
```

Data seed mencakup:
- 3 user (admin, dosen, kaprodi)
- 1 program studi
- 3 mata kuliah
- 20 mahasiswa
- 3 CPL + 6 CPMK
- data penilaian dummy kombinasi lengkap

---

## 5) Jalankan FastAPI (Uvicorn)

Dari folder `backend/`:

```bash
uvicorn app.main:app --reload
```

API docs:
- Swagger: `http://localhost:8000/docs`

---

## 6) Jalankan Frontend Vite Dev Server

Dari folder `frontend/`:

```bash
npm install
npm run dev
```

Copy env frontend dari `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Akses frontend di:
- `http://localhost:5173`

---

## Akun Seed (Default)

- Admin: `admin@sadewa.ac.id` / `admin123`
- Dosen: `dosen@sadewa.ac.id` / `dosen123`
- Kaprodi: `kaprodi@sadewa.ac.id` / `kaprodi123`

---

## Catatan arsitektur

Data akademik selalu difilter oleh scope prodi pada token pengguna. Super Admin hanya dapat melakukan provisioning dan melihat metadata operasional, bukan isi kurikulum, nilai, atau laporan.
