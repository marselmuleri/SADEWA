from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import allowed_program_ids, get_current_user, require_program_access, require_roles
from app.models.enums import UserRole
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.program_studi import ProgramStudiCreate, ProgramStudiResponse, ProgramStudiUpdate

router = APIRouter()


@router.get("", response_model=list[ProgramStudiResponse])
def list_prodi(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Clients only need their own prodi(s); Super Admin uses the metadata-only panel.
    return db.query(ProgramStudi).filter(ProgramStudi.id.in_(allowed_program_ids(user) or [])).order_by(ProgramStudi.nama.asc()).all()


@router.post("", response_model=ProgramStudiResponse)
def create_prodi(payload: ProgramStudiCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    row = ProgramStudi(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{prodi_id}", response_model=ProgramStudiResponse)
def update_prodi(prodi_id: int, payload: ProgramStudiUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    row = db.query(ProgramStudi).filter(ProgramStudi.id == prodi_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Program studi tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{prodi_id}")
def delete_prodi(prodi_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    row = db.query(ProgramStudi).filter(ProgramStudi.id == prodi_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Program studi tidak ditemukan")
    db.delete(row)
    db.commit()
    return {"message": "Program studi dihapus"}
