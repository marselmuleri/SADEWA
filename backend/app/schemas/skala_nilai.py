from decimal import Decimal
from typing import List
from pydantic import BaseModel, ConfigDict, Field

class SkalaItem(BaseModel):
    huruf: str = Field(..., min_length=1, max_length=10)
    batas_min: Decimal

    model_config = ConfigDict(from_attributes=True)

class SkalaNilaiRequest(BaseModel):
    skala: List[SkalaItem]

class SkalaNilaiResponse(BaseModel):
    kurikulum_version_id: int
    skala: List[SkalaItem]

