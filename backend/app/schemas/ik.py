from datetime import datetime
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class IKBase(BaseModel):
    cpl_id: int
    kode: str
    deskripsi: str
    urutan: int | None = None


class IKCreate(IKBase):
    pass


class IKUpdate(BaseModel):
    kode: str | None = None
    deskripsi: str | None = None
    urutan: int | None = None


class IKResponse(IKBase, ORMBaseModel):
    id: int
    created_at: datetime