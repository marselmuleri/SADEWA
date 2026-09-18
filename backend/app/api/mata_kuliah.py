from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import allowed_program_ids, get_current_user, require_program_access, require_roles
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.user import User
from app.schemas.mata_kuliah import MataKuliahCreate, MataKuliahResponse, MataKuliahUpdate

router = APIRouter()


@router.post("", response_model=MataKuliahResponse)
def create_mata_kuliah(payload: MataKuliahCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    require_program_access(user, payload.program_studi_id)
    data = MataKuliah(**payload.model_dump())
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[MataKuliahResponse])
def list_mata_kuliah(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(MataKuliah).filter(MataKuliah.program_studi_id.in_(allowed_program_ids(user) or [])).all()


@router.get("/{mata_kuliah_id}", response_model=MataKuliahResponse)
def get_mata_kuliah(mata_kuliah_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    require_program_access(user, data.program_studi_id)
    return data


@router.put("/{mata_kuliah_id}", response_model=MataKuliahResponse)
def update_mata_kuliah(mata_kuliah_id: int, payload: MataKuliahUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    data = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    require_program_access(user, data.program_studi_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{mata_kuliah_id}")
def delete_mata_kuliah(mata_kuliah_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    data = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    require_program_access(user, data.program_studi_id)
    db.delete(data)
    db.commit()
    return {"message": "Mata kuliah dihapus"}
