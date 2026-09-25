from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.kurikulum_version import KurikulumVersion
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.kurikulum_version import KurikulumVersionCreate, KurikulumVersionResponse

router = APIRouter()


def _require_prodi_scope(user: User) -> int:
    # Sesuai kode asli: hanya Admin Prodi (bukan Kaprodi) yang boleh menulis kurikulum.
    if not user.program_studi_id:
        raise HTTPException(status_code=400, detail="Akun ini belum terhubung ke Program Studi manapun")
    return user.program_studi_id


@router.get("", response_model=list[KurikulumVersionResponse])
def list_versions(
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(KurikulumVersion)
    if scope.program_studi_id:
        query = query.filter(KurikulumVersion.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.order_by(KurikulumVersion.id.desc()).all()


@router.post("", response_model=KurikulumVersionResponse)
def create_version(
    payload: KurikulumVersionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    prodi_id = _require_prodi_scope(user)
    data = KurikulumVersion(
        **{**payload.model_dump(), "program_studi_id": prodi_id},
        status="draft",
        created_by=user.id,
    )
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.post("/{version_id}/publish", response_model=KurikulumVersionResponse)
def publish_version(
    version_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    prodi_id = _require_prodi_scope(user)
    data = db.query(KurikulumVersion).filter(KurikulumVersion.id == version_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Versi kurikulum tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh publish kurikulum di luar prodi Anda")
    data.status = "published"
    data.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(data)
    return data