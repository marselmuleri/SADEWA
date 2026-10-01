from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class NarasiGenerateRequest(BaseModel):
    """
    Schema input untuk endpoint pembangkitan narasi evaluasi RAG.
    Menerima transkrip wawancara, dokumen evaluasi, serta data capaian pembelajaran.
    """
    tipe: Literal["rekomendasi_umum", "per_mahasiswa"] = Field(
        default="rekomendasi_umum",
        description="Jenis evaluasi yang dibangkitkan"
    )
    peserta_mata_kuliah_id: Optional[int] = Field(
        default=None,
        description="ID peserta mata kuliah jika tipe=per_mahasiswa"
    )
    transkrip_wawancara: Optional[str] = Field(
        default=None,
        description="Transkrip wawancara akademik dosen/mahasiswa/evaluator"
    )
    dokumen_evaluasi: Optional[str] = Field(
        default=None,
        description="Teks dokumen evaluasi kurikulum atau catatan borang"
    )
    capaian: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Daftar capaian nilai/CPL/CPMK dari kalkulasi backend"
    )


class NarasiGenerateRequest(BaseModel):
    tipe: Literal["rekomendasi_umum", "per_mahasiswa"]
    peserta_mata_kuliah_id: int | None = None


class NarasiUpdate(BaseModel):
    konten: str


class NarasiResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mata_kuliah_id: int
    peserta_mata_kuliah_id: Optional[int] = None
    tipe: str
    konten: str
    status: str
    created_at: datetime
    updated_at: datetime