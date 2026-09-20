from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, get_scoped_prodi_id
from app.models.mata_kuliah import MataKuliah
from app.models.program_studi import ProgramStudi
from app.schemas.mata_kuliah import MataKuliahCreate, MataKuliahResponse, MataKuliahUpdate

router = APIRouter()


@router.post("", response_model=MataKuliahResponse)
def create_mata_kuliah(
    payload: MataKuliahCreate,
    db: Session = Depends(get_db),
    prodi_id: int = Depends(get_scoped_prodi_id),
):
    data = MataKuliah(**{**payload.model_dump(), "program_studi_id": prodi_id})
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("", response_model=list[MataKuliahResponse])
def list_mata_kuliah(
    kurikulum_version_id: int | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(MataKuliah)
    if kurikulum_version_id:
        query = query.filter(MataKuliah.kurikulum_version_id == kurikulum_version_id)
    if scope.program_studi_id:
        query = query.filter(MataKuliah.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.all()


@router.get("/{mata_kuliah_id}", response_model=MataKuliahResponse)
def get_mata_kuliah(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    data = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if scope.program_studi_id and data.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    if scope.fakultas_id and data.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")
    return data


@router.put("/{mata_kuliah_id}", response_model=MataKuliahResponse)
def update_mata_kuliah(
    mata_kuliah_id: int,
    payload: MataKuliahUpdate,
    db: Session = Depends(get_db),
    prodi_id: int = Depends(get_scoped_prodi_id),
):
    data = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh mengubah mata kuliah di luar prodi Anda")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(data, key, value)
    db.commit()
    db.refresh(data)
    return data