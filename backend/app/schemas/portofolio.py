from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PortofolioMataKuliahItem(BaseModel):
    id: int
    kode: str | None = None
    nama: str | None = None
    sks: int | None = None
    semester: str | None = None
    tahun_ajaran: str | None = None
    program_studi_id: int | None = None
    program_studi_nama: str | None = None
    pengampu: list[str] = []
    jumlah_peserta: int = 0
    jumlah_dinilai: int = 0
    jumlah_rps: int = 0
    jumlah_lampiran: int = 0
    jumlah_rpp: int = 0
    is_pengampu: bool = False


class BerkasResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mata_kuliah_id: int
    jenis: str
    judul: str
    keterangan: str | None = None
    nama_file: str
    content_type: str | None = None
    ukuran: int
    uploaded_by: int | None = None
    uploader_nama: str | None = None
    created_at: datetime | None = None


class RPPItem(BaseModel):
    pertemuan_ke: int = Field(ge=1, le=32)
    tanggal: date | None = None
    cpmk: str | None = Field(default=None, max_length=100)
    materi: str | None = None
    metode: str | None = None
    waktu: str | None = Field(default=None, max_length=100)
    pengalaman_belajar: str | None = None
    indikator_kriteria: str | None = None
    realisasi: str | None = None
    catatan: str | None = None

    @field_validator("tanggal", mode="before")
    @classmethod
    def kosong_jadi_none(cls, v):
        return None if v == "" else v


class RPPUpdate(BaseModel):
    pertemuan: list[RPPItem]


class PortofolioInfoData(BaseModel):
    """Isian cover & kontrak perkuliahan portofolio satu mata kuliah."""
    model_config = ConfigDict(from_attributes=True)

    no_dokumen: str | None = Field(default=None, max_length=150)
    revisi: str | None = Field(default=None, max_length=100)
    tanggal_terbit: date | None = None
    prasyarat: str | None = Field(default=None, max_length=255)
    manfaat: str | None = None
    deskripsi: str | None = None
    strategi: str | None = None
    tata_tertib: str | None = None
    waktu_tempat: str | None = None
    referensi: str | None = None

    @field_validator("tanggal_terbit", mode="before")
    @classmethod
    def kosong_jadi_none(cls, v):
        return None if v == "" else v


class EvaluasiItemUpdate(BaseModel):
    cpmk_id: int
    analisis: str | None = None
    rencana_perbaikan: str | None = None


class EvaluasiUpdate(BaseModel):
    items: list[EvaluasiItemUpdate]


class RPPResponse(BaseModel):
    pertemuan: list[RPPItem]
    updated_at: datetime | None = None
