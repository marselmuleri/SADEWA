from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.bentuk_penilaian import BentukPenilaian
from app.models.enums import UserRole
from app.models.jenis_evaluasi import JenisEvaluasi
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.bentuk_penilaian import (
    BentukPenilaianCreate, BentukPenilaianResponse, BentukPenilaianUpdate
)

router = APIRouter()


def _require_prodi_scope(user: User) -> int:
    if not user.program_studi_id:
        raise HTTPException(status_code=400, detail="Akun ini belum terhubung ke Program Studi manapun")
    return user.program_studi_id


@router.post("", response_model=BentukPenilaianResponse)
def create(
    payload: BentukPenilaianCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    prodi_id = _require_prodi_scope(user)
    jenis = db.query(JenisEvaluasi).filter(JenisEvaluasi.id == payload.jenis_evaluasi_id).first()
    if not jenis:
        raise HTTPException(status_code=404, detail="Jenis evaluasi tidak ditemukan")
    if jenis.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Jenis evaluasi ini di luar prodi Anda")

    data = BentukPenilaian(**payload.model_dump())
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[BentukPenilaianResponse])
def list_all(
    jenis_evaluasi_id: int | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(BentukPenilaian).join(JenisEvaluasi)
    if jenis_evaluasi_id:
        query = query.filter(BentukPenilaian.jenis_evaluasi_id == jenis_evaluasi_id)
    if scope.program_studi_id:
        query = query.filter(JenisEvaluasi.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi, JenisEvaluasi.program_studi_id == ProgramStudi.id).filter(
            ProgramStudi.fakultas_id == scope.fakultas_id
        )
    return query.order_by(BentukPenilaian.id.asc()).all()


@router.get("/{id}", response_model=BentukPenilaianResponse)
def get_by_id(
    id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    data = db.query(BentukPenilaian).join(JenisEvaluasi).filter(BentukPenilaian.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Bentuk penilaian tidak ditemukan")
    if scope.program_studi_id and data.jenis_evaluasi.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Bentuk penilaian ini di luar prodi Anda")
    if scope.fakultas_id and data.jenis_evaluasi.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Bentuk penilaian ini di luar fakultas Anda")
    return data


@router.put("/{id}", response_model=BentukPenilaianResponse)
def update(
    id: int,
    payload: BentukPenilaianUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    prodi_id = _require_prodi_scope(user)
    data = db.query(BentukPenilaian).join(JenisEvaluasi).filter(BentukPenilaian.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Bentuk penilaian tidak ditemukan")
    if data.jenis_evaluasi.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh mengubah data di luar prodi Anda")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{id}")
def delete(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    prodi_id = _require_prodi_scope(user)
    data = db.query(BentukPenilaian).join(JenisEvaluasi).filter(BentukPenilaian.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Bentuk penilaian tidak ditemukan")
    if data.jenis_evaluasi.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh menghapus data di luar prodi Anda")

    db.delete(data)
    db.commit()
    return {"message": "Bentuk penilaian berhasil dihapus"}