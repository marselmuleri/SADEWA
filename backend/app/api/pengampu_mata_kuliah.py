from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.pengampu_mata_kuliah import (
    PengampuMataKuliahCreate, PengampuMataKuliahResponse, PengampuMataKuliahUpdate,
)

router = APIRouter()


def _require_mata_kuliah_in_own_prodi(db: Session, user: User, mata_kuliah_id: int) -> MataKuliah:
    if not user.program_studi_id:
        raise HTTPException(status_code=400, detail="Akun ini belum terhubung ke Program Studi manapun")
    mk = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if mk.program_studi_id != user.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    return mk


@router.post("", response_model=PengampuMataKuliahResponse)
def assign_pengampu(
    payload: PengampuMataKuliahCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    _require_mata_kuliah_in_own_prodi(db, user, payload.mata_kuliah_id)

    target = db.query(User).filter(User.id == payload.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    if target.role != UserRole.dosen:
        raise HTTPException(status_code=400, detail="Hanya akun dengan role Dosen yang bisa jadi pengampu mata kuliah")

    existing = db.query(PengampuMataKuliah).filter(
        PengampuMataKuliah.mata_kuliah_id == payload.mata_kuliah_id,
        PengampuMataKuliah.user_id == payload.user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Dosen ini sudah menjadi pengampu mata kuliah ini")

    data = PengampuMataKuliah(
        mata_kuliah_id=payload.mata_kuliah_id,
        user_id=payload.user_id,
        is_koordinator="1" if payload.is_koordinator else "0",
    )
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[PengampuMataKuliahResponse])
def list_pengampu(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    mk = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if scope.program_studi_id and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    if scope.fakultas_id and mk.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")
    return db.query(PengampuMataKuliah).filter(PengampuMataKuliah.mata_kuliah_id == mata_kuliah_id).all()


@router.put("/{id}", response_model=PengampuMataKuliahResponse)
def update_pengampu(
    id: int,
    payload: PengampuMataKuliahUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    data = db.query(PengampuMataKuliah).filter(PengampuMataKuliah.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Data pengampu tidak ditemukan")
    _require_mata_kuliah_in_own_prodi(db, user, data.mata_kuliah_id)
    data.is_koordinator = "1" if payload.is_koordinator else "0"
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{id}")
def remove_pengampu(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    data = db.query(PengampuMataKuliah).filter(PengampuMataKuliah.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Data pengampu tidak ditemukan")
    _require_mata_kuliah_in_own_prodi(db, user, data.mata_kuliah_id)
    db.delete(data)
    db.commit()
    return {"message": "Dosen pengampu dihapus dari mata kuliah ini"}