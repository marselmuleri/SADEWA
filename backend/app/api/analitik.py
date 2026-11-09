from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.program_studi import ProgramStudi
from app.services.analitik import analitik_mata_kuliah, analitik_prodi

router = APIRouter()


@router.get("/prodi", response_model=dict[str, Any])
def get_analitik_prodi(
    program_studi_id: int | None = None,
    semester: Literal["Ganjil", "Genap"] | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """
    Data agregat Analitik OBE tingkat prodi (tanpa nama mahasiswa).
    Hanya Kaprodi (prodi sendiri) dan Dekan (pilih prodi di fakultasnya).
    """
    role = scope.user.role
    if role == UserRole.kaprodi:
        prodi_id = scope.program_studi_id
    elif role == UserRole.dekan:
        if not program_studi_id:
            raise HTTPException(status_code=400, detail="program_studi_id wajib diisi (pilih salah satu prodi di fakultas Anda)")
        prodi = db.query(ProgramStudi).filter(ProgramStudi.id == program_studi_id).first()
        if not prodi or prodi.fakultas_id != scope.fakultas_id:
            raise HTTPException(status_code=403, detail="Program Studi ini di luar fakultas Anda")
        prodi_id = program_studi_id
    else:
        raise HTTPException(status_code=403, detail="Analitik tingkat prodi hanya untuk Kaprodi dan Dekan")
    return analitik_prodi(db, prodi_id, semester)


@router.get("/mata-kuliah/{mata_kuliah_id}", response_model=dict[str, Any])
def get_analitik_mata_kuliah(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """
    Data Analitik OBE dengan bentuk yang sama seperti /prodi, tetapi untuk satu mata kuliah.
    Dosen: hanya MK yang diampu. Kaprodi: MK di prodinya. Dekan: MK di fakultasnya.
    """
    role = scope.user.role
    if role not in (UserRole.dosen, UserRole.kaprodi, UserRole.dekan):
        raise HTTPException(status_code=403, detail="Role ini tidak memiliki akses analitik OBE")
    mk = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if role == UserRole.dosen:
        pengampu = db.query(PengampuMataKuliah).filter(
            PengampuMataKuliah.mata_kuliah_id == mk.id,
            PengampuMataKuliah.user_id == scope.user.id,
        ).first()
        if not pengampu:
            raise HTTPException(status_code=403, detail="Anda bukan dosen pengampu mata kuliah ini")
    elif role == UserRole.kaprodi and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    elif role == UserRole.dekan and (not mk.program_studi or mk.program_studi.fakultas_id != scope.fakultas_id):
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")
    return analitik_mata_kuliah(db, mk)
