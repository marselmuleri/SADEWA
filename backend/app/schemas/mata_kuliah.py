from typing import Literal
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class MataKuliahBase(BaseModel):
    kurikulum_version_id: int
    kode: str
    nama: str
    sks: int
    semester: Literal["Ganjil", "Genap"]
    tahun_ajaran: str
    program_studi_id: int


class MataKuliahCreate(MataKuliahBase):
    pass


class MataKuliahUpdate(BaseModel):
    kode: str | None = None
    nama: str | None = None
    sks: int | None = None
    semester: Literal["Ganjil", "Genap"] | None = None
    tahun_ajaran: str | None = None


class MataKuliahResponse(MataKuliahBase, ORMBaseModel):
    id: int