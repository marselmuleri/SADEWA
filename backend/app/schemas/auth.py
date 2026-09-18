from pydantic import BaseModel, EmailStr
from app.models.enums import UserRole
from app.schemas.common import ORMBaseModel


class UserRegister(BaseModel):
    nama: str
    nip: str | None = None
    email: EmailStr
    password: str
    role: UserRole
    program_studi_id: int | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(ORMBaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(ORMBaseModel):
    id: int
    nama: str
    nip: str | None = None
    email: EmailStr
    role: UserRole
    is_active: bool
    program_studi_id: int | None = None
    program_studi_ids: list[int] = []


class UserUpdate(BaseModel):
    nama: str | None = None
    nip: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    program_studi_id: int | None = None
    program_studi_ids: list[int] | None = None
