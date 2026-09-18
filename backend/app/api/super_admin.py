"""Operational-only provisioning endpoints for the SADEWA Super Admin."""
import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import require_roles
from app.core.security import get_password_hash
from app.models import CPL, MataKuliah, ProgramStudi, User
from app.models.enums import UserRole

router = APIRouter()

class ProvisionPayload(BaseModel):
    nama: str
    kode: str
    fakultas: str
    jenjang: str = "S1"
    admin_nama: str
    admin_nip: str | None = None
    admin_email: EmailStr

@router.get("/super-admin/programs")
def programs(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    result = []
    for program in db.query(ProgramStudi).order_by(ProgramStudi.nama).all():
        result.append({
            "id": program.id, "nama": program.nama, "kode": program.kode,
            "fakultas": program.fakultas, "onboarded_at": program.created_at,
            "active_users": db.query(func.count(User.id)).filter(User.program_studi_id == program.id, User.is_active.is_(True)).scalar() or 0,
            "cpl_count": db.query(func.count(CPL.id)).filter(CPL.program_studi_id == program.id).scalar() or 0,
            "course_count": db.query(func.count(MataKuliah.id)).filter(MataKuliah.program_studi_id == program.id).scalar() or 0,
        })
    return result

@router.post("/super-admin/programs")
def provision(payload: ProvisionPayload, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    if db.query(ProgramStudi).filter((ProgramStudi.kode == payload.kode) | (ProgramStudi.nama == payload.nama)).first():
        raise HTTPException(400, "Nama atau kode program studi sudah digunakan")
    if db.query(User).filter(User.email == payload.admin_email).first():
        raise HTTPException(400, "Email Admin Prodi sudah digunakan")
    program = ProgramStudi(nama=payload.nama, kode=payload.kode, fakultas=payload.fakultas, jenjang=payload.jenjang)
    db.add(program); db.flush()
    password = secrets.token_urlsafe(9)
    admin = User(nama=payload.admin_nama, nip=payload.admin_nip, email=payload.admin_email,
                 password_hash=get_password_hash(password), role=UserRole.admin, program_studi_id=program.id)
    db.add(admin); db.commit()
    # Email delivery is intentionally outside this MVP; show once to the operator.
    return {"message": "Prodi dan Admin Prodi pertama berhasil dibuat", "program_id": program.id, "temporary_password": password}

@router.get("/super-admin/programs/{program_id}/users")
def program_users(program_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    if not db.get(ProgramStudi, program_id): raise HTTPException(404, "Program studi tidak ditemukan")
    return [{"id": u.id, "nama": u.nama, "nip": u.nip, "email": u.email, "role": u.role, "is_active": u.is_active}
            for u in db.query(User).filter(User.program_studi_id == program_id).order_by(User.nama)]

@router.post("/super-admin/users/{user_id}/reset-password")
def reset_password(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    user = db.get(User, user_id)
    if not user or user.role == UserRole.super_admin: raise HTTPException(404, "User tidak ditemukan")
    password = secrets.token_urlsafe(9); user.password_hash = get_password_hash(password); db.commit()
    return {"message": "Password berhasil direset", "temporary_password": password}

@router.patch("/super-admin/users/{user_id}/status")
def set_status(user_id: int, active: bool, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.super_admin))):
    user = db.get(User, user_id)
    if not user or user.role == UserRole.super_admin: raise HTTPException(404, "User tidak ditemukan")
    user.is_active = active; db.commit(); return {"message": "Status akun diperbarui"}
