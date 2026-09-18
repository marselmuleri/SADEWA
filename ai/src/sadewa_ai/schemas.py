"""
Skema Pydantic untuk input/output modul AI SADEWA.

Dipakai di tiga tempat sekaligus supaya bentuknya selalu konsisten:
  1. `service.py`  — validasi input sebelum masuk ke pipeline RAG.
  2. `api.py`       — request/response body FastAPI (otomatis muncul di /docs).
  3. Teman satu tim — cukup baca kelas di file ini untuk tahu persis field apa
     yang wajib dikirim dan bentuk apa yang akan diterima balik, tanpa perlu
     baca isi rag_chain.py.

Ini menggantikan validasi manual (`if not x: return "pesan error"`) yang ada
di versi sebelumnya. Keuntungannya: pesan error field-per-field otomatis,
konsisten, dan tidak bisa "lupa dicek" di satu tempat tapi lupa di tempat lain.
"""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from .config import settings


# --- Generate RPS ------------------------------------------------------------


class RPSRequest(BaseModel):
    """Input untuk pembangkitan draf RPS."""

    mk_name: str = Field(..., min_length=1, description="Nama mata kuliah")
    sks: int = Field(..., description="Jumlah SKS")
    semester: Literal["Ganjil", "Genap"]
    prodi: str = Field(..., min_length=1, description="Nama program studi")
    deskripsi: str = Field("", description="Deskripsi singkat mata kuliah (opsional)")

    @field_validator("mk_name", "prodi")
    @classmethod
    def _tidak_boleh_kosong_setelah_strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("tidak boleh kosong atau hanya berisi spasi")
        return v

    @field_validator("sks")
    @classmethod
    def _sks_harus_valid(cls, v: int) -> int:
        if v not in settings.sks_valid:
            raise ValueError(f"SKS tidak valid: {v}. Pilihan yang diterima: {list(settings.sks_valid)}")
        return v


class Pertemuan(BaseModel):
    minggu: int
    cpmk: str
    sub_cpmk: str
    materi: str
    metode: str
    bobot: float


class CapaianPembelajaran(BaseModel):
    kode: str
    deskripsi: str


class RPSData(BaseModel):
    """Bentuk JSON RPS hasil generasi LLM, setelah lolos parsing."""

    kode_mk: str
    deskripsi_mk: str
    cpl: List[CapaianPembelajaran]
    cpmk: List[CapaianPembelajaran]
    pertemuan: List[Pertemuan]


# --- Narasi evaluasi kurikulum -------------------------------------------------


class CapaianItem(BaseModel):
    """Satu baris data ketercapaian CPL/CPMK, dikirim oleh backend."""

    kode: str
    deskripsi: str = ""
    nilai_rata_rata: float
    jumlah_mahasiswa: Optional[int] = None
    jumlah_tercapai: Optional[int] = None


class NarasiRequest(BaseModel):
    """Input untuk pembangkitan laporan narasi evaluasi (endpoint SADEWA-21)."""

    mk_name: str = Field(..., min_length=1)
    prodi: str = Field(..., min_length=1)
    semester: Literal["Ganjil", "Genap"]
    tahun_ajaran: str = Field(..., min_length=1, examples=["2025/2026"])
    capaian: List[CapaianItem] = Field(..., min_length=1)

    @field_validator("mk_name", "prodi", "tahun_ajaran")
    @classmethod
    def _tidak_boleh_kosong_setelah_strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("tidak boleh kosong atau hanya berisi spasi")
        return v


class AnalisisCPL(BaseModel):
    kode: str
    status: Literal["Tercapai", "Belum Tercapai"]
    analisis: str


class RekomendasiIntervensi(BaseModel):
    sasaran: str
    tindakan: str
    prioritas: Literal["Tinggi", "Sedang", "Rendah"]


class NarasiData(BaseModel):
    """Bentuk JSON laporan narasi hasil generasi LLM, setelah lolos parsing."""

    ringkasan_capaian: str
    analisis_cpl: List[AnalisisCPL]
    faktor_penyebab: List[str]
    rekomendasi_intervensi: List[RekomendasiIntervensi]
    kesimpulan: str


# --- Respons seragam -----------------------------------------------------------


class AIResponse(BaseModel):
    """Bentuk respons seragam untuk seluruh layanan AI SADEWA."""

    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    duration_seconds: float = 0.0
    warnings: List[str] = Field(default_factory=list)


class HealthStatus(BaseModel):
    """Status kesiapan modul AI, dipakai endpoint /health."""

    api_key_terisi: bool
    model: str
    base_url: str
    jumlah_chunk: int
    vectorstore_siap: bool
