from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.fakultas import Fakultas
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.program_studi import ProgramStudiCreate, ProgramStudiResponse, ProgramStudiUpdate

router = APIRouter()


@router.get("", response_model=list[ProgramStudiResponse])
def list_prodi(
    fakultas_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(ProgramStudi)
    if fakultas_id:
        query = query.filter(ProgramStudi.fakultas_id == fakultas_id)
    return query.order_by(ProgramStudi.nama.asc()).all()


@router.get("/{prodi_id}", response_model=ProgramStudiResponse)
def get_prodi(prodi_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    row = db.query(ProgramStudi).filter(ProgramStudi.id == prodi_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Program studi tidak ditemukan")
    return row


@router.post("", response_model=ProgramStudiResponse)
def create_prodi(payload: ProgramStudiCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    if not db.query(Fakultas).filter(Fakultas.id == payload.fakultas_id).first():
        raise HTTPException(status_code=400, detail="Fakultas tidak ditemukan")
    existing = db.query(ProgramStudi).filter(ProgramStudi.kode == payload.kode).first()
    if existing:
        raise HTTPException(status_code=400, detail="Kode program studi sudah dipakai")
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
    if payload.fakultas_id is not None:
        if not db.query(Fakultas).filter(Fakultas.id == payload.fakultas_id).first():
            raise HTTPException(status_code=400, detail="Fakultas tidak ditemukan")
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
    if row.users:
        raise HTTPException(
            status_code=400,
            detail="Program Studi masih memiliki akun (Admin Prodi/Kaprodi/Dosen) yang terhubung. Pindahkan/nonaktifkan dulu.",
        )
    if row.mahasiswa or row.mata_kuliah:
        raise HTTPException(
            status_code=400,
            detail="Program Studi masih memiliki data akademik terkait (mahasiswa/mata kuliah). Tidak bisa dihapus.",
        )
    db.delete(row)
    db.commit()
    return {"message": "Program studi dihapus"}