from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.models.enums import UserRole

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token tidak valid")
    user = db.query(User).filter(User.email == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User tidak ditemukan")
    return user

def require_roles(*roles: UserRole):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tidak memiliki akses")
        return user

    return checker


def allowed_program_ids(user: User) -> set[int] | None:
    """Return the server-side academic scope; None is Super Admin metadata-only."""
    if user.role == UserRole.super_admin:
        return None
    if user.role == UserRole.dekan:
        return set(user.program_studi_ids or ([] if user.program_studi_id is None else [user.program_studi_id]))
    return {user.program_studi_id} if user.program_studi_id else set()


def require_program_access(user: User, program_studi_id: int) -> None:
    scope = allowed_program_ids(user)
    if scope is None or program_studi_id not in scope:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Data di luar cakupan program studi Anda")
