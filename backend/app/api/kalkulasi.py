from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.hasil_evaluasi import HasilEvaluasi
from app.models.ik_achievement import IKAchievement
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.skala_nilai import SkalaNilai
from app.models.user import User
from app.schemas.kalkulasi import KalkulasiRunResponse, ValidasiBobotResponse, ValidasiBobotRequest
from app.services.calculation.engine import run_kalkulasi, validasi_bobot_mata_kuliah
from app.services.calculation.obe_formula import pilih_huruf

router = APIRouter()


class FinalizeRequest(BaseModel):
    kurikulum_version_id: int
    nilai_akhir: Decimal
    peserta_mata_kuliah_id: int | None = None
    mata_kuliah_id: int | None = None


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


def _execute_validasi_bobot(mata_kuliah_id: int, db: Session, user: User) -> dict:
    mk = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if user.role in (UserRole.admin_prodi, UserRole.kaprodi):
        if mk.program_studi_id != user.program_studi_id:
            raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    elif user.role == UserRole.dekan:
        if mk.program_studi.fakultas_id != user.fakultas_id:
            raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")

    warnings = validasi_bobot_mata_kuliah(db, mata_kuliah_id)
    return {"valid": len(warnings) == 0, "warnings": warnings}


@router.post("/validasi-bobot", response_model=ValidasiBobotResponse)
def validasi_bobot(
    payload: ValidasiBobotRequest | None = None,
    mata_kuliah_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    target_id = payload.mata_kuliah_id if payload else mata_kuliah_id
    if not target_id:
        raise HTTPException(status_code=400, detail="mata_kuliah_id wajib diberikan")
    return _execute_validasi_bobot(target_id, db, scope.user)


@router.post("/validasibobot", response_model=ValidasiBobotResponse, include_in_schema=False)
def validasi_bobot_alias(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """Alias backward compatibility untuk URL lama /validasibobot."""
    return _execute_validasi_bobot(mata_kuliah_id, db, scope.user)


@router.post("/run/{matkul_id}", response_model=KalkulasiRunResponse)
def run(
    matkul_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    """
    Jalankan engine kalkulasi OBE deterministik per mata kuliah.
    Menghitung capaian IK, CPMK, CPL, dan nilai akhir mahasiswa.
    """
    _check_write_access(db, user, matkul_id)
    result = run_kalkulasi(db, matkul_id)
    return result


@router.post("/finalize")
def finalize_nilai(
    payload: FinalizeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi, UserRole.dosen)),
):
    """
    Finalisasi nilai OBE mahasiswa:
    Menghitung snapshot huruf berdasarkan konfigurasi skala kurikulum saat finalisasi,
    lalu menyimpan snapshot tersebut secara permanen.
    """
    skala_rows = (
        db.query(SkalaNilai)
        .filter(SkalaNilai.kurikulum_version_id == payload.kurikulum_version_id)
        .order_by(SkalaNilai.batas_min.desc())
        .all()
    )
    skala_list = [(s.huruf, s.batas_min) for s in skala_rows]
    huruf_snapshot = pilih_huruf(payload.nilai_akhir, skala_list)

    hasil = HasilEvaluasi(
        peserta_mata_kuliah_id=payload.peserta_mata_kuliah_id,
        kurikulum_version_id=payload.kurikulum_version_id,
        nilai_akhir=payload.nilai_akhir,
        nilai_huruf=huruf_snapshot,
        is_final=True,
        finalized_at=datetime.now(timezone.utc),
        finalized_by=user.id,
    )
    db.add(hasil)
    db.commit()
    db.refresh(hasil)
    return {
        "id": hasil.id,
        "nilai_huruf": hasil.nilai_huruf,
        "nilai_akhir": float(hasil.nilai_akhir) if hasil.nilai_akhir is not None else 0.0,
        "is_final": hasil.is_final,
    }


@router.get("/hasil/{hasil_id}")
def get_hasil_detail(
    hasil_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """Ambil detail snapshot hasil evaluasi yang tersimpan."""
    hasil = db.query(HasilEvaluasi).filter(HasilEvaluasi.id == hasil_id).first()
    if not hasil:
        raise HTTPException(status_code=404, detail="Hasil evaluasi tidak ditemukan")

    return {
        "id": hasil.id,
        "nilai_huruf": hasil.nilai_huruf,
        "nilai_akhir": float(hasil.nilai_akhir) if hasil.nilai_akhir is not None else 0.0,
        "is_final": hasil.is_final,
    }


@router.get("/{matkul_id}")
def get_hasil(
    matkul_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """Ambil ringkasan hasil kalkulasi IK per mata kuliah."""
    mk = db.query(MataKuliah).filter(MataKuliah.id == matkul_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if scope.program_studi_id and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    if scope.fakultas_id and mk.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")

    results = db.query(IKAchievement).filter(IKAchievement.mata_kuliah_id == matkul_id).all()
    return [{"mahasiswa_id": r.mahasiswa_id, "ik_id": r.ik_id, "nilai": float(r.nilai)} for r in results]