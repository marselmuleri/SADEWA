from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.fakultas import Fakultas
from app.models.user import User
from app.schemas.fakultas import FakultasCreate, FakultasResponse, FakultasUpdate

router = APIRouter()


@router.get("", response_model=list[FakultasResponse])
def list_fakultas(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Fakultas).order_by(Fakultas.nama.asc()).all()


@router.get("/{fakultas_id}", response_model=FakultasResponse)
def get_fakultas(fakultas_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.query(Fakultas).filter(Fakultas.id == fakultas_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fakultas tidak ditemukan")
    return row


@router.post("", response_model=FakultasResponse)
def create_fakultas(payload: FakultasCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    existing = db.query(Fakultas).filter(Fakultas.kode == payload.kode).first()
    if existing:
        raise HTTPException(status_code=400, detail="Kode fakultas sudah dipakai")
    row = Fakultas(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{fakultas_id}", response_model=FakultasResponse)
def update_fakultas(fakultas_id: int, payload: FakultasUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    row = db.query(Fakultas).filter(Fakultas.id == fakultas_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fakultas tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{fakultas_id}")
def delete_fakultas(fakultas_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    row = db.query(Fakultas).filter(Fakultas.id == fakultas_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fakultas tidak ditemukan")
    if row.program_studi:
        raise HTTPException(
            status_code=400,
            detail="Fakultas masih memiliki Program Studi. Hapus atau pindahkan Program Studi-nya dulu.",
        )
    if row.users:
        raise HTTPException(
            status_code=400,
            detail="Fakultas masih memiliki akun Dekan yang terhubung. Nonaktifkan/pindahkan akun itu dulu.",
        )
    db.delete(row)
    db.commit()
    return {"message": "Fakultas dihapus"}