from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.user import User
from app.schemas.peserta_mata_kuliah import PesertaMataKuliahCreate, PesertaMataKuliahResponse

router = APIRouter()


@router.post("", response_model=PesertaMataKuliahResponse)
def create(payload: PesertaMataKuliahCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.dosen))):
    data = PesertaMataKuliah(**payload.model_dump())
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[PesertaMataKuliahResponse])
def list_all(mata_kuliah_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(PesertaMataKuliah).filter(PesertaMataKuliah.mata_kuliah_id == mata_kuliah_id).all()