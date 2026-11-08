from decimal import Decimal
from pydantic import BaseModel


class HasilEvaluasiItem(BaseModel):
    mata_kuliah_id: int
    mata_kuliah_nama: str
    nilai_akhir: Decimal | None = None
    nilai_huruf: str | None = None
    status_outcome: str | None = None


class CPMKAchievementItem(BaseModel):
    cpmk_id: int
    cpmk_kode: str
    mata_kuliah_id: int
    mata_kuliah_nama: str
    nilai: Decimal
    status_tercapai: bool


class IKAchievementItem(BaseModel):
    ik_id: int
    ik_kode: str
    mata_kuliah_id: int
    mata_kuliah_nama: str
    semester: str | None = None
    nilai: Decimal


class CPLAchievementItem(BaseModel):
    """Capaian CPL pada satu mata kuliah (mata_kuliah_id None = data lama sebelum per-MK)."""
    cpl_id: int
    cpl_kode: str
    mata_kuliah_id: int | None = None
    mata_kuliah_nama: str | None = None
    semester: str | None = None
    angkatan: int | None = None
    nilai: Decimal
    bobot_cp: Decimal | None = None


class CPLGabunganItem(BaseModel):
    """Capaian CPL gabungan lintas mata kuliah: Σ(nilai × bobot_cp) / Σ bobot_cp."""
    cpl_id: int
    cpl_kode: str
    nilai: Decimal
    jumlah_mata_kuliah: int


class RaporMahasiswaResponse(BaseModel):
    mahasiswa_id: int
    nim: str
    nama: str
    hasil_evaluasi: list[HasilEvaluasiItem]
    cpmk_achievement: list[CPMKAchievementItem]
    ik_achievement: list[IKAchievementItem]
    cpl_achievement: list[CPLAchievementItem]
    # Kosong untuk Dosen: gabungan memuat mata kuliah yang tidak diampu.
    cpl_gabungan: list[CPLGabunganItem] = []