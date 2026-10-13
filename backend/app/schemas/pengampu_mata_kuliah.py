from pydantic import BaseModel, model_validator
from app.schemas.common import ORMBaseModel


class PengampuMataKuliahCreate(BaseModel):
    mata_kuliah_id: int
    user_id: int
    is_koordinator: bool = False


class PengampuMataKuliahUpdate(BaseModel):
    is_koordinator: bool


class PengampuMataKuliahResponse(ORMBaseModel):
    id: int
    mata_kuliah_id: int
    user_id: int
    user_nama: str | None = None
    is_koordinator: bool

    @model_validator(mode="before")
    @classmethod
    def _convert(cls, obj):
        # Model menyimpan is_koordinator sebagai string "0"/"1" (bukan boolean asli),
        # jadi dikonversi di sini supaya API-nya tetap bersih memakai bool.
        if hasattr(obj, "is_koordinator"):
            return {
                "id": obj.id,
                "mata_kuliah_id": obj.mata_kuliah_id,
                "user_id": obj.user_id,
                "user_nama": obj.user.nama if obj.user else None,
                "is_koordinator": str(obj.is_koordinator) == "1",
            }
        return obj