from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.cpl import CPL
from app.models.enums import UserRole
from app.models.ik import IK
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.ik import IKCreate, IKResponse, IKUpdate

router = APIRouter()


@router.get("", response_model=list[IKResponse])
def list_ik(
    cpl_id: int | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(IK).join(CPL)
    if cpl_id:
        query = query.filter(IK.cpl_id == cpl_id)
    if scope.program_studi_id:
        query = query.filter(CPL.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi, CPL.program_studi_id == ProgramStudi.id).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.order_by(IK.urutan.asc().nulls_last(), IK.kode.asc()).all()


def _require_ik_write_scope(user: User) -> int:
    # Sesuai kode asli: hanya Admin Prodi yang boleh menulis IK (Kaprodi tidak,
    # beda dengan CPL/mata kuliah yang boleh keduanya).
    if not user.program_studi_id:
        raise HTTPException(status_code=400, detail="Akun ini belum terhubung ke Program Studi manapun")
    return user.program_studi_id


def _get_ik_or_404_in_scope(db: Session, ik_id: int, prodi_id: int) -> IK:
    data = db.query(IK).join(CPL).filter(IK.id == ik_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="IK tidak ditemukan")
    if data.cpl.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh mengubah IK di luar prodi Anda")
    return data


@router.post("", response_model=IKResponse)
def create_ik(
    payload: IKCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    prodi_id = _require_ik_write_scope(user)
    cpl = db.query(CPL).filter(CPL.id == payload.cpl_id).first()
    if not cpl:
        raise HTTPException(status_code=404, detail="CPL tidak ditemukan")
    if cpl.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="CPL ini di luar prodi Anda")
    data = IK(**payload.model_dump(), created_by=user.id)
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.put("/{ik_id}", response_model=IKResponse)
def update_ik(
    ik_id: int,
    payload: IKUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    prodi_id = _require_ik_write_scope(user)
    data = _get_ik_or_404_in_scope(db, ik_id, prodi_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{ik_id}")
def delete_ik(
    ik_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    prodi_id = _require_ik_write_scope(user)
    data = _get_ik_or_404_in_scope(db, ik_id, prodi_id)
    db.delete(data)
    db.commit()
    return {"message": "IK dihapus"}