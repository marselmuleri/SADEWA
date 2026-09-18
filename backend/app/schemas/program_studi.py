from datetime import datetime
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class ProgramStudiBase(BaseModel):
    nama: str
    kode: str
    fakultas_id: int


class ProgramStudiCreate(ProgramStudiBase):
    pass


class ProgramStudiUpdate(BaseModel):
    nama: str | None = None
    kode: str | None = None
    fakultas_id: int | None = None


class ProgramStudiResponse(ProgramStudiBase, ORMBaseModel):
    id: int
    created_at: datetime