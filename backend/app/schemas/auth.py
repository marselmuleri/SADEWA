from pydantic import BaseModel, EmailStr, model_validator
from app.models.enums import UserRole
from app.schemas.common import ORMBaseModel


class UserRegister(BaseModel):
    """
    Dipakai HANYA untuk bootstrap Super Admin pertama (saat tabel users masih
    kosong). Tidak ada pilihan role/prodi/fakultas di sini secara sengaja --
    role dipaksa jadi super_admin oleh endpoint, supaya tidak ada orang luar
    yang bisa daftar sendiri sebagai role apa pun.
    Setelah Super Admin pertama ada, endpoint /auth/register akan menolak
    request apa pun (403). Pembuatan user selanjutnya lewat POST /users.
    """
    nama: str
    email: EmailStr
    password: str


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
    program_studi_nama: str | None = None
    fakultas_id: int | None = None
    fakultas_nama: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _flatten_relasi(cls, obj):
        # Ambil nama prodi/fakultas dari relationship SQLAlchemy kalau tersedia,
        # supaya frontend tidak perlu request tambahan hanya untuk menampilkan nama.
        if hasattr(obj, "program_studi") or hasattr(obj, "fakultas"):
            return {
                "id": obj.id,
                "nama": obj.nama,
                "nip": obj.nip,
                "email": obj.email,
                "role": obj.role,
                "is_active": obj.is_active,
                "program_studi_id": obj.program_studi_id,
                "program_studi_nama": obj.program_studi.nama if obj.program_studi else None,
                "fakultas_id": obj.fakultas_id,
                "fakultas_nama": obj.fakultas.nama if obj.fakultas else None,
            }
        return obj


class UserCreate(BaseModel):
    """Dipakai oleh Super Admin & Admin Prodi lewat POST /users."""
    nama: str
    nip: str | None = None
    email: EmailStr
    password: str
    role: UserRole
    program_studi_id: int | None = None
    fakultas_id: int | None = None


class UserUpdate(BaseModel):
    nama: str | None = None
    nip: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    program_studi_id: int | None = None
    fakultas_id: int | None = None
