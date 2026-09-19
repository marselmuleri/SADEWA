from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.enums import UserRole
from app.models.laporan_evaluasi import LaporanEvaluasi
from app.models.mata_kuliah import MataKuliah
from app.models.user import User
from app.schemas.laporan import LaporanRejectRequest, LaporanResponse

router = APIRouter()


@router.get("/laporan", response_model=list[LaporanResponse])
def list_laporan_validasi(
    status: str | None = None,
    program_studi_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.kaprodi)),
):
    query = db.query(LaporanEvaluasi)
    if status:
        query = query.filter(LaporanEvaluasi.status == status)
    if program_studi_id:
        query = query.join(MataKuliah).filter(MataKuliah.program_studi_id == program_studi_id)
    return query.order_by(LaporanEvaluasi.submitted_at.desc().nulls_last()).all()


@router.get("/laporan/{id}", response_model=LaporanResponse)
def get_laporan_validasi(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.kaprodi))):
    data = db.query(LaporanEvaluasi).filter(LaporanEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    return data


@router.post("/laporan/{id}/approve", response_model=LaporanResponse)
def approve_laporan(id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.kaprodi))):
    data = db.query(LaporanEvaluasi).filter(LaporanEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    if data.status != "submitted":
        raise HTTPException(status_code=400, detail="Hanya laporan berstatus submitted yang bisa divalidasi")
    data.status = "approved"
    data.validated_by = user.id
    data.validated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(data)
    return data


@router.post("/laporan/{id}/reject", response_model=LaporanResponse)
def reject_laporan(id: int, payload: LaporanRejectRequest, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.kaprodi))):
    data = db.query(LaporanEvaluasi).filter(LaporanEvaluasi.id == id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    if data.status != "submitted":
        raise HTTPException(status_code=400, detail="Hanya laporan berstatus submitted yang bisa direject")
    data.status = "rejected"
    data.validated_by = user.id
    data.validated_at = datetime.now(timezone.utc)
    data.remarks = payload.remarks
    db.commit()
    db.refresh(data)
    return data