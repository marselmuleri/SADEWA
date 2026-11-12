from decimal import Decimal
from pydantic import BaseModel


class ValidasiBobotRequest(BaseModel):
    mata_kuliah_id: int


class ValidasiBobotResponse(BaseModel):
    valid: bool
    warnings: list[str] = []


class IKResultItem(BaseModel):
    ik_id: int
    nilai: Decimal


class KalkulasiRunResponse(BaseModel):
    mata_kuliah_id: int
    jumlah_peserta_diproses: int
    # Peserta yang nilai akhirnya sudah final: capaian tetap dihitung, nilai akhir tidak ditimpa
    jumlah_nilai_final_dilewati: int = 0
    ik_results_sample: list[IKResultItem] = []