from datetime import datetime
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class ProgramStudiBase(BaseModel):
    nama: str
    kode: str
    jenjang: str


class ProgramStudiCreate(ProgramStudiBase):
    pass


class ProgramStudiUpdate(BaseModel):
    nama: str | None = None
    kode: str | None = None
    jenjang: str | None = None


class ProgramStudiResponse(ProgramStudiBase, ORMBaseModel):
    id: int
    created_at: datetime
