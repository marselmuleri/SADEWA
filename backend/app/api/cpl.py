from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, get_current_user, get_scoped_prodi_id
from app.models.cpl import CPL
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.cpl import CPLCreate, CPLResponse, CPLThresholdUpdate, CPLUpdate

router = APIRouter()


@router.get("", response_model=list[CPLResponse])
def list_cpl(
    kurikulum_version_id: int | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(CPL)
    if kurikulum_version_id:
        query = query.filter(CPL.kurikulum_version_id == kurikulum_version_id)
    if scope.program_studi_id:
        query = query.filter(CPL.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.order_by(CPL.kode.asc()).all()


@router.get("/{cpl_id}", response_model=CPLResponse)
def get_cpl(cpl_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    data = db.query(CPL).filter(CPL.id == cpl_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    if scope.program_studi_id and data.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="CPL ini di luar prodi Anda")
    if scope.fakultas_id and data.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="CPL ini di luar fakultas Anda")
    return data


@router.post("", response_model=CPLResponse)
def create_cpl(
    payload: CPLCreate,
    db: Session = Depends(get_db),
    prodi_id: int = Depends(get_scoped_prodi_id),
    user: User = Depends(get_current_user),
):
    data = CPL(**{**payload.model_dump(), "program_studi_id": prodi_id}, created_by=user.id)
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.put("/{cpl_id}", response_model=CPLResponse)
def update_cpl(
    cpl_id: int,
    payload: CPLUpdate,
    db: Session = Depends(get_db),
    prodi_id: int = Depends(get_scoped_prodi_id),
):
    data = db.query(CPL).filter(CPL.id == cpl_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh mengubah CPL di luar prodi Anda")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.put("/{cpl_id}/threshold", response_model=CPLResponse)
def update_threshold(
    cpl_id: int,
    payload: CPLThresholdUpdate,
    db: Session = Depends(get_db),
    prodi_id: int = Depends(get_scoped_prodi_id),
):
    data = db.query(CPL).filter(CPL.id == cpl_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh mengubah CPL di luar prodi Anda")
    data.threshold_capaian = payload.threshold_capaian
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{cpl_id}")
def delete_cpl(
    cpl_id: int,
    db: Session = Depends(get_db),
    prodi_id: int = Depends(get_scoped_prodi_id),
):
    data = db.query(CPL).filter(CPL.id == cpl_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh menghapus CPL di luar prodi Anda")
    db.delete(data)
    db.commit()
    return {"message": "CPL dihapus"}