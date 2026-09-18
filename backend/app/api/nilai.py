from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import require_roles, get_current_user
from app.models.enums import UserRole
from app.models.nilai_bentuk_penilaian import NilaiBentukPenilaian
from app.models.user import User
from app.schemas.nilai import NilaiManualInput, NilaiResponse, NilaiUpdate

router = APIRouter()


@router.post("/sync")
def sync(mk_id: int, semester: str, _: User = Depends(require_roles(UserRole.admin, UserRole.dosen))):
    return {
        "status": "not_configured",
        "message": "Integrasi SIAP UNDIP belum tersedia. Gunakan input manual.",
        "fallback": "/nilai/manual",
    }


@router.post("/manual", response_model=list[NilaiResponse])
def input_manual(payload: NilaiManualInput, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin, UserRole.dosen))):
    created = []
    for record in payload.records:
        data = NilaiBentukPenilaian(
            peserta_mata_kuliah_id=record.peserta_mata_kuliah_id,
            mk_bentuk_penilaian_id=record.mk_bentuk_penilaian_id,
            semester=payload.semester,
            nilai=record.nilai,
            source="manual",
            imported_by=user.id,
        )
        db.add(data)
        created.append(data)
    db.commit()
    for d in created:
        db.refresh(d)
    return created


@router.get("/{mk_id}", response_model=list[NilaiResponse])
def get_nilai(mk_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from app.models.peserta_mata_kuliah import PesertaMataKuliah
    return db.query(NilaiBentukPenilaian).join(PesertaMataKuliah).filter(PesertaMataKuliah.mata_kuliah_id == mk_id).all()


@router.put("/{nilai_id}", response_model=NilaiResponse)
def update_nilai(nilai_id: int, payload: NilaiUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.dosen))):
    data = db.query(NilaiBentukPenilaian).filter(NilaiBentukPenilaian.id == nilai_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Nilai tidak ditemukan")
    data.nilai = payload.nilai
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{nilai_id}")
def delete_nilai(nilai_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.dosen))):
    data = db.query(NilaiBentukPenilaian).filter(NilaiBentukPenilaian.id == nilai_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Nilai tidak ditemukan")
    db.delete(data)
    db.commit()
    return {"message": "Nilai dihapus"}