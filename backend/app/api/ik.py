from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.ik import IK
from app.models.user import User
from app.schemas.ik import IKCreate, IKResponse, IKUpdate

router = APIRouter()


@router.get("", response_model=list[IKResponse])
def list_ik(
    cpl_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(IK)
    if cpl_id:
        query = query.filter(IK.cpl_id == cpl_id)
    return query.order_by(IK.urutan.asc().nulls_last(), IK.kode.asc()).all()


@router.post("", response_model=IKResponse)
def create_ik(
    payload: IKCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin)),
):
    data = IK(**payload.model_dump(), created_by=user.id)
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.put("/{ik_id}", response_model=IKResponse)
def update_ik(
    ik_id: int,
    payload: IKUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    data = db.query(IK).filter(IK.id == ik_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="IK tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{ik_id}")
def delete_ik(
    ik_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    data = db.query(IK).filter(IK.id == ik_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="IK tidak ditemukan")
    db.delete(data)
    db.commit()
    return {"message": "IK dihapus"}