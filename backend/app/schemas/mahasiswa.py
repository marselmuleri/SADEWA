from pydantic import BaseModel
from app.models.enums import StatusMasuk
from app.schemas.common import ORMBaseModel


class MahasiswaBase(BaseModel):
    nim: str
    nama: str
    semester_aktif: int
    status_masuk: StatusMasuk
    angkatan: int | None = None


class MahasiswaCreate(MahasiswaBase):
    pass


class MahasiswaBatchCreate(BaseModel):
    records: list[MahasiswaCreate]


class MahasiswaUpdate(BaseModel):
    nim: str | None = None
    nama: str | None = None
    semester_aktif: int | None = None
    status_masuk: StatusMasuk | None = None
    angkatan: int | None = None
    is_active: bool | None = None


class MahasiswaResponse(MahasiswaBase, ORMBaseModel):
    id: int
    program_studi_id: int
    is_active: bool