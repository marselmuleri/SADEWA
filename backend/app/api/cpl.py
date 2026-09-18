from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.cpl import CPL
from app.models.user import User
from app.schemas.cpl import CPLCreate, CPLResponse, CPLThresholdUpdate, CPLUpdate

router = APIRouter()


@router.get("", response_model=list[CPLResponse])
def list_cpl(
    kurikulum_version_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(CPL)
    if kurikulum_version_id:
        query = query.filter(CPL.kurikulum_version_id == kurikulum_version_id)
    return query.order_by(CPL.kode.asc()).all()


@router.get("/{cpl_id}", response_model=CPLResponse)
def get_cpl(cpl_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    data = db.query(CPL).filter(CPL.id == cpl_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    return data


@router.post("", response_model=CPLResponse)
def create_cpl(
    payload: CPLCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin)),
):
    data = CPL(**payload.model_dump(), created_by=user.id)
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.put("/{cpl_id}", response_model=CPLResponse)
def update_cpl(
    cpl_id: int,
    payload: CPLUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    data = db.query(CPL).filter(CPL.id == cpl_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.put("/{cpl_id}/threshold", response_model=CPLResponse)
def update_threshold(
    cpl_id: int,
    payload: CPLThresholdUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi)),
):
    data = db.query(CPL).filter(CPL.id == cpl_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    data.threshold_capaian = payload.threshold_capaian
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{cpl_id}")
def delete_cpl(
    cpl_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    data = db.query(CPL).filter(CPL.id == cpl_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    db.delete(data)
    db.commit()
    return {"message": "CPL dihapus"}