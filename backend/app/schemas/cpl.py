from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class CPLBase(BaseModel):
    kode_cpl: str
    deskripsi: str
    program_studi_id: int


class CPLCreate(CPLBase):
    pass


class CPLUpdate(BaseModel):
    kode_cpl: str | None = None
    deskripsi: str | None = None
    program_studi_id: int | None = None


class CPLResponse(CPLBase, ORMBaseModel):
    id: int
