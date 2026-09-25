from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, get_scoped_prodi_id, require_roles
from app.models.enums import UserRole
from app.models.laporan_evaluasi import LaporanEvaluasi
from app.models.mata_kuliah import MataKuliah
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.laporan import LaporanRejectRequest, LaporanResponse

router = APIRouter()


def _base_query_for_scope(db: Session, scope: AcademicScope):
    query = db.query(LaporanEvaluasi).join(MataKuliah)
    if scope.program_studi_id:
        return query.filter(MataKuliah.program_studi_id == scope.program_studi_id)
    if scope.fakultas_id:
        return query.join(ProgramStudi, MataKuliah.program_studi_id == ProgramStudi.id).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    raise HTTPException(status_code=403, detail="Role ini tidak memiliki akses validasi laporan")


@router.get("/laporan", response_model=list[LaporanResponse])
def list_laporan_validasi(
    status: str | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    # Kaprodi: laporan di prodinya sendiri. Dekan: lintas semua prodi di fakultasnya
    # (view-only, tidak ada endpoint approve/reject untuk role ini).
    if scope.user.role not in (UserRole.kaprodi, UserRole.dekan):
        raise HTTPException(status_code=403, detail="Role ini tidak memiliki akses validasi laporan")
    query = _base_query_for_scope(db, scope)
    if status:
        query = query.filter(LaporanEvaluasi.status == status)
    return query.order_by(LaporanEvaluasi.submitted_at.desc().nulls_last()).all()


@router.get("/laporan/{id}", response_model=LaporanResponse)
def get_laporan_validasi(id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    if scope.user.role not in (UserRole.kaprodi, UserRole.dekan):
        raise HTTPException(status_code=403, detail="Role ini tidak memiliki akses validasi laporan")
    data = db.query(LaporanEvaluasi).join(MataKuliah).filter(LaporanEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    if scope.program_studi_id and data.mata_kuliah.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Laporan ini di luar prodi Anda")
    if scope.fakultas_id and data.mata_kuliah.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Laporan ini di luar fakultas Anda")
    return data


@router.post("/laporan/{id}/approve", response_model=LaporanResponse)
def approve_laporan(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.kaprodi)),
    prodi_id: int = Depends(get_scoped_prodi_id),
):
    data = db.query(LaporanEvaluasi).join(MataKuliah).filter(LaporanEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    if data.mata_kuliah.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh memvalidasi laporan di luar prodi Anda")
    if data.status != "submitted":
        raise HTTPException(status_code=400, detail="Hanya laporan berstatus submitted yang bisa divalidasi")
    data.status = "approved"
    data.validated_by = user.id
    data.validated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(data)
    return data


@router.post("/laporan/{id}/reject", response_model=LaporanResponse)
def reject_laporan(
    id: int,
    payload: LaporanRejectRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.kaprodi)),
    prodi_id: int = Depends(get_scoped_prodi_id),
):
    data = db.query(LaporanEvaluasi).join(MataKuliah).filter(LaporanEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    if data.mata_kuliah.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh memvalidasi laporan di luar prodi Anda")
    if data.status != "submitted":
        raise HTTPException(status_code=400, detail="Hanya laporan berstatus submitted yang bisa direject")
    data.status = "rejected"
    data.validated_by = user.id
    data.validated_at = datetime.now(timezone.utc)
    data.remarks = payload.remarks
    db.commit()
    db.refresh(data)
    return data