from decimal import Decimal
from typing import Literal
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class MKBentukPenilaianBase(BaseModel):
    mata_kuliah_id: int
    bentuk_penilaian_id: int
    bobot: Decimal
    semester: Literal["Ganjil", "Genap"]


class MKBentukPenilaianCreate(MKBentukPenilaianBase):
    pass


class MKBentukPenilaianUpdate(BaseModel):
    bobot: Decimal | None = None


class MKBentukPenilaianResponse(MKBentukPenilaianBase, ORMBaseModel):
    id: int


class IKMapItem(BaseModel):
    ik_id: int
    bobot: Decimal


class MKBentukPenilaianMapIKRequest(BaseModel):
    mappings: list[IKMapItem]