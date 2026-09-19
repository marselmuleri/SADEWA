from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.narasi_evaluasi import NarasiEvaluasi
from app.models.user import User
from app.schemas.narasi import NarasiGenerateRequest, NarasiResponse, NarasiUpdate

router = APIRouter()


@router.post("/generate/{matkul_id}", response_model=NarasiResponse)
def generate_narasi(
    matkul_id: int,
    payload: NarasiGenerateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
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
def list_narasi(matkul_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(NarasiEvaluasi).filter(NarasiEvaluasi.mata_kuliah_id == matkul_id).order_by(NarasiEvaluasi.id.desc()).all()


@router.put("/{id}", response_model=NarasiResponse)
def update_narasi(id: int, payload: NarasiUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    data = db.query(NarasiEvaluasi).filter(NarasiEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Narasi tidak ditemukan")
    if data.status == "finalized":
        raise HTTPException(status_code=400, detail="Narasi sudah finalized, tidak bisa diedit lagi")
    data.konten = payload.konten
    db.commit()
    db.refresh(data)
    return data


@router.put("/{id}/finalize", response_model=NarasiResponse)
def finalize_narasi(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    data = db.query(NarasiEvaluasi).filter(NarasiEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Narasi tidak ditemukan")
    data.status = "finalized"
    db.commit()
    db.refresh(data)
    return data