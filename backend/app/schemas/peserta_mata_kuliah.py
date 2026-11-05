from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class PesertaMataKuliahBase(BaseModel):
    mata_kuliah_id: int
    mahasiswa_id: int
    kelas: str | None = None


class PesertaMataKuliahCreate(PesertaMataKuliahBase):
    pass


class PesertaMataKuliahBatchItem(BaseModel):
    mahasiswa_id: int
    kelas: str | None = None


class PesertaMataKuliahBatchCreate(BaseModel):
    mata_kuliah_id: int
    records: list[PesertaMataKuliahBatchItem]


class PesertaMataKuliahResponse(PesertaMataKuliahBase, ORMBaseModel):
    id: int