from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class BentukPenilaianBase(BaseModel):
    jenis_evaluasi_id: int
    nama: str


class BentukPenilaianCreate(BentukPenilaianBase):
    pass


class BentukPenilaianUpdate(BaseModel):
    nama: str | None = None


class BentukPenilaianResponse(BentukPenilaianBase, ORMBaseModel):
    id: int