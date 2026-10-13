from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.mahasiswa import Mahasiswa
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.peserta_mata_kuliah import (
    PesertaMataKuliahCreate, PesertaMataKuliahResponse
)

router = APIRouter()


def _check_write_access(db: Session, user: User, mata_kuliah_id: int) -> MataKuliah:
    mk = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if user.role == UserRole.admin_prodi:
        if mk.program_studi_id != user.program_studi_id:
            raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    elif user.role == UserRole.dosen:
        is_pengampu = db.query(PengampuMataKuliah).filter(
            PengampuMataKuliah.mata_kuliah_id == mata_kuliah_id,
            PengampuMataKuliah.user_id == user.id,
        ).first()
        if not is_pengampu:
            raise HTTPException(status_code=403, detail="Anda bukan dosen pengampu mata kuliah ini")
    return mk


@router.post("", response_model=PesertaMataKuliahResponse)
def create_peserta(
    payload: PesertaMataKuliahCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    _check_write_access(db, user, payload.mata_kuliah_id)

    mhs = db.query(Mahasiswa).filter(Mahasiswa.id == payload.mahasiswa_id).first()
    if not mhs:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")

    existing = db.query(PesertaMataKuliah).filter(
        PesertaMataKuliah.mata_kuliah_id == payload.mata_kuliah_id,
        PesertaMataKuliah.mahasiswa_id == payload.mahasiswa_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mahasiswa sudah terdaftar sebagai peserta mata kuliah ini")

    data = PesertaMataKuliah(**payload.model_dump())
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[PesertaMataKuliahResponse])
def list_peserta(
    mata_kuliah_id: int | None = None,
    mahasiswa_id: int | None = None,
    kelas: str | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(PesertaMataKuliah).join(MataKuliah)
    if mata_kuliah_id:
        query = query.filter(PesertaMataKuliah.mata_kuliah_id == mata_kuliah_id)
    if mahasiswa_id:
        query = query.filter(PesertaMataKuliah.mahasiswa_id == mahasiswa_id)
    if kelas:
        query = query.filter(PesertaMataKuliah.kelas == kelas)

    if scope.program_studi_id:
        query = query.filter(MataKuliah.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi, MataKuliah.program_studi_id == ProgramStudi.id).filter(
            ProgramStudi.fakultas_id == scope.fakultas_id
        )
    return query.all()


@router.get("/{id}", response_model=PesertaMataKuliahResponse)
def get_peserta(
    id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    data = db.query(PesertaMataKuliah).join(MataKuliah).filter(PesertaMataKuliah.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Peserta mata kuliah tidak ditemukan")
    if scope.program_studi_id and data.mata_kuliah.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Peserta mata kuliah ini di luar prodi Anda")
    if scope.fakultas_id and data.mata_kuliah.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Peserta mata kuliah ini di luar fakultas Anda")
    return data


@router.delete("/{id}")
def delete_peserta(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    data = db.query(PesertaMataKuliah).filter(PesertaMataKuliah.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Peserta mata kuliah tidak ditemukan")
    _check_write_access(db, user, data.mata_kuliah_id)
    db.delete(data)
    db.commit()
    return {"message": "Peserta mata kuliah berhasil dihapus"}