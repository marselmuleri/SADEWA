from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class NilaiRecordIn(BaseModel):
    peserta_mata_kuliah_id: int
    mk_bentuk_penilaian_id: int
    ik_id: Optional[int] = None
    nilai: Decimal = Field(..., ge=0, le=100)


class NilaiManualInput(BaseModel):
    mk_id: int
    semester: Literal["Ganjil", "Genap"]
    records: list[NilaiRecordIn]


class NilaiResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    peserta_mata_kuliah_id: int
    mk_bentuk_penilaian_id: int
    ik_id: Optional[int] = None
    nilai: Decimal
    source: str


class NilaiUpdate(BaseModel):
    nilai: Decimal = Field(..., ge=0, le=100)


class SyncLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mata_kuliah_id: int
    semester: str
    status: str
    total_records: int
    created_at: datetime