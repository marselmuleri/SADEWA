from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class JenisEvaluasiBase(BaseModel):
    nama: str
    urutan: int | None = None


class JenisEvaluasiCreate(JenisEvaluasiBase):
    pass


class JenisEvaluasiUpdate(BaseModel):
    nama: str | None = None
    urutan: int | None = None


class JenisEvaluasiResponse(JenisEvaluasiBase, ORMBaseModel):
    id: int
    program_studi_id: int