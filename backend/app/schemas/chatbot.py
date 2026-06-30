from datetime import datetime
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class ChatbotRequest(BaseModel):
    pertanyaan: str
    mahasiswa_id: int | None = None
    mata_kuliah_id: int | None = None


class ChatbotResponse(BaseModel):
    respons: str
    context_yang_digunakan: dict


class RekomendasiLLMResponse(ORMBaseModel):
    id: int
    mahasiswa_id: int | None = None
    pertanyaan: str
    respons_llm: str
    context_data: dict
    created_at: datetime
