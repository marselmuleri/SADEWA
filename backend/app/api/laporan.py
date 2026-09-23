from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.laporan_evaluasi import LaporanEvaluasi
from app.models.mata_kuliah import MataKuliah
from app.models.narasi_evaluasi import NarasiEvaluasi
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.user import User
from app.schemas.laporan import (
    LaporanGenerateRequest, LaporanImportNarasiRequest, LaporanResponse, LaporanUpdate,
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


@router.post("/generate/{matkul_id}", response_model=LaporanResponse)
def generate_laporan(
    matkul_id: int,
    payload: LaporanGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    _check_write_access(db, user, matkul_id)
    data = LaporanEvaluasi(
        mata_kuliah_id=matkul_id,
        dosen_id=user.id,
        semester=payload.semester,
        konten="",
        status="draft",
        version=1,
    )
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.post("/{laporan_id}/import-narasi", response_model=LaporanResponse)
def import_narasi(
    laporan_id: int,
    payload: LaporanImportNarasiRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    laporan = db.query(LaporanEvaluasi).filter(LaporanEvaluasi.id == laporan_id).first()
    if not laporan:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    _check_write_access(db, user, laporan.mata_kuliah_id)
    if laporan.status != "draft":
        raise HTTPException(status_code=400, detail="Hanya laporan berstatus draft yang bisa diimport narasi")

    narasi_list = db.query(NarasiEvaluasi).filter(
        NarasiEvaluasi.id.in_(payload.narasi_ids),
        NarasiEvaluasi.status == "finalized",
    ).all()
    if not narasi_list:
        raise HTTPException(status_code=400, detail="Tidak ada narasi finalized yang ditemukan dari ID yang diberikan")

    # Konten disalin (bukan di-link permanen), sesuai PRD
    gabungan = "\n\n".join(n.konten for n in narasi_list)
    laporan.konten = (laporan.konten or "") + ("\n\n" if laporan.konten else "") + gabungan
    laporan.sumber_narasi_ids = [n.id for n in narasi_list]
    db.commit()
    db.refresh(laporan)
    return laporan


@router.get("/{matkul_id}", response_model=list[LaporanResponse])
def list_laporan(matkul_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    mk = db.query(MataKuliah).filter(MataKuliah.id == matkul_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if scope.program_studi_id and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    if scope.fakultas_id and mk.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")
    return db.query(LaporanEvaluasi).filter(LaporanEvaluasi.mata_kuliah_id == matkul_id).order_by(LaporanEvaluasi.id.desc()).all()


@router.put("/{id}", response_model=LaporanResponse)
def update_laporan(id: int, payload: LaporanUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    laporan = db.query(LaporanEvaluasi).filter(LaporanEvaluasi.id == id).first()
    if not laporan:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    _check_write_access(db, user, laporan.mata_kuliah_id)
    if laporan.status not in ("draft", "rejected"):
        raise HTTPException(status_code=400, detail="Laporan hanya bisa diedit saat draft atau rejected")
    laporan.konten = payload.konten
    if laporan.status == "rejected":
        laporan.status = "draft"
        laporan.version += 1
    db.commit()
    db.refresh(laporan)
    return laporan


@router.post("/{id}/submit", response_model=LaporanResponse)
def submit_laporan(id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    laporan = db.query(LaporanEvaluasi).filter(LaporanEvaluasi.id == id).first()
    if not laporan:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    _check_write_access(db, user, laporan.mata_kuliah_id)
    if laporan.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Hanya laporan berstatus draft yang bisa disubmit")
    if not laporan.konten:
        raise HTTPException(status_code=400, detail="Laporan belum memiliki konten")
    laporan.status = "submitted"
    laporan.submitted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(laporan)
    return laporan