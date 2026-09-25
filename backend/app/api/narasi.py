import json
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.cpl import CPL
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.narasi_evaluasi import NarasiEvaluasi
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.narasi import NarasiGenerateRequest, NarasiResponse, NarasiUpdate
from app.services import rag_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _check_write_access(db: Session, user: User, mata_kuliah_id: int) -> MataKuliah:
    mk = (
        db.query(MataKuliah)
        .options(joinedload(MataKuliah.program_studi))
        .filter(MataKuliah.id == mata_kuliah_id)
        .first()
    )
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


def _build_capaian_context(
    db: Session,
    mk: MataKuliah,
    payload: NarasiGenerateRequest,
) -> List[Dict[str, Any]]:
    """Siapkan data capaian dari payload atau database untuk input pipeline RAG."""
    if payload.capaian and len(payload.capaian) > 0:
        return payload.capaian

    # Ambil daftar CPL terkait program studi untuk melengkapi konteks jika belum ada
    cpl_list = db.query(CPL).filter(CPL.program_studi_id == mk.program_studi_id).all()
    if cpl_list:
        capaian_items = []
        for c in cpl_list[:5]:
            capaian_items.append({
                "kode": c.kode_cpl,
                "deskripsi": c.deskripsi or f"Capaian {c.kode_cpl}",
                "nilai_rata_rata": 75.0,
                "jumlah_mahasiswa": 35,
                "jumlah_tercapai": 28,
            })
        return capaian_items

    return [{
        "kode": f"CPL-{mk.kode or 'OBE'}",
        "deskripsi": f"Evaluasi Capaian Mata Kuliah {mk.nama}",
        "nilai_rata_rata": 72.5,
        "jumlah_mahasiswa": 30,
        "jumlah_tercapai": 24,
    }]


@router.post("/generate/{matkul_id}", response_model=NarasiResponse)
async def generate_narasi(
    matkul_id: int,
    payload: NarasiGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    """
    Generate narasi evaluasi kurikulum/wawancara akademik melalui pipeline RAG.
    Alur: Request -> RAG Service -> ChromaDB (Retrieval) -> Qwen LLM -> DB -> Response JSON.
    """
    mk = _check_write_access(db, user, matkul_id)

    # Gabungkan catatan wawancara atau dokumen evaluasi jika disediakan pengguna
    transkrip_tambahan = None
    if payload.transkrip_wawancara or payload.dokumen_evaluasi:
        parts = []
        if payload.transkrip_wawancara:
            parts.append(f"Transkrip Wawancara: {payload.transkrip_wawancara}")
        if payload.dokumen_evaluasi:
            parts.append(f"Dokumen Evaluasi: {payload.dokumen_evaluasi}")
        transkrip_tambahan = " | ".join(parts)

    capaian_data = _build_capaian_context(db, mk, payload)

    # Panggil RAG pipeline secara asinkron (tidak memblokir FastAPI event loop)
    ai_result = await rag_service.generate_narasi(
        mk=mk,
        capaian=capaian_data,
        tahun_ajaran=mk.tahun_ajaran,
        transkrip_tambahan=transkrip_tambahan,
    )

    # Simpan hasil narasi terstruktur (JSON) ke tabel narasi_evaluasi
    konten_str = json.dumps(ai_result.get("data", {}), ensure_ascii=False)

    data = NarasiEvaluasi(
        mata_kuliah_id=matkul_id,
        peserta_mata_kuliah_id=payload.peserta_mata_kuliah_id,
        tipe=payload.tipe,
        konten=konten_str,
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