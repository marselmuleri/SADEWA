from pydantic import BaseModel
from app.models.enums import JenisPenilaian
from app.schemas.common import ORMBaseModel


class PenilaianBase(BaseModel):
    mahasiswa_id: int
    mata_kuliah_id: int
    cpmk_id: int
    jenis: JenisPenilaian
    nilai: float
    semester: str
    tahun_akademik: str


class PenilaianCreate(PenilaianBase):
    pass


class PenilaianUpdate(BaseModel):
    mahasiswa_id: int | None = None
    mata_kuliah_id: int | None = None
    cpmk_id: int | None = None
    jenis: JenisPenilaian | None = None
    nilai: float | None = None
    semester: str | None = None
    tahun_akademik: str | None = None


class PenilaianResponse(PenilaianBase, ORMBaseModel):
    id: int


class PenilaianImportRow(BaseModel):
    mahasiswa_id: int
    mata_kuliah_id: int
    cpmk_id: int
    jenis: JenisPenilaian
    nilai: float
    semester: str
    tahun_akademik: str
