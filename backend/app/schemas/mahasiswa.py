from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class MahasiswaBase(BaseModel):
    nim: str
    nama: str
    angkatan: int
    program_studi_id: int


class MahasiswaCreate(MahasiswaBase):
    pass


class MahasiswaUpdate(BaseModel):
    nim: str | None = None
    nama: str | None = None
    angkatan: int | None = None
    program_studi_id: int | None = None
    is_active: bool | None = None


class MahasiswaResponse(MahasiswaBase, ORMBaseModel):
    id: int
    is_active: bool
