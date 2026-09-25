from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, get_scoped_prodi_id
from app.schemas.mahasiswa import MahasiswaCreate, MahasiswaResponse, MahasiswaUpdate
from app.models.mahasiswa import Mahasiswa
from app.models.program_studi import ProgramStudi

router = APIRouter()


@router.post("", response_model=MahasiswaResponse)
def create_mahasiswa(payload: MahasiswaCreate, db: Session = Depends(get_db), prodi_id: int = Depends(get_scoped_prodi_id)):
    data = Mahasiswa(**{**payload.model_dump(), "program_studi_id": prodi_id})
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
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(Mahasiswa).filter(Mahasiswa.is_active.is_(True))
    if search:
        pattern = f"%{search}%"
        query = query.filter((Mahasiswa.nama.ilike(pattern)) | (Mahasiswa.nim.ilike(pattern)))
    if angkatan:
        query = query.filter(Mahasiswa.angkatan == angkatan)
    if scope.program_studi_id:
        query = query.filter(Mahasiswa.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.order_by(Mahasiswa.id.desc()).offset((page - 1) * limit).limit(limit).all()


@router.get("/{mahasiswa_id}", response_model=MahasiswaResponse)
def get_mahasiswa(mahasiswa_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    data = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id, Mahasiswa.is_active.is_(True)).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    if scope.program_studi_id and data.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mahasiswa ini di luar prodi Anda")
    if scope.fakultas_id and data.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mahasiswa ini di luar fakultas Anda")
    return data


@router.put("/{mahasiswa_id}", response_model=MahasiswaResponse)
def update_mahasiswa(mahasiswa_id: int, payload: MahasiswaUpdate, db: Session = Depends(get_db), prodi_id: int = Depends(get_scoped_prodi_id)):
    data = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id, Mahasiswa.is_active.is_(True)).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh mengubah mahasiswa di luar prodi Anda")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{mahasiswa_id}")
def delete_mahasiswa(mahasiswa_id: int, db: Session = Depends(get_db), prodi_id: int = Depends(get_scoped_prodi_id)):
    data = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id, Mahasiswa.is_active.is_(True)).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh menonaktifkan mahasiswa di luar prodi Anda")
    data.is_active = False
    db.commit()
    return {"message": "Mahasiswa dinonaktifkan"}