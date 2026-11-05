from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.bentuk_penilaian import BentukPenilaian
from app.models.enums import UserRole
from app.models.jenis_evaluasi import JenisEvaluasi
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.jenis_evaluasi import JenisEvaluasiCreate, JenisEvaluasiResponse, JenisEvaluasiUpdate

router = APIRouter()


def _require_prodi_scope(user: User) -> int:
    if not user.program_studi_id:
        raise HTTPException(status_code=400, detail="Akun ini belum terhubung ke Program Studi manapun")
    return user.program_studi_id


@router.post("", response_model=JenisEvaluasiResponse)
def create(payload: JenisEvaluasiCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi))):
    prodi_id = _require_prodi_scope(user)
    if payload.bobot is not None:
        if payload.bobot < 0 or payload.bobot > 100:
            raise HTTPException(status_code=400, detail="Bobot jenis evaluasi harus berada dalam rentang 0 sampai 100")

    existing = db.query(JenisEvaluasi).filter(
        JenisEvaluasi.program_studi_id == prodi_id,
        JenisEvaluasi.nama == payload.nama,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Jenis evaluasi dengan nama '{payload.nama}' sudah ada di program studi ini")

    data = JenisEvaluasi(**{**payload.model_dump(), "program_studi_id": prodi_id})
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[JenisEvaluasiResponse])
def list_all(db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    query = db.query(JenisEvaluasi)
    if scope.program_studi_id:
        query = query.filter(JenisEvaluasi.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.order_by(JenisEvaluasi.urutan.asc().nulls_last()).all()


@router.put("/{id}", response_model=JenisEvaluasiResponse)
def update(id: int, payload: JenisEvaluasiUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi))):
    prodi_id = _require_prodi_scope(user)
    data = db.query(JenisEvaluasi).filter(JenisEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh mengubah data di luar prodi Anda")
    if payload.bobot is not None:
        if payload.bobot < 0 or payload.bobot > 100:
            raise HTTPException(status_code=400, detail="Bobot jenis evaluasi harus berada dalam rentang 0 sampai 100")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{id}")
def delete(id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi))):
    prodi_id = _require_prodi_scope(user)
    data = db.query(JenisEvaluasi).filter(JenisEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh menghapus data di luar prodi Anda")

    has_bentuk = db.query(BentukPenilaian).filter(BentukPenilaian.jenis_evaluasi_id == id).first()
    if has_bentuk:
        raise HTTPException(
            status_code=409,
            detail=f"Jenis evaluasi '{data.nama}' tidak dapat dihapus karena masih memiliki bentuk penilaian terkait."
        )

    try:
        db.delete(data)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Jenis evaluasi '{data.nama}' tidak dapat dihapus karena masih digunakan."
        )
    return {"message": "Jenis evaluasi berhasil dihapus"}