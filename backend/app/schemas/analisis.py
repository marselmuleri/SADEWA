from datetime import datetime
from pydantic import BaseModel
from app.schemas.common import ORMBaseModel


class PrediksiRequest(BaseModel):
    mahasiswa_id: int
    mata_kuliah_id: int
    cpl_id: int


class PrediksiResponse(BaseModel):
    probabilitas_lulus: float
    probabilitas_gagal: float
    prediksi: str
    feature_importance: dict[str, float]
    rekomendasi_singkat: str


class HasilPrediksiResponse(ORMBaseModel):
    id: int
    mahasiswa_id: int
    cpl_id: int
    mata_kuliah_id: int
    probabilitas_lulus: float
    probabilitas_gagal: float
    prediksi: str
    feature_importance: dict[str, float]
    created_at: datetime
