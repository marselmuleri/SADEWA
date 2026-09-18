from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import require_roles, get_current_user
from app.models.enums import UserRole
from app.models.mk_bentuk_penilaian import MKBentukPenilaian
from app.models.mk_bentuk_penilaian_ik_map import MKBentukPenilaianIKMap
from app.models.user import User
from app.schemas.mk_bentuk_penilaian import (
    MKBentukPenilaianCreate, MKBentukPenilaianMapIKRequest, MKBentukPenilaianResponse, MKBentukPenilaianUpdate
)

router = APIRouter()


@router.post("", response_model=MKBentukPenilaianResponse)
def create(payload: MKBentukPenilaianCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.dosen))):
    data = MKBentukPenilaian(**payload.model_dump(), created_by=user.id)
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[MKBentukPenilaianResponse])
def list_all(mata_kuliah_id: int, semester: str | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = db.query(MKBentukPenilaian).filter(MKBentukPenilaian.mata_kuliah_id == mata_kuliah_id)
    if semester:
        query = query.filter(MKBentukPenilaian.semester == semester)
    return query.all()


@router.put("/{id}/map-ik")
def map_ik(id: int, payload: MKBentukPenilaianMapIKRequest, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.dosen))):
    mbp = db.query(MKBentukPenilaian).filter(MKBentukPenilaian.id == id).first()
    if not mbp:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")

    total_bobot = sum(m.bobot for m in payload.mappings)
    if total_bobot > mbp.bobot:
        raise HTTPException(status_code=400, detail=f"Total bobot IK ({total_bobot}%) melebihi bobot Bentuk Penilaian ({mbp.bobot}%)")

    db.query(MKBentukPenilaianIKMap).filter(MKBentukPenilaianIKMap.mk_bentuk_penilaian_id == id).delete()
    for m in payload.mappings:
        db.add(MKBentukPenilaianIKMap(mk_bentuk_penilaian_id=id, ik_id=m.ik_id, bobot=m.bobot))
    db.commit()
    return {"message": "Mapping IK berhasil disimpan"}