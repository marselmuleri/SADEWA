from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class CPMKBase(BaseModel):
    kode_cpmk: str
    deskripsi: str
    mata_kuliah_id: int
    bobot_ke_cpl: dict[str, float]


class CPMKCreate(CPMKBase):
    pass


class CPMKUpdate(BaseModel):
    kode_cpmk: str | None = None
    deskripsi: str | None = None
    mata_kuliah_id: int | None = None
    bobot_ke_cpl: dict[str, float] | None = None


class CPMKResponse(CPMKBase, ORMBaseModel):
    id: int
