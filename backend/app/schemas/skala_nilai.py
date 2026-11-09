from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SkalaItem(BaseModel):
    huruf: str = Field(..., min_length=1, max_length=10)
    batas_min: Decimal

    model_config = ConfigDict(from_attributes=True)


class KelompokSkalaItem(BaseModel):
    """Skala huruf untuk satu rentang angkatan. Keduanya kosong = skala bawaan."""
    angkatan_min: Optional[int] = Field(None, ge=1900, le=2200)
    angkatan_max: Optional[int] = Field(None, ge=1900, le=2200)
    skala: List[SkalaItem]


class KelompokSkalaResponse(KelompokSkalaItem):
    label: str


class SkalaNilaiRequest(BaseModel):
    """
    - kelompok: mengganti SELURUH skala kurikulum (semua kelompok angkatan).
    - skala (format lama): hanya mengganti skala bawaan; kelompok angkatan lain tetap.
    """
    skala: Optional[List[SkalaItem]] = None
    kelompok: Optional[List[KelompokSkalaItem]] = None


class SkalaNilaiResponse(BaseModel):
    kurikulum_version_id: int
    skala: List[SkalaItem]  # skala bawaan (kompatibel dengan klien lama)
    kelompok: List[KelompokSkalaResponse] = []
