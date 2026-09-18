from decimal import Decimal
from typing import Literal
from pydantic import BaseModel


class NilaiRecordIn(BaseModel):
    peserta_mata_kuliah_id: int
    mk_bentuk_penilaian_id: int
    nilai: Decimal


class NilaiManualInput(BaseModel):
    mk_id: int
    semester: Literal["Ganjil", "Genap"]
    records: list[NilaiRecordIn]


class NilaiResponse(BaseModel):
    id: int
    peserta_mata_kuliah_id: int
    mk_bentuk_penilaian_id: int
    nilai: Decimal
    source: str

    class Config:
        from_attributes = True


class NilaiUpdate(BaseModel):
    nilai: Decimal