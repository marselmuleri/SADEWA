from decimal import Decimal
from pydantic import BaseModel


class CPMKBreakdownItem(BaseModel):
    cpmk_id: int
    kode: str
    rata_rata: Decimal
    jumlah_tercapai: int
    jumlah_peserta: int


class IKBreakdownItemMK(BaseModel):
    ik_id: int
    kode: str
    rata_rata: Decimal


class MataKuliahDashboardResponse(BaseModel):
    mata_kuliah_id: int
    jumlah_peserta: int
    rata_rata_nilai_akhir: Decimal | None = None
    ik_breakdown: list[IKBreakdownItemMK]
    cpmk_breakdown: list[CPMKBreakdownItem]


class CPLOverviewItem(BaseModel):
    cpl_id: int
    kode: str
    deskripsi: str
    rata_rata: Decimal
    threshold: Decimal
    persen_tercapai: float
    jumlah_mahasiswa: int


class IKBreakdownItem(BaseModel):
    ik_id: int
    kode: str
    deskripsi: str
    rata_rata: Decimal
    jumlah_mahasiswa: int


class TrendingItem(BaseModel):
    angkatan: int
    cpl_id: int
    cpl_kode: str
    rata_rata: Decimal