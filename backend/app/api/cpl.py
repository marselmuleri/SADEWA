from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import allowed_program_ids, get_current_user, require_program_access, require_roles
from app.models.enums import UserRole
from app.models.cpl import CPL
from app.models.user import User
from app.schemas.cpl import CPLCreate, CPLResponse, CPLUpdate

router = APIRouter()


@router.post("", response_model=CPLResponse)
def create_cpl(payload: CPLCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    require_program_access(user, payload.program_studi_id)
    data = CPL(**payload.model_dump())
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[CPLResponse])
def list_cpl(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scope = allowed_program_ids(user)
    return db.query(CPL).filter(CPL.program_studi_id.in_(scope or [])).all()


@router.get("/{cpl_id}", response_model=CPLResponse)
def get_cpl(cpl_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data = db.query(CPL).filter(CPL.id == cpl_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    require_program_access(user, data.program_studi_id)
    return data


@router.put("/{cpl_id}", response_model=CPLResponse)
def update_cpl(cpl_id: int, payload: CPLUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    data = db.query(CPL).filter(CPL.id == cpl_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    require_program_access(user, data.program_studi_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{cpl_id}")
def delete_cpl(cpl_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    data = db.query(CPL).filter(CPL.id == cpl_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    require_program_access(user, data.program_studi_id)
    db.delete(data)
    db.commit()
    return {"message": "CPL dihapus"}
