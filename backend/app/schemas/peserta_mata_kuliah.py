from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class PesertaMataKuliahBase(BaseModel):
    mata_kuliah_id: int
    mahasiswa_id: int
    kelas: str | None = None


class PesertaMataKuliahCreate(PesertaMataKuliahBase):
    pass


class PesertaMataKuliahResponse(PesertaMataKuliahBase, ORMBaseModel):
    id: int