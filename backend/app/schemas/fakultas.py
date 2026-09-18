from datetime import datetime
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class FakultasBase(BaseModel):
    nama: str
    kode: str


class FakultasCreate(FakultasBase):
    pass


class FakultasUpdate(BaseModel):
    nama: str | None = None
    kode: str | None = None


class FakultasResponse(FakultasBase, ORMBaseModel):
    id: int
    created_at: datetime