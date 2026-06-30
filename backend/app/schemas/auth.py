from pydantic import BaseModel, EmailStr
from app.models.enums import UserRole
from app.schemas.common import ORMBaseModel


class UserRegister(BaseModel):
    nama: str
    email: EmailStr
    password: str
    role: UserRole


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(ORMBaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(ORMBaseModel):
    id: int
    nama: str
    email: EmailStr
    role: UserRole
    is_active: bool


class UserUpdate(BaseModel):
    nama: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None
