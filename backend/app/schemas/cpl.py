from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class CPLBase(BaseModel):
    kurikulum_version_id: int
    kode: str
    deskripsi: str
    program_studi_id: int
    threshold_capaian: Decimal = Decimal("70.0")


class CPLCreate(CPLBase):
    pass


class CPLUpdate(BaseModel):
    kode: str | None = None
    deskripsi: str | None = None


class CPLThresholdUpdate(BaseModel):
    threshold_capaian: Decimal


class CPLResponse(CPLBase, ORMBaseModel):
    id: int
    created_at: datetime