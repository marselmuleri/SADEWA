from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.cpmk import CPMK
from app.models.cpmk_ik_map import CPMKIKMap
from app.models.user import User
from app.schemas.cpmk import CPMKCreate, CPMKMapIKRequest, CPMKResponse, CPMKUpdate

router = APIRouter()


@router.post("", response_model=CPMKResponse)
def create_cpmk(payload: CPMKCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.dosen))):
    data = CPMK(**payload.model_dump(), created_by=user.id)
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[CPMKResponse])
def list_cpmk(mata_kuliah_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = db.query(CPMK)
    if mata_kuliah_id:
        query = query.filter(CPMK.mata_kuliah_id == mata_kuliah_id)
    return query.all()


@router.put("/{cpmk_id}", response_model=CPMKResponse)
def update_cpmk(cpmk_id: int, payload: CPMKUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.dosen))):
    data = db.query(CPMK).filter(CPMK.id == cpmk_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="CPMK tidak ditemukan")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.put("/{cpmk_id}/map-ik")
def map_ik(cpmk_id: int, payload: CPMKMapIKRequest, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.dosen))):
    cpmk = db.query(CPMK).filter(CPMK.id == cpmk_id).first()
    if not cpmk:
        raise HTTPException(status_code=404, detail="CPMK tidak ditemukan")

    total_bobot = sum(m.bobot for m in payload.mappings)
    if total_bobot > cpmk.bobot:
        raise HTTPException(status_code=400, detail=f"Total bobot IK ({total_bobot}%) melebihi bobot CPMK ({cpmk.bobot}%)")

    db.query(CPMKIKMap).filter(CPMKIKMap.cpmk_id == cpmk_id).delete()
    for m in payload.mappings:
        db.add(CPMKIKMap(cpmk_id=cpmk_id, ik_id=m.ik_id, bobot=m.bobot))
    db.commit()
    return {"message": "Mapping IK berhasil disimpan"}