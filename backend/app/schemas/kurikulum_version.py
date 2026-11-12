from datetime import datetime
from pydantic import BaseModel, model_validator
from app.schemas.common import ORMBaseModel


class KurikulumVersionBase(BaseModel):
    version_label: str | None = None
    versi: str | None = None
    deskripsi: str | None = None
    tahun: int | None = None

    @model_validator(mode="before")
    @classmethod
    def sync_versi_fields(cls, values):
        if isinstance(values, dict):
            # Jika user mengirim 'versi', otomatis petakan ke 'version_label'
            if not values.get("version_label") and values.get("versi"):
                values["version_label"] = values["versi"]
            elif values.get("version_label") and not values.get("versi"):
                values["versi"] = values["version_label"]
        return values


class KurikulumVersionCreate(KurikulumVersionBase):
    pass


class KurikulumVersionResponse(ORMBaseModel):
    id: int
    program_studi_id: int
    version_label: str
    versi: str | None = None
    deskripsi: str | None = None
    tahun: int | None = None
    status: str
    published_at: datetime | None = None
    created_at: datetime
    # True bila versi ini kurikulum yang dipakai Analitik OBE prodinya.
    is_aktif: bool = False
    # True bila kurikulum aktif ditetapkan Admin Prodi (bukan otomatis versi published terbaru).
    aktif_ditetapkan: bool = False

    @model_validator(mode="before")
    @classmethod
    def populate_fields(cls, obj):
        if hasattr(obj, "version_label"):
            from app.services.kurikulum_aktif import pilih_kurikulum_aktif

            aktif, ditetapkan = pilih_kurikulum_aktif(getattr(obj, "program_studi", None))
            status_val = obj.status.value if hasattr(obj.status, "value") else str(obj.status)
            return {
                "id": obj.id,
                "program_studi_id": obj.program_studi_id,
                "version_label": obj.version_label,
                "versi": obj.version_label,
                "deskripsi": getattr(obj, "deskripsi", None),
                "tahun": getattr(obj, "tahun", None),
                "status": status_val,
                "published_at": getattr(obj, "published_at", None),
                "created_at": getattr(obj, "created_at", None),
                "is_aktif": aktif is not None and aktif.id == obj.id,
                "aktif_ditetapkan": ditetapkan,
            }
        return obj


class KurikulumAktifResponse(BaseModel):
    program_studi_id: int
    kurikulum: KurikulumVersionResponse | None = None
    ditetapkan: bool = False
