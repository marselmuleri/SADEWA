from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.narasi_evaluasi import NarasiEvaluasi
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.narasi import NarasiGenerateRequest, NarasiResponse, NarasiUpdate

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


@router.post("/generate/{matkul_id}", response_model=NarasiResponse)
def generate_narasi(
    matkul_id: int,
    payload: NarasiGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    _check_write_access(db, user, matkul_id)
    # STUB: modul RAG (LangChain + ChromaDB + Qwen API) belum terhubung.
    # Begitu ai_service.py siap, baris di bawah diganti pemanggilan RAG,
    # kontrak endpoint (request/response) tidak berubah.
    konten_placeholder = (
        "[DRAFT PLACEHOLDER] Narasi evaluasi belum digenerate oleh modul RAG. "
        "Silakan edit manual atau tunggu integrasi AI selesai."
    )
    data = NarasiEvaluasi(
        mata_kuliah_id=matkul_id,
        peserta_mata_kuliah_id=payload.peserta_mata_kuliah_id,
        tipe=payload.tipe,
        konten=konten_placeholder,
        status="draft",
    )
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("/{matkul_id}", response_model=list[NarasiResponse])
def list_narasi(matkul_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    mk = db.query(MataKuliah).filter(MataKuliah.id == matkul_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if scope.program_studi_id and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    if scope.fakultas_id and mk.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")
    return db.query(NarasiEvaluasi).filter(NarasiEvaluasi.mata_kuliah_id == matkul_id).order_by(NarasiEvaluasi.id.desc()).all()


@router.put("/{id}", response_model=NarasiResponse)
def update_narasi(id: int, payload: NarasiUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    data = db.query(NarasiEvaluasi).filter(NarasiEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Narasi tidak ditemukan")
    _check_write_access(db, user, data.mata_kuliah_id)
    if data.status == "finalized":
        raise HTTPException(status_code=400, detail="Narasi sudah finalized, tidak bisa diedit lagi")
    data.konten = payload.konten
    db.commit()
    db.refresh(data)
    return data


@router.put("/{id}/finalize", response_model=NarasiResponse)
def finalize_narasi(id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    data = db.query(NarasiEvaluasi).filter(NarasiEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Narasi tidak ditemukan")
    _check_write_access(db, user, data.mata_kuliah_id)
    data.status = "finalized"
    db.commit()
    db.refresh(data)
    return data