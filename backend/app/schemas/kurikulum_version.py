from datetime import datetime
from typing import Literal
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class KurikulumVersionBase(BaseModel):
    version_label: str
    semester: Literal["Ganjil", "Genap"]


class KurikulumVersionCreate(KurikulumVersionBase):
    pass


class KurikulumVersionResponse(KurikulumVersionBase, ORMBaseModel):
    id: int
    program_studi_id: int
    status: str
    published_at: datetime | None = None
    created_at: datetime