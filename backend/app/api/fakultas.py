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


@router.post("", response_model=FakultasResponse)
def create_fakultas(payload: FakultasCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin))):
    row = Fakultas(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{fakultas_id}", response_model=FakultasResponse)
def update_fakultas(fakultas_id: int, payload: FakultasUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin))):
    row = db.query(Fakultas).filter(Fakultas.id == fakultas_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fakultas tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{fakultas_id}")
def delete_fakultas(fakultas_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin))):
    row = db.query(Fakultas).filter(Fakultas.id == fakultas_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fakultas tidak ditemukan")
    db.delete(row)
    db.commit()
    return {"message": "Fakultas dihapus"}