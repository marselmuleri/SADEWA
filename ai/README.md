# SADEWA AI — Modul RAG (Generate RPS & Narasi Evaluasi)

Modul kecerdasan buatan sistem SADEWA. Dikerjakan oleh **AI Engineer**, dipakai
oleh **Backend Engineer** — baik lewat *import* Python langsung maupun lewat
REST API, tergantung arsitektur repo kalian.

Modul ini menghasilkan dua keluaran sesuai dokumen C300 Tabel 25:

| No | Keluaran | Fungsi (library) | Endpoint REST (opsional) |
|----|----------|-------------------|---------------------------|
| 1 | Draf RPS 16 pertemuan | `generate_rps_service()` | `POST /api/v1/rps` |
| 2 | Laporan narasi evaluasi kurikulum | `generate_narasi_service()` | `POST /api/v1/narasi` |

## Dua cara integrasi — pilih sesuai arsitektur tim

**A. Backend satu repo Python yang sama (mis. sama-sama FastAPI/Django)**
Install package ini (`pip install -e .`), lalu `import sadewa_ai` langsung.
Tidak ada overhead HTTP, error Python biasa, paling cepat untuk dikembangkan
bareng.

**B. Backend beda bahasa/repo (mis. Laravel, Express, Spring)**
Jalankan modul ini sebagai service HTTP kecil sendiri (`sadewa_ai/api.py`),
backend memanggilnya lewat `POST /api/v1/rps` dsb seperti API pihak ketiga
biasa. Tidak perlu install Python/RAG stack di server backend.

Kedua jalur ini memakai kode yang **sama persis** di baliknya (`service.py`) —
tinggal pilih pintu masuknya.

## Struktur Proyek

```
sadewa-ai/
├── pyproject.toml         ← Definisi package, dependensi, entry point CLI
├── requirements.txt       ← Alternatif untuk yang belum pakai `pip install -e .`
├── .env.example
├── src/sadewa_ai/         ← Kode aplikasi (installable package)
│   ├── __init__.py        ← Public API: `from sadewa_ai import ...`
│   ├── config.py          ← Settings terpusat (pydantic-settings)
│   ├── schemas.py         ← Skema request/response (pydantic)
│   ├── logging_config.py  ← Setup logging seragam
│   ├── retriever.py       ← Akses ChromaDB (singleton)
│   ├── llm_client.py      ← Klien Qwen + ekstraksi JSON
│   ├── prompts.py         ← Penyusunan prompt
│   ├── validators.py      ← Validasi keluaran LLM (aturan OBE)
│   ├── rag_chain.py       ← Pipeline RAG utama
│   ├── service.py         ← Interface untuk backend engineer (opsi A)
│   ├── api.py              ← Wrapper REST FastAPI (opsi B)
│   ├── ingest.py          ← Bangun knowledge base dari PDF
│   └── cli.py              ← `sadewa-ai health / demo-rps / demo-narasi`
├── tests/
│   ├── test_validators.py
│   ├── test_llm_parsing.py
│   ├── test_schemas.py
│   └── test_api.py
└── docs/                  ← PDF kurikulum (sumber knowledge base)
```

`vectorstore/` (ChromaDB) sengaja tidak masuk repo — dibangun ulang dari PDF
lewat `sadewa-ingest`, lihat bagian Setup.

## Arsitektur Singkat

```
PDF kurikulum
    └─ sadewa-ingest ─→ chunk (500/100) ─→ embedding multilingual ─→ ChromaDB
                                                                          │
Opsi A: import Python ──┐                                               │
Opsi B: POST /api/v1/*  ─┴─→ service.py ─→ rag_chain ─→ retriever ───────┘
                                              │
                                              ├─→ prompts    (susun prompt)
                                              ├─→ llm_client (Qwen + parse JSON)
                                              └─→ validators (cek aturan OBE)
```

## Setup

### 1. Buat virtual environment

```bash
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS / Linux
```

### 2. Install package (mode development)

```bash
# Pemakaian sebagai library saja:
pip install -e .

# Kalau juga mau menjalankan REST API (opsi B) dan/atau menjalankan test:
pip install -e ".[api,dev]"
```

Ini menginstall `sadewa-ai` sebagai package editable — perubahan kode langsung
terpakai tanpa perlu install ulang, dan dua perintah CLI (`sadewa-ai`,
`sadewa-ingest`) langsung tersedia di terminal.

> Belum terbiasa dengan packaging Python? `pip install -r requirements.txt`
> masih bisa dipakai, tapi jalankan modul dengan `python -m sadewa_ai.xxx`,
> bukan `sadewa-ai` (entry point CLI hanya terpasang lewat `pip install -e .`).

### 3. Konfigurasi

```bash
cp .env.example .env
```

Isi `QWEN_API_KEY` di `.env` (dapatkan dari [Alibaba Cloud Model Studio](https://bailian.console.aliyun.com),
Settings → API Key → Create API Key).

### 4. Bangun knowledge base

Taruh PDF kurikulum di folder `docs/`, lalu:

```bash
sadewa-ingest            # atau: python -m sadewa_ai.ingest
sadewa-ingest --reset    # bangun ulang dari nol
```

### 5. Cek semuanya jalan

```bash
sadewa-ai health
sadewa-ai demo-rps
sadewa-ai demo-narasi
```

## Pemakaian — Opsi A: import langsung

```python
from sadewa_ai import generate_rps_service, generate_narasi_service

hasil = generate_rps_service(
    mk_name="Machine Learning",
    sks=3,
    semester="Ganjil",
    prodi="Teknik Komputer",
    deskripsi="Membahas algoritma ML supervised dan unsupervised",
)

if hasil.success:
    print(hasil.data)          # dict RPS, sudah lolos validasi aturan OBE
else:
    print(hasil.error)         # pesan error yang sudah diterjemahkan
```

Dari endpoint FastAPI backend kalian sendiri, pakai varian `*_async` supaya
event loop tidak ikut terblokir selama pemanggilan LLM:

```python
from sadewa_ai import generate_rps_service_async

@router.post("/rps/generate")
async def generate_rps(payload: RpsCreateSchema):
    hasil = await generate_rps_service_async(**payload.model_dump())
    ...
```

Panggil `sadewa_ai.warmup()` sekali di startup event/lifespan backend kalian
supaya model embedding sudah dimuat sebelum request pertama pengguna masuk.

## Pemakaian — Opsi B: REST API

```bash
uvicorn sadewa_ai.api:app --reload --port 8001
```

Dokumentasi interaktif otomatis di `http://localhost:8001/docs` — teman
backend bisa coba-coba endpoint dari browser tanpa baca kode Python sama
sekali.

```bash
curl -X POST http://localhost:8001/api/v1/rps \
  -H "Content-Type: application/json" \
  -d '{"mk_name":"Machine Learning","sks":3,"semester":"Ganjil","prodi":"Teknik Komputer","deskripsi":"..."}'
```

## Testing

```bash
pytest                 # semua test (butuh extra [dev]; test_api.py butuh [api] juga)
pytest tests/test_validators.py -v
```

Seluruh test di sini **tidak** memanggil LLM atau vector store sungguhan —
aman dijalankan tanpa `QWEN_API_KEY` dan tanpa koneksi internet.

## Troubleshooting

- **Proses "menggantung" tanpa error saat memanggil `retrieve_context`/
  `get_vectorstore` pertama kali** — kemungkinan besar model embedding
  memang sedang di-download (bisa beberapa menit tergantung koneksi), bukan
  hang permanen. Beri waktu sebelum Ctrl+C.
- **`QWEN_API_KEY belum diisi`** — buat `.env` dari `.env.example`, isi key.
- **`Folder 'vectorstore' tidak ditemukan`** — jalankan `sadewa-ingest`
  dulu.
- **API key ditolak / akses model ditolak** — periksa apakah key dibuat dari
  workspace/region yang sama dengan `QWEN_BASE_URL` di `.env`.
