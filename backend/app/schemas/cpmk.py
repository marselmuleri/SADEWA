from decimal import Decimal
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class CPMKBase(BaseModel):
    mata_kuliah_id: int
    kode: str
    deskripsi: str
    level_taksonomi: str
    bobot: Decimal


class CPMKCreate(CPMKBase):
    pass


class CPMKUpdate(BaseModel):
    kode: str | None = None
    deskripsi: str | None = None
    level_taksonomi: str | None = None
    bobot: Decimal | None = None


class CPMKResponse(CPMKBase, ORMBaseModel):
    id: int


class IKMapItem(BaseModel):
    ik_id: int
    bobot: Decimal


class CPMKMapIKRequest(BaseModel):
    mappings: list[IKMapItem]