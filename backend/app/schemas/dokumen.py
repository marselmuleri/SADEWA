from datetime import datetime
from typing import Literal
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class DokumenCreate(BaseModel):
    judul: str
    jenis: Literal["RPS", "EVALUASI"]
    konten: str
    mata_kuliah_id: int | None = None
    catatan: str = ""


class DokumenUpdate(BaseModel):
    judul: str | None = None
    konten: str | None = None
    status: Literal["DRAFT", "FINAL"] | None = None
    catatan: str | None = None


class DokumenResponse(ORMBaseModel):
    id: int
    judul: str
    jenis: str
    konten: str
    status: str
    mata_kuliah_id: int | None = None
    program_studi_id: int | None = None
    dibuat_oleh: int
    catatan: str
    dibuat_pada: datetime
    diperbarui_pada: datetime