from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.models.enums import UserRole
from app.models.program_studi import ProgramStudi
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah

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


def check_program_access(user: User, program_studi_id: int, db: Session) -> bool:
    """
    Validasi akses program studi berdasarkan hirarki peran PRD:
    - super_admin: memiliki akses ke seluruh prodi.
    - dekan: memiliki akses ke seluruh prodi di dalam fakultasnya.
    - admin_prodi & kaprodi: hanya prodi miliknya.
    - dosen: prodi miliknya.
    """
    if user.role == UserRole.super_admin:
        return True
    if user.role == UserRole.dekan:
        if not user.fakultas_id:
            return False
        prodi = db.query(ProgramStudi).filter(ProgramStudi.id == program_studi_id).first()
        return bool(prodi and prodi.fakultas_id == user.fakultas_id)
    if user.role in (UserRole.admin_prodi, UserRole.kaprodi, UserRole.dosen):
        return user.program_studi_id == program_studi_id
    return False


def require_program_access(
    prodi_id_param: str = "program_studi_id",
    mk_id_param: Optional[str] = None,
):
    """
    Dependency factory untuk otorisasi per-prodi sesuai PRD SADEWA.
    Mendukung verifikasi langsung via parameter prodi_id atau melalui relasi mata_kuliah_id.
    """
    def dependency(
        request: Request,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        # Cek apakah ada parameter mata kuliah
        mk_id = None
        if mk_id_param:
            val = request.path_params.get(mk_id_param) or request.query_params.get(mk_id_param)
            if val:
                try:
                    mk_id = int(val)
                except (ValueError, TypeError):
                    pass

        if not mk_id:
            for key in ("mata_kuliah_id", "matkul_id"):
                if key in request.path_params:
                    try:
                        mk_id = int(request.path_params[key])
                        break
                    except (ValueError, TypeError):
                        pass

        prodi_id = None
        if mk_id:
            mk = db.query(MataKuliah).filter(MataKuliah.id == mk_id).first()
            if not mk:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mata kuliah tidak ditemukan")
            prodi_id = mk.program_studi_id

            # Untuk dosen, pastikan terdaftar sebagai pengampu mata kuliah
            if user.role == UserRole.dosen:
                is_pengampu = db.query(PengampuMataKuliah).filter(
                    PengampuMataKuliah.mata_kuliah_id == mk_id,
                    PengampuMataKuliah.user_id == user.id,
                ).first()
                if not is_pengampu:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Anda bukan dosen pengampu mata kuliah ini",
                    )

        if not prodi_id:
            for key in (prodi_id_param, "program_studi_id", "prodi_id"):
                val = request.path_params.get(key) or request.query_params.get(key)
                if val:
                    try:
                        prodi_id = int(val)
                        break
                    except (ValueError, TypeError):
                        pass

        if prodi_id is not None:
            if not check_program_access(user, prodi_id, db):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Anda tidak memiliki akses ke Program Studi ini",
                )

        return user

    return dependency


def get_scoped_prodi_id(
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi)),
) -> int:
    """
    Dipakai di endpoint akademik (nilai, cpl, dashboard, laporan, dst).
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


class AcademicScope:
    """Hasil resolusi scope untuk endpoint READ data akademik."""
    def __init__(self, user: User, program_studi_id: int | None = None, fakultas_id: int | None = None):
        self.user = user
        self.program_studi_id = program_studi_id
        self.fakultas_id = fakultas_id


def get_academic_scope(user: User = Depends(get_current_user)) -> AcademicScope:
    """
    Dipakai di endpoint READ data akademik (mata kuliah, cpl, ik, cpmk, dashboard,
    trending). Super Admin ditolak total (bukan wewenangnya, sesuai matriks akses).
    Admin Prodi & Kaprodi di-scope ke program_studi_id miliknya. Dekan di-scope ke
    fakultas_id miliknya (lintas semua prodi di fakultas itu, view-only). Dosen
    sementara tidak difilter di sini -- scope Dosen berbasis penugasan mata kuliah
    (PengampuMataKuliah), akan ditangani terpisah per endpoint yang relevan.
    """
    if user.role == UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Super Admin tidak memiliki akses ke data akademik")
    if user.role in (UserRole.admin_prodi, UserRole.kaprodi):
        if not user.program_studi_id:
            raise HTTPException(status_code=400, detail="Akun ini belum terhubung ke Program Studi manapun")
        return AcademicScope(user, program_studi_id=user.program_studi_id)
    if user.role == UserRole.dekan:
        if not user.fakultas_id:
            raise HTTPException(status_code=400, detail="Akun ini belum terhubung ke Fakultas manapun")
        return AcademicScope(user, fakultas_id=user.fakultas_id)
    return AcademicScope(user)  # dosen: belum difilter di sini