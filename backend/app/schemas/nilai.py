from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict


class NilaiRecordIn(BaseModel):
    peserta_mata_kuliah_id: int
    mk_bentuk_penilaian_id: int
    nilai: Decimal


class NilaiManualInput(BaseModel):
    mk_id: int
    semester: Literal["Ganjil", "Genap"]
    records: list[NilaiRecordIn]


class NilaiResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    peserta_mata_kuliah_id: int
    mk_bentuk_penilaian_id: int
    nilai: Decimal
    source: str


class NilaiUpdate(BaseModel):
    nilai: Decimal


class SyncLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mata_kuliah_id: int
    semester: str
    status: str
    total_records: int
    created_at: datetime