from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.bentuk_penilaian import BentukPenilaian
from app.models.user import User
from app.schemas.bentuk_penilaian import BentukPenilaianCreate, BentukPenilaianResponse, BentukPenilaianUpdate

router = APIRouter()


@router.post("", response_model=BentukPenilaianResponse)
def create(payload: BentukPenilaianCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin_prodi))):
    data = BentukPenilaian(**payload.model_dump())
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[BentukPenilaianResponse])
def list_all(jenis_evaluasi_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = db.query(BentukPenilaian)
    if jenis_evaluasi_id:
        query = query.filter(BentukPenilaian.jenis_evaluasi_id == jenis_evaluasi_id)
    return query.all()


@router.put("/{id}", response_model=BentukPenilaianResponse)
def update(id: int, payload: BentukPenilaianUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin_prodi))):
    data = db.query(BentukPenilaian).filter(BentukPenilaian.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data