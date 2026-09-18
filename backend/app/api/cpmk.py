from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import allowed_program_ids, get_current_user, require_program_access, require_roles
from app.models.enums import UserRole
from app.models.cpmk import CPMK
from app.models.mata_kuliah import MataKuliah
from app.models.user import User
from app.schemas.cpmk import CPMKCreate, CPMKResponse, CPMKUpdate

router = APIRouter()


@router.post("", response_model=CPMKResponse)
def create_cpmk(payload: CPMKCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    course = db.get(MataKuliah, payload.mata_kuliah_id)
    if not course: raise HTTPException(404, detail="Mata kuliah tidak ditemukan")
    require_program_access(user, course.program_studi_id)
    data = CPMK(**payload.model_dump())
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[CPMKResponse])
def list_cpmk(mk_id: int | None = Query(default=None), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(CPMK).join(MataKuliah).filter(MataKuliah.program_studi_id.in_(allowed_program_ids(user) or []))
    if mk_id:
        query = query.filter(CPMK.mata_kuliah_id == mk_id)
    return query.all()


@router.get("/{cpmk_id}", response_model=CPMKResponse)
def get_cpmk(cpmk_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data = db.query(CPMK).filter(CPMK.id == cpmk_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPMK tidak ditemukan")
    require_program_access(user, data.mata_kuliah.program_studi_id)
    return data


@router.put("/{cpmk_id}", response_model=CPMKResponse)
def update_cpmk(cpmk_id: int, payload: CPMKUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    data = db.query(CPMK).filter(CPMK.id == cpmk_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPMK tidak ditemukan")
    require_program_access(user, data.mata_kuliah.program_studi_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{cpmk_id}")
def delete_cpmk(cpmk_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    data = db.query(CPMK).filter(CPMK.id == cpmk_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPMK tidak ditemukan")
    require_program_access(user, data.mata_kuliah.program_studi_id)
    db.delete(data)
    db.commit()
    return {"message": "CPMK dihapus"}
