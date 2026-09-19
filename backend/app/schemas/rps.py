from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict


class RPSGenerateRequest(BaseModel):
    tahun_ajaran: str
    semester: Literal["Ganjil", "Genap"]
    topik: str | None = None


class RPSResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mata_kuliah_id: int
    tahun_ajaran: str
    semester: str
    status: str
    sumber_dokumen_rag: dict | list | None = None
    created_at: datetime