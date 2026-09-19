from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.security import get_password_hash
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse, UserUpdate

router = APIRouter()

# Role yang boleh dibuat/dikelola oleh Admin Prodi. Admin Prodi TIDAK boleh
# membuat/mengubah akun Super Admin, Admin Prodi lain, atau Dekan.
ADMIN_PRODI_MANAGED_ROLES = (UserRole.dosen, UserRole.kaprodi)


def _validate_scope_for_role(role: UserRole, program_studi_id: int | None, fakultas_id: int | None):
    if role in (UserRole.admin_prodi, UserRole.kaprodi) and not program_studi_id:
        raise HTTPException(400, f"program_studi_id wajib diisi untuk role {role.value}")
    if role == UserRole.dekan and not fakultas_id:
        raise HTTPException(400, "fakultas_id wajib diisi untuk role dekan")
    if role in (UserRole.super_admin, UserRole.dosen) and (program_studi_id or fakultas_id):
        raise HTTPException(400, f"Role {role.value} tidak boleh memiliki program_studi_id/fakultas_id")


@router.post("", response_model=UserResponse)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.super_admin, UserRole.admin_prodi)),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "Email sudah terdaftar")

    program_studi_id = payload.program_studi_id
    fakultas_id = payload.fakultas_id

    if current_user.role == UserRole.admin_prodi:
        if payload.role not in ADMIN_PRODI_MANAGED_ROLES:
            raise HTTPException(
                403,
                "Admin Prodi hanya bisa membuat akun dengan role Dosen atau Kaprodi",
            )
        # Kunci ke prodi Admin Prodi sendiri -- nilai kiriman client diabaikan total,
        # supaya Admin Prodi tidak bisa membuat akun untuk prodi lain.
        program_studi_id = current_user.program_studi_id
        fakultas_id = None
    else:
        # Super Admin: bebas pilih role apa pun, tapi tetap divalidasi kelengkapan scope-nya.
        _validate_scope_for_role(payload.role, program_studi_id, fakultas_id)

    user = User(
        nama=payload.nama,
        nip=payload.nip,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        program_studi_id=program_studi_id,
        fakultas_id=fakultas_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=list[UserResponse])
def list_users(
    role: UserRole | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.super_admin, UserRole.admin_prodi)),
):
    query = db.query(User)

    if current_user.role == UserRole.admin_prodi:
        # Hanya lihat Dosen/Kaprodi di prodinya sendiri, tidak bisa lihat
        # Super Admin, Dekan, atau Admin Prodi lain sama sekali.
        query = query.filter(
            User.program_studi_id == current_user.program_studi_id,
            User.role.in_(ADMIN_PRODI_MANAGED_ROLES),
        )

    if role:
        query = query.filter(User.role == role)

    return query.order_by(User.nama.asc()).all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.super_admin, UserRole.admin_prodi)),
):
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise HTTPException(404, "User tidak ditemukan")
    if current_user.role == UserRole.admin_prodi and (
        row.program_studi_id != current_user.program_studi_id or row.role not in ADMIN_PRODI_MANAGED_ROLES
    ):
        raise HTTPException(403, "Tidak boleh melihat akun di luar prodi Anda")
    return row


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.super_admin, UserRole.admin_prodi)),
):
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise HTTPException(404, "User tidak ditemukan")

    data = payload.model_dump(exclude_unset=True)

    if current_user.role == UserRole.admin_prodi:
        if row.program_studi_id != current_user.program_studi_id or row.role not in ADMIN_PRODI_MANAGED_ROLES:
            raise HTTPException(403, "Tidak boleh mengubah akun di luar prodi Anda")
        if "role" in data and data["role"] not in ADMIN_PRODI_MANAGED_ROLES:
            raise HTTPException(403, "Admin Prodi tidak boleh mengubah role ke selain Dosen/Kaprodi")
        # Prodi & fakultas tetap terkunci, tidak peduli apa yang dikirim client.
        data["program_studi_id"] = current_user.program_studi_id
        data["fakultas_id"] = None
    else:
        # Super Admin: kalau role diganti, scope harus tetap konsisten dengan role barunya.
        new_role = data.get("role", row.role)
        new_prodi = data.get("program_studi_id", row.program_studi_id)
        new_fakultas = data.get("fakultas_id", row.fakultas_id)
        _validate_scope_for_role(new_role, new_prodi, new_fakultas)

    if "password" in data:  # jaga-jaga kalau field ini pernah ditambahkan ke UserUpdate
        data["password_hash"] = get_password_hash(data.pop("password"))

    for key, value in data.items():
        setattr(row, key, value)

    db.commit()
    db.refresh(row)
    return row


@router.delete("/{user_id}")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.super_admin, UserRole.admin_prodi)),
):
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise HTTPException(404, "User tidak ditemukan")

    if current_user.role == UserRole.admin_prodi and (
        row.program_studi_id != current_user.program_studi_id or row.role not in ADMIN_PRODI_MANAGED_ROLES
    ):
        raise HTTPException(403, "Tidak boleh menonaktifkan akun di luar prodi Anda")

    if row.id == current_user.id:
        raise HTTPException(400, "Tidak bisa menonaktifkan akun Anda sendiri")

    row.is_active = False
    db.commit()
    return {"message": "User dinonaktifkan"}
