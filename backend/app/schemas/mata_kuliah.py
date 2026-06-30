from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class MataKuliahBase(BaseModel):
    kode_mk: str
    nama_mk: str
    sks: int
    semester: int
    program_studi_id: int
    dosen_id: int | None = None


class MataKuliahCreate(MataKuliahBase):
    pass


class MataKuliahUpdate(BaseModel):
    kode_mk: str | None = None
    nama_mk: str | None = None
    sks: int | None = None
    semester: int | None = None
    program_studi_id: int | None = None
    dosen_id: int | None = None


class MataKuliahResponse(MataKuliahBase, ORMBaseModel):
    id: int
