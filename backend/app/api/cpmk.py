from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, get_current_user, require_roles
from app.models.cpmk import CPMK
from app.models.cpmk_ik_map import CPMKIKMap
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.cpmk import CPMKCreate, CPMKMapIKRequest, CPMKResponse, CPMKUpdate

router = APIRouter()


def _check_write_access(db: Session, user: User, mata_kuliah_id: int) -> MataKuliah:
    mk = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if user.role == UserRole.admin_prodi:
        if mk.program_studi_id != user.program_studi_id:
            raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    elif user.role == UserRole.dosen:
        is_pengampu = db.query(PengampuMataKuliah).filter(
            PengampuMataKuliah.mata_kuliah_id == mata_kuliah_id,
            PengampuMataKuliah.user_id == user.id,
        ).first()
        if not is_pengampu:
            raise HTTPException(status_code=403, detail="Anda bukan dosen pengampu mata kuliah ini")
    return mk


@router.post("", response_model=CPMKResponse)
def create_cpmk(
    payload: CPMKCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    _check_write_access(db, user, payload.mata_kuliah_id)
    data = CPMK(**payload.model_dump(), created_by=user.id)
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[CPMKResponse])
def list_cpmk(
    mata_kuliah_id: int | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(CPMK).join(MataKuliah)
    if mata_kuliah_id:
        query = query.filter(CPMK.mata_kuliah_id == mata_kuliah_id)
    if scope.program_studi_id:
        query = query.filter(MataKuliah.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi, MataKuliah.program_studi_id == ProgramStudi.id).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.all()


@router.put("/{cpmk_id}", response_model=CPMKResponse)
def update_cpmk(
    cpmk_id: int,
    payload: CPMKUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    data = db.query(CPMK).filter(CPMK.id == cpmk_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPMK tidak ditemukan")
    _check_write_access(db, user, data.mata_kuliah_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.put("/{cpmk_id}/map-ik")
def map_ik(
    cpmk_id: int,
    payload: CPMKMapIKRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    cpmk = db.query(CPMK).filter(CPMK.id == cpmk_id).first()
    if not cpmk:
        raise HTTPException(status_code=404, detail="CPMK tidak ditemukan")
    _check_write_access(db, user, cpmk.mata_kuliah_id)

    total_bobot = sum(m.bobot for m in payload.mappings)
    if total_bobot > cpmk.bobot:
        raise HTTPException(status_code=400, detail=f"Total bobot IK ({total_bobot}%) melebihi bobot CPMK ({cpmk.bobot}%)")

    db.query(CPMKIKMap).filter(CPMKIKMap.cpmk_id == cpmk_id).delete()
    for m in payload.mappings:
        db.add(CPMKIKMap(cpmk_id=cpmk_id, ik_id=m.ik_id, bobot=m.bobot))
    db.commit()
    return {"message": "Mapping IK berhasil disimpan"}