"""
Aturan penilaian per program studi: ambang tercapai/lulus, target Evaluasi CPMK,
dan Ketua GPM untuk cover portofolio. Rubrik skala memakai Range Nilai CPL prodi.

Baca: Admin Prodi, Kaprodi, Dosen (prodi sendiri), Dekan (prodi di fakultasnya).
Ubah: Admin Prodi & Kaprodi (prodi sendiri).
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.aturan_penilaian import AturanPenilaianProdi
from app.models.enums import UserRole
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.services.portofolio_aturan import aturan_prodi

router = APIRouter()


class AturanUpdate(BaseModel):
    ambang: float = Field(..., ge=0, le=100)
    target_rerata_skala: float = Field(..., gt=0, le=10)
    target_persen: float = Field(..., ge=0, le=100)
    gpm_nama: str | None = Field(None, max_length=255)
    gpm_nip: str | None = Field(None, max_length=100)


def _respons(db: Session, prodi_id: int) -> dict:
    a = aturan_prodi(db, prodi_id)
    return {
        "program_studi_id": prodi_id,
        "ambang": a.ambang_cpmk,
        "target_rerata_skala": a.target_rerata_skala,
        "target_persen": a.target_persen,
        "gpm_nama": a.gpm_nama,
        "gpm_nip": a.gpm_nip,
        "tersimpan": a.tersimpan,
        "skala_maks": a.skor_maks,
        "rubrik": [{"nama": t.nama, "batas_bawah": t.batas_bawah, "skor": t.skor} for t in a.rubrik],
        "rubrik_bawaan": a.rubrik_bawaan,
    }


@router.get("")
def lihat_aturan(
    program_studi_id: int | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    if scope.fakultas_id:
        if not program_studi_id:
            raise HTTPException(status_code=400, detail="program_studi_id wajib diisi")
        prodi = db.query(ProgramStudi).filter(ProgramStudi.id == program_studi_id).first()
        if not prodi or prodi.fakultas_id != scope.fakultas_id:
            raise HTTPException(status_code=403, detail="Program Studi ini di luar fakultas Anda")
        return _respons(db, program_studi_id)
    if not scope.program_studi_id:
        raise HTTPException(status_code=400, detail="Akun ini belum terhubung ke Program Studi manapun")
    return _respons(db, scope.program_studi_id)


@router.put("")
def simpan_aturan(
    payload: AturanUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi)),
):
    prodi_id = user.program_studi_id
    if not prodi_id:
        raise HTTPException(status_code=400, detail="Akun ini belum terhubung ke Program Studi manapun")
    skala_maks = aturan_prodi(db, prodi_id).skor_maks
    if skala_maks and payload.target_rerata_skala > skala_maks:
        raise HTTPException(
            status_code=400,
            detail=f"Target rerata skor tidak boleh melebihi skor tertinggi rubrik ({skala_maks})",
        )

    baris = db.query(AturanPenilaianProdi).filter(AturanPenilaianProdi.program_studi_id == prodi_id).first()
    if baris is None:
        baris = AturanPenilaianProdi(program_studi_id=prodi_id)
        db.add(baris)
    baris.ambang = Decimal(str(payload.ambang))
    baris.target_rerata_skala = Decimal(str(payload.target_rerata_skala))
    baris.target_persen = Decimal(str(payload.target_persen))
    baris.gpm_nama = (payload.gpm_nama or "").strip() or None
    baris.gpm_nip = (payload.gpm_nip or "").strip() or None
    baris.updated_by = user.id
    db.commit()
    return _respons(db, prodi_id)
