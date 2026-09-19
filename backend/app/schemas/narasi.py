from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict


class NarasiGenerateRequest(BaseModel):
    tipe: Literal["rekomendasi_umum", "per_mahasiswa"]
    peserta_mata_kuliah_id: int | None = None


class NarasiUpdate(BaseModel):
    konten: str


class NarasiResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mata_kuliah_id: int
    peserta_mata_kuliah_id: int | None = None
    tipe: str
    konten: str
    status: str
    created_at: datetime
    updated_at: datetime