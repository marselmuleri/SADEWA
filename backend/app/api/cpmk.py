from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, get_current_user, require_roles
from app.models.cpmk import CPMK
from app.models.cpmk_ik_map import CPMKIKMap
from app.models.ik import IK
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.cpmk import CPMKCreate, CPMKIKMapItem, CPMKMapIKRequest, CPMKResponse, CPMKUpdate

router = APIRouter()


def _check_write_access(db: Session, user: User, mata_kuliah_id: int) -> MataKuliah:
    mk = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if user.role in (UserRole.admin_prodi, UserRole.kaprodi):
        if mk.program_studi_id != user.program_studi_id:
            raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    elif user.role == UserRole.dosen:
        is_pengampu = db.query(PengampuMataKuliah).filter(
            PengampuMataKuliah.mata_kuliah_id == mata_kuliah_id,
            PengampuMataKuliah.user_id == user.id,
        ).first()
        if not is_pengampu:
            raise HTTPException(status_code=403, detail="Anda bukan dosen pengampu mata kuliah ini")
    elif user.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")
    return mk


@router.post("", response_model=CPMKResponse)
def create_cpmk(
    payload: CPMKCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi, UserRole.dosen)),
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
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi, UserRole.dosen)),
):
    data = db.query(CPMK).filter(CPMK.id == cpmk_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPMK tidak ditemukan")
    _check_write_access(db, user, data.mata_kuliah_id)

    # Dosen pengampu dilarang mengubah bobot CPMK (C10)
    if user.role == UserRole.dosen and payload.bobot is not None:
        raise HTTPException(status_code=403, detail="Dosen pengampu dilarang mengubah bobot CPMK")

    # Revalidasi C3: Jika bobot CPMK diubah dan mapping IK sudah ada
    if payload.bobot is not None:
        existing_mappings = db.query(CPMKIKMap).filter(CPMKIKMap.cpmk_id == cpmk_id).all()
        if existing_mappings:
            total_ik = sum(Decimal(str(m.bobot)) for m in existing_mappings)
            if Decimal(str(payload.bobot)) != total_ik:
                raise HTTPException(
                    status_code=400,
                    detail=f"Bobot CPMK baru ({payload.bobot}) tidak cocok dengan total bobot mapping IK yang sudah ada ({total_ik}). Ubah mapping IK terlebih dahulu atau perbarui secara bersamaan."
                )

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
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi, UserRole.dosen)),
):
    cpmk = db.query(CPMK).filter(CPMK.id == cpmk_id).first()
    if not cpmk:
        raise HTTPException(status_code=404, detail="CPMK tidak ditemukan")
    _check_write_access(db, user, cpmk.mata_kuliah_id)

    # Dosen pengampu dilarang mengubah mapping IK (C10)
    if user.role == UserRole.dosen:
        raise HTTPException(status_code=403, detail="Dosen pengampu dilarang mengubah mapping IK CPMK")

    # Jalur pembaruan atomik: ubah bobot CPMK jika disediakan
    if payload.bobot_cpmk is not None:
        cpmk.bobot = payload.bobot_cpmk

    if payload.mappings:
        # C4: IK yang dimapping harus berasal dari prodi yang sama dengan mata kuliah
        for m in payload.mappings:
            ik = db.query(IK).filter(IK.id == m.ik_id).first()
            if not ik:
                raise HTTPException(status_code=404, detail=f"IK ID {m.ik_id} tidak ditemukan")
            if ik.cpl.program_studi_id != cpmk.mata_kuliah.program_studi_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"IK '{ik.kode}' berasal dari prodi lain, bukan prodi mata kuliah"
                )

        # C3: Total bobot IK dalam satu CPMK HARUS sama persis dengan bobot CPMK
        total_bobot = sum(Decimal(str(m.bobot)) for m in payload.mappings)
        cpmk_bobot = Decimal(str(cpmk.bobot))
        if total_bobot != cpmk_bobot:
            raise HTTPException(
                status_code=400,
                detail=f"Total bobot IK ({total_bobot}) harus sama persis dengan bobot CPMK ({cpmk_bobot})"
            )

    db.query(CPMKIKMap).filter(CPMKIKMap.cpmk_id == cpmk_id).delete()
    for m in payload.mappings:
        db.add(CPMKIKMap(cpmk_id=cpmk_id, ik_id=m.ik_id, bobot=m.bobot))
    db.commit()
    return {"message": "Mapping IK berhasil disimpan"}


@router.get("/{cpmk_id}/map-ik", response_model=list[CPMKIKMapItem])
def get_map_ik(
    cpmk_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    cpmk = db.query(CPMK).filter(CPMK.id == cpmk_id).first()
    if not cpmk:
        raise HTTPException(status_code=404, detail="CPMK tidak ditemukan")
    if scope.program_studi_id and cpmk.mata_kuliah.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="CPMK ini di luar prodi Anda")
    if scope.fakultas_id and cpmk.mata_kuliah.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="CPMK ini di luar fakultas Anda")

    mapping = db.query(CPMKIKMap).filter(CPMKIKMap.cpmk_id == cpmk_id).all()
    return [
        CPMKIKMapItem(ik_id=m.ik_id, ik_kode=m.ik.kode, bobot=m.bobot)
        for m in mapping
    ]