from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class RangeNilaiCPLItem(BaseModel):
    nama: str
    batas_bawah: float
    batas_atas: float
    warna: Optional[str] = None
    keterangan: Optional[str] = None


class RangeNilaiCPLBatchRequest(BaseModel):
    ranges: List[RangeNilaiCPLItem]


class RangeNilaiCPLResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    program_studi_id: int
    nama: str
    batas_bawah: float
    batas_atas: float
    warna: Optional[str] = None
    keterangan: Optional[str] = None

