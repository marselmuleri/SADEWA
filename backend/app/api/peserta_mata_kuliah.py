from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.mk_bentuk_penilaian import MKBentukPenilaian
from app.models.mk_bentuk_penilaian_ik_map import MKBentukPenilaianIKMap
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.mk_bentuk_penilaian import (
    MKBentukPenilaianCreate, MKBentukPenilaianMapIKRequest, MKBentukPenilaianResponse, MKBentukPenilaianUpdate
)

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


@router.post("", response_model=MKBentukPenilaianResponse)
def create(payload: MKBentukPenilaianCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    _check_write_access(db, user, payload.mata_kuliah_id)
    data = MKBentukPenilaian(**payload.model_dump(), created_by=user.id)
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[MKBentukPenilaianResponse])
def list_all(
    mata_kuliah_id: int,
    semester: str | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(MKBentukPenilaian).join(MataKuliah).filter(MKBentukPenilaian.mata_kuliah_id == mata_kuliah_id)
    if semester:
        query = query.filter(MKBentukPenilaian.semester == semester)
    if scope.program_studi_id:
        query = query.filter(MataKuliah.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi, MataKuliah.program_studi_id == ProgramStudi.id).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.all()


@router.put("/{id}/map-ik")
def map_ik(id: int, payload: MKBentukPenilaianMapIKRequest, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    mbp = db.query(MKBentukPenilaian).filter(MKBentukPenilaian.id == id).first()
    if not mbp:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    _check_write_access(db, user, mbp.mata_kuliah_id)

    total_bobot = sum(m.bobot for m in payload.mappings)
    if total_bobot > mbp.bobot:
        raise HTTPException(status_code=400, detail=f"Total bobot IK ({total_bobot}%) melebihi bobot Bentuk Penilaian ({mbp.bobot}%)")

    db.query(MKBentukPenilaianIKMap).filter(MKBentukPenilaianIKMap.mk_bentuk_penilaian_id == id).delete()
    for m in payload.mappings:
        db.add(MKBentukPenilaianIKMap(mk_bentuk_penilaian_id=id, ik_id=m.ik_id, bobot=m.bobot))
    db.commit()
    return {"message": "Mapping IK berhasil disimpan"}