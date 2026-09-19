from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.jenis_evaluasi import JenisEvaluasi
from app.models.user import User
from app.schemas.jenis_evaluasi import JenisEvaluasiCreate, JenisEvaluasiResponse, JenisEvaluasiUpdate

router = APIRouter()


@router.post("", response_model=JenisEvaluasiResponse)
def create(payload: JenisEvaluasiCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin_prodi))):
    data = JenisEvaluasi(**payload.model_dump())
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[JenisEvaluasiResponse])
def list_all(program_studi_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = db.query(JenisEvaluasi)
    if program_studi_id:
        query = query.filter(JenisEvaluasi.program_studi_id == program_studi_id)
    return query.order_by(JenisEvaluasi.urutan.asc().nulls_last()).all()


@router.put("/{id}", response_model=JenisEvaluasiResponse)
def update(id: int, payload: JenisEvaluasiUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin_prodi))):
    data = db.query(JenisEvaluasi).filter(JenisEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data