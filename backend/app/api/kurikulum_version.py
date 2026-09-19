from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.kurikulum_version import KurikulumVersion
from app.models.user import User
from app.schemas.kurikulum_version import KurikulumVersionCreate, KurikulumVersionResponse

router = APIRouter()


@router.get("", response_model=list[KurikulumVersionResponse])
def list_versions(
    program_studi_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(KurikulumVersion)
    if program_studi_id:
        query = query.filter(KurikulumVersion.program_studi_id == program_studi_id)
    return query.order_by(KurikulumVersion.id.desc()).all()


@router.post("", response_model=KurikulumVersionResponse)
def create_version(
    payload: KurikulumVersionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    data = KurikulumVersion(**payload.model_dump(), status="draft", created_by=user.id)
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.post("/{version_id}/publish", response_model=KurikulumVersionResponse)
def publish_version(
    version_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin_prodi)),
):
    data = db.query(KurikulumVersion).filter(KurikulumVersion.id == version_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Versi kurikulum tidak ditemukan")
    data.status = "published"
    data.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(data)
    return data