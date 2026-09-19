from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict


class LaporanGenerateRequest(BaseModel):
    semester: Literal["Ganjil", "Genap"]


class LaporanImportNarasiRequest(BaseModel):
    narasi_ids: list[int]


class LaporanUpdate(BaseModel):
    konten: str


class LaporanRejectRequest(BaseModel):
    remarks: str


class LaporanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mata_kuliah_id: int
    dosen_id: int
    semester: str
    konten: str | None = None
    status: str
    sumber_narasi_ids: list[int] | None = None
    submitted_at: datetime | None = None
    validated_by: int | None = None
    validated_at: datetime | None = None
    remarks: str | None = None
    version: int
    created_at: datetime
    updated_at: datetime