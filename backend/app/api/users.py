from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import allowed_program_ids, get_current_user, require_program_access, require_roles
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import UserResponse, UserUpdate

router = APIRouter()


@router.get("", response_model=list[UserResponse])
def list_users(role: UserRole | None = Query(default=None), db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.kaprodi))):
    query = db.query(User).filter(User.program_studi_id.in_(allowed_program_ids(user) or []))
    if role:
        query = query.filter(User.role == role)
    return query.order_by(User.nama.asc()).all()


@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin))):
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    require_program_access(user, row.program_studi_id)
    if payload.program_studi_id is not None:
        require_program_access(user, payload.program_studi_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{user_id}")
def deactivate_user(user_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin))):
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    require_program_access(user, row.program_studi_id)
    row.is_active = False
    db.commit()
    return {"message": "User dinonaktifkan"}
