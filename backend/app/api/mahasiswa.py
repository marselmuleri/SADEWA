from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.mahasiswa import Mahasiswa
from app.models.user import User
from app.schemas.mahasiswa import MahasiswaCreate, MahasiswaResponse, MahasiswaUpdate

router = APIRouter()


@router.post("", response_model=MahasiswaResponse)
def create_mahasiswa(payload: MahasiswaCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    data = Mahasiswa(**payload.model_dump())
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[MahasiswaResponse])
def list_mahasiswa(
    search: str | None = Query(default=None),
    angkatan: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Mahasiswa).filter(Mahasiswa.is_active.is_(True))
    if search:
        pattern = f"%{search}%"
        query = query.filter((Mahasiswa.nama.ilike(pattern)) | (Mahasiswa.nim.ilike(pattern)))
    if angkatan:
        query = query.filter(Mahasiswa.angkatan == angkatan)
    return query.order_by(Mahasiswa.id.desc()).offset((page - 1) * limit).limit(limit).all()


@router.get("/{mahasiswa_id}", response_model=MahasiswaResponse)
def get_mahasiswa(mahasiswa_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    data = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id, Mahasiswa.is_active.is_(True)).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    return data


@router.put("/{mahasiswa_id}", response_model=MahasiswaResponse)
def update_mahasiswa(mahasiswa_id: int, payload: MahasiswaUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    data = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id, Mahasiswa.is_active.is_(True)).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{mahasiswa_id}")
def delete_mahasiswa(mahasiswa_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    data = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id, Mahasiswa.is_active.is_(True)).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    data.is_active = False
    db.commit()
    return {"message": "Mahasiswa dinonaktifkan"}
