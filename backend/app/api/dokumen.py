from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.dokumen import Dokumen
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.dokumen import DokumenCreate, DokumenResponse, DokumenUpdate

router = APIRouter()


def _resolve_scope_for_write(db: Session, user: User, mata_kuliah_id: int | None) -> tuple[int, int | None]:
    """Mengembalikan (program_studi_id, mata_kuliah_id) yang valid untuk ditulis user ini."""
    if mata_kuliah_id:
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
        return mk.program_studi_id, mata_kuliah_id

    # Tanpa mata_kuliah_id: hanya Admin Prodi yang boleh, scope dari prodinya sendiri.
    if user.role != UserRole.admin_prodi:
        raise HTTPException(status_code=400, detail="Dosen wajib menyertakan mata_kuliah_id saat membuat dokumen")
    if not user.program_studi_id:
        raise HTTPException(status_code=400, detail="Akun ini belum terhubung ke Program Studi manapun")
    return user.program_studi_id, None


@router.post("", response_model=DokumenResponse)
def create_dokumen(
    payload: DokumenCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    program_studi_id, mata_kuliah_id = _resolve_scope_for_write(db, user, payload.mata_kuliah_id)
    data = Dokumen(
        judul=payload.judul,
        jenis=payload.jenis,
        konten=payload.konten,
        status="DRAFT",
        mata_kuliah_id=mata_kuliah_id,
        program_studi_id=program_studi_id,
        dibuat_oleh=user.id,
        catatan=payload.catatan,
    )
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[DokumenResponse])
def list_dokumen(
    mata_kuliah_id: int | None = None,
    jenis: str | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(Dokumen)
    if mata_kuliah_id:
        query = query.filter(Dokumen.mata_kuliah_id == mata_kuliah_id)
    if jenis:
        query = query.filter(Dokumen.jenis == jenis)
    if scope.program_studi_id:
        query = query.filter(Dokumen.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi, Dokumen.program_studi_id == ProgramStudi.id).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.order_by(Dokumen.dibuat_pada.desc()).all()


@router.get("/{dokumen_id}", response_model=DokumenResponse)
def get_dokumen(dokumen_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    data = db.query(Dokumen).filter(Dokumen.id == dokumen_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    if scope.program_studi_id and data.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Dokumen ini di luar prodi Anda")
    if scope.fakultas_id and data.program_studi_id:
        prodi = db.query(ProgramStudi).filter(ProgramStudi.id == data.program_studi_id).first()
        if not prodi or prodi.fakultas_id != scope.fakultas_id:
            raise HTTPException(status_code=403, detail="Dokumen ini di luar fakultas Anda")
    return data


def _check_write_access_for_existing(db: Session, user: User, data: Dokumen) -> None:
    """Satu fungsi dipakai update & delete: validasi akses ke Dokumen yang sudah ada."""
    if data.mata_kuliah_id:
        _resolve_scope_for_write(db, user, data.mata_kuliah_id)
        return
    if user.role != UserRole.admin_prodi or data.program_studi_id != user.program_studi_id:
        raise HTTPException(status_code=403, detail="Dokumen ini di luar wewenang Anda")


@router.put("/{dokumen_id}", response_model=DokumenResponse)
def update_dokumen(
    dokumen_id: int,
    payload: DokumenUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    data = db.query(Dokumen).filter(Dokumen.id == dokumen_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    _check_write_access_for_existing(db, user, data)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{dokumen_id}")
def delete_dokumen(
    dokumen_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    data = db.query(Dokumen).filter(Dokumen.id == dokumen_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan")
    _check_write_access_for_existing(db, user, data)
    db.delete(data)
    db.commit()
    return {"message": "Dokumen dihapus"}