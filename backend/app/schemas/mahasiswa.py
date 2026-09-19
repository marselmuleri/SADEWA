from pydantic import BaseModel
from app.models.enums import StatusMasuk
from app.schemas.common import ORMBaseModel


class MahasiswaBase(BaseModel):
    nim: str
    nama: str
    semester_aktif: int
    status_masuk: StatusMasuk
    program_studi_id: int


class MahasiswaCreate(MahasiswaBase):
    pass


class MahasiswaUpdate(BaseModel):
    nim: str | None = None
    nama: str | None = None
    semester_aktif: int | None = None
    status_masuk: StatusMasuk | None = None
    program_studi_id: int | None = None
    is_active: bool | None = None


class MahasiswaResponse(MahasiswaBase, ORMBaseModel):
    id: int
    is_active: bool