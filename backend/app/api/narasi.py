import json
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import NarasiStatus, NarasiTipe, UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.narasi_evaluasi import NarasiEvaluasi
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.narasi import NarasiGenerateRequest, NarasiResponse, NarasiUpdate
from app.services import ai_client, capaian_service

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


def _semester_label(mk: MataKuliah) -> str:
    raw = mk.semester
    if hasattr(raw, "value"):
        return str(raw.value)
    return str(raw) if raw else "Ganjil"


@router.post("/generate/{matkul_id}", response_model=NarasiResponse)
async def generate_narasi(
    matkul_id: int,
    payload: NarasiGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    """
    Generate narasi evaluasi kurikulum berbasis OBE via AI Service (REST HTTP port 8001).
    Wajib menolak dengan HTTP 422 jika belum ada data nilai/kalkulasi untuk MK tersebut.
    """
    mk = _check_write_access(db, user, matkul_id)

    # Agregasi data capaian riil dari database lewat capaian_service
    capaian_data = payload.capaian if (payload.capaian and len(payload.capaian) > 0) else None
    if not capaian_data:
        capaian_data = capaian_service.get_capaian_mata_kuliah(db, matkul_id)

    # PRD Wajib: Tolak HTTP 422 jika belum ada data nilai / kalkulasi
    if not capaian_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Mata kuliah belum memiliki data nilai atau hasil kalkulasi ketercapaian CPMK/CPL. "
                "Lakukan input nilai dan jalankan kalkulasi terlebih dahulu sebelum generate narasi evaluasi."
            ),
        )

    prodi_nama = mk.program_studi.nama if mk.program_studi else "Program Studi"
    semester_val = _semester_label(mk)
    if semester_val not in ("Ganjil", "Genap"):
        semester_val = "Ganjil"

    # Panggil AI Service via REST HTTP (ai_client)
    ai_result = await ai_client.generate_narasi(
        mk_name=mk.nama or f"Mata Kuliah {mk.kode}",
        prodi=prodi_nama,
        semester=semester_val,
        tahun_ajaran=mk.tahun_ajaran or "2025/2026",
        capaian=capaian_data,
    )

    konten_str = json.dumps(ai_result.get("data", {}), ensure_ascii=False)

    data = NarasiEvaluasi(
        mata_kuliah_id=matkul_id,
        peserta_mata_kuliah_id=payload.peserta_mata_kuliah_id,
        tipe=payload.tipe,
        konten=konten_str,
        status=NarasiStatus.draft,
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
    if data.status == NarasiStatus.finalized:
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
    data.status = NarasiStatus.finalized
    db.commit()
    db.refresh(data)
    return data