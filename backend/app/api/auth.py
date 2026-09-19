from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import Token, UserLogin, UserRegister, UserResponse

router = APIRouter()


@router.post("/register", response_model=UserResponse)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    """
    Bootstrap Super Admin PERTAMA saja. Begitu ada satu user di database
    (siapa pun rolenya), endpoint ini otomatis tertutup untuk selamanya --
    pembuatan user selanjutnya wajib lewat POST /users oleh Super Admin
    atau Admin Prodi yang sudah login.
    """
    if db.query(User).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registrasi publik sudah ditutup. Hubungi Super Admin untuk dibuatkan akun.",
        )

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")

    user = User(
        nama=payload.nama,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=UserRole.super_admin,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email/password salah")

    token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role.value,
            "program_studi_id": user.program_studi_id,
            "fakultas_id": user.fakultas_id,
        },
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return user
