import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, get_scoped_prodi_id
from app.schemas.mahasiswa import MahasiswaBatchCreate, MahasiswaCreate, MahasiswaResponse, MahasiswaUpdate
from app.models.mahasiswa import Mahasiswa
from app.models.program_studi import ProgramStudi
from app.models.enums import StatusAkademik

router = APIRouter()


def derive_angkatan(nim: str, given_angkatan: int | None = None) -> int | None:
    if given_angkatan:
        return given_angkatan
    if nim:
        digits = re.sub(r"\D", "", nim)
        if len(digits) >= 8:
            yy = int(digits[6:8])
            if 0 <= yy <= 99:
                return 2000 + yy
        if len(digits) >= 2:
            yy = int(digits[:2])
            if 15 <= yy <= 35:
                return 2000 + yy
    return None


@router.post("", response_model=MahasiswaResponse)
def create_mahasiswa(payload: MahasiswaCreate, db: Session = Depends(get_db), prodi_id: int = Depends(get_scoped_prodi_id)):
    existing = db.query(Mahasiswa).filter(
        Mahasiswa.program_studi_id == prodi_id,
        Mahasiswa.nim == payload.nim,
        Mahasiswa.is_active.is_(True),
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Mahasiswa dengan NIM '{payload.nim}' sudah terdaftar pada program studi ini",
        )

    angkatan_val = derive_angkatan(payload.nim, payload.angkatan)
    dump_data = payload.model_dump()
    dump_data["angkatan"] = angkatan_val
    dump_data["status_akademik"] = payload.status_akademik.value
    dump_data["program_studi_id"] = prodi_id

    data = Mahasiswa(**dump_data)
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.post("/batch", response_model=list[MahasiswaResponse])
def batch_create_mahasiswa(payload: MahasiswaBatchCreate, db: Session = Depends(get_db), prodi_id: int = Depends(get_scoped_prodi_id)):
    created = []
    seen_nim: set[str] = set()

    for item in payload.records:
        if item.nim in seen_nim:
            continue
        seen_nim.add(item.nim)

        existing = db.query(Mahasiswa).filter(
            Mahasiswa.program_studi_id == prodi_id,
            Mahasiswa.nim == item.nim,
            Mahasiswa.is_active.is_(True),
        ).first()
        if existing:
            continue

        angkatan_val = derive_angkatan(item.nim, item.angkatan)
        dump_data = item.model_dump()
        dump_data["angkatan"] = angkatan_val
        dump_data["status_akademik"] = item.status_akademik.value
        dump_data["program_studi_id"] = prodi_id

        data = Mahasiswa(**dump_data)
        db.add(data)
        created.append(data)

    db.commit()
    for d in created:
        db.refresh(d)
    return created


@router.get("", response_model=list[MahasiswaResponse])
def list_mahasiswa(
    search: str | None = Query(default=None),
    angkatan: int | None = Query(default=None),
    status_akademik: StatusAkademik | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(Mahasiswa).filter(Mahasiswa.is_active.is_(True))
    if search:
        pattern = f"%{search}%"
        query = query.filter((Mahasiswa.nama.ilike(pattern)) | (Mahasiswa.nim.ilike(pattern)))
    if angkatan:
        query = query.filter(Mahasiswa.angkatan == angkatan)
    if status_akademik:
        query = query.filter(Mahasiswa.status_akademik == status_akademik.value)
    if scope.program_studi_id:
        query = query.filter(Mahasiswa.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.order_by(Mahasiswa.id.desc()).offset((page - 1) * limit).limit(limit).all()


@router.get("/{mahasiswa_id}", response_model=MahasiswaResponse)
def get_mahasiswa(mahasiswa_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    data = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id, Mahasiswa.is_active.is_(True)).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    if scope.program_studi_id and data.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mahasiswa ini di luar prodi Anda")
    if scope.fakultas_id and data.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mahasiswa ini di luar fakultas Anda")
    return data


@router.put("/{mahasiswa_id}", response_model=MahasiswaResponse)
def update_mahasiswa(mahasiswa_id: int, payload: MahasiswaUpdate, db: Session = Depends(get_db), prodi_id: int = Depends(get_scoped_prodi_id)):
    data = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id, Mahasiswa.is_active.is_(True)).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh mengubah mahasiswa di luar prodi Anda")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "status_akademik":
            if value is None:
                continue
            value = value.value
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{mahasiswa_id}")
def delete_mahasiswa(mahasiswa_id: int, db: Session = Depends(get_db), prodi_id: int = Depends(get_scoped_prodi_id)):
    data = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id, Mahasiswa.is_active.is_(True)).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh menonaktifkan mahasiswa di luar prodi Anda")
    data.is_active = False
    db.commit()
    return {"message": "Mahasiswa dinonaktifkan"}