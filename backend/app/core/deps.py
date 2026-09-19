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


def get_scoped_prodi_id(
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi)),
) -> int:
    """
    Dipakai nanti di endpoint akademik (nilai, cpl, dashboard, laporan, dst).
    Scope prodi SELALU dibaca dari akun yang login, tidak pernah dari query
    param/body kiriman client -- supaya admin_prodi/kaprodi tidak bisa
    mengakses data prodi lain hanya dengan mengubah parameter request.
    """
    if not user.program_studi_id:
        raise HTTPException(
            status_code=400,
            detail="Akun ini belum terhubung ke Program Studi manapun. Hubungi Super Admin.",
        )
    return user.program_studi_id


def get_scoped_fakultas_id(
    user: User = Depends(require_roles(UserRole.dekan)),
) -> int:
    """Sama seperti get_scoped_prodi_id, tapi untuk Dekan (scope di level Fakultas)."""
    if not user.fakultas_id:
        raise HTTPException(
            status_code=400,
            detail="Akun ini belum terhubung ke Fakultas manapun. Hubungi Super Admin.",
        )
    return user.fakultas_id