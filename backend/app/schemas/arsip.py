from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class ArsipSemesterCreate(BaseModel):
    semester: Literal["Ganjil", "Genap"]
    tahun_ajaran: str = Field(min_length=4, max_length=20, examples=["2025/2026"])


class ArsipRingkas(BaseModel):
    id: int
    program_studi_id: int
    jenis: str
    judul: str
    kurikulum_version_id: int | None = None
    semester: str | None = None
    tahun_ajaran: str | None = None
    ringkasan: dict[str, Any] | None = None
    dibuat_oleh_nama: str | None = None
    created_at: datetime | None = None


class ArsipDetail(ArsipRingkas):
    data: dict[str, Any]
