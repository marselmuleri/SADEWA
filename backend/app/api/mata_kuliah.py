from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, get_current_user, get_scoped_prodi_id, require_roles
from app.models.cpmk import CPMK
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.mk_bentuk_penilaian import MKBentukPenilaian
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.mata_kuliah import MataKuliahCreate, MataKuliahResponse, MataKuliahUpdate

router = APIRouter()


@router.post("", response_model=MataKuliahResponse)
def create_mata_kuliah(
    payload: MataKuliahCreate,
    db: Session = Depends(get_db),
    prodi_id: int = Depends(get_scoped_prodi_id),
):
    existing = db.query(MataKuliah).filter(
        MataKuliah.program_studi_id == prodi_id,
        MataKuliah.kurikulum_version_id == payload.kurikulum_version_id,
        MataKuliah.kode == payload.kode,
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Mata kuliah dengan kode '{payload.kode}' sudah ada pada kurikulum ini"
        )

    data = MataKuliah(**{**payload.model_dump(), "program_studi_id": prodi_id})
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("/saya", response_model=list[MataKuliahResponse])
def list_mata_kuliah_saya(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == UserRole.dosen:
        mk_ids = [p.mata_kuliah_id for p in db.query(PengampuMataKuliah).filter(PengampuMataKuliah.user_id == user.id).all()]
        return db.query(MataKuliah).filter(MataKuliah.id.in_(mk_ids)).all()
    elif user.role in (UserRole.admin_prodi, UserRole.kaprodi):
        return db.query(MataKuliah).filter(MataKuliah.program_studi_id == user.program_studi_id).all()
    elif user.role == UserRole.dekan:
        return db.query(MataKuliah).join(ProgramStudi).filter(ProgramStudi.fakultas_id == user.fakultas_id).all()
    return []


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


@router.delete("/{mata_kuliah_id}")
def delete_mata_kuliah(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    prodi_id: int = Depends(get_scoped_prodi_id),
):
    data = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh menghapus mata kuliah di luar prodi Anda")

    cpmk_count = db.query(CPMK).filter(CPMK.mata_kuliah_id == mata_kuliah_id).count()
    if cpmk_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Mata kuliah '{data.nama}' tidak dapat dihapus karena masih memiliki {cpmk_count} CPMK terkait."
        )

    peserta_count = db.query(PesertaMataKuliah).filter(PesertaMataKuliah.mata_kuliah_id == mata_kuliah_id).count()
    if peserta_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Mata kuliah '{data.nama}' tidak dapat dihapus karena masih memiliki {peserta_count} peserta mahasiswa."
        )

    mbp_count = db.query(MKBentukPenilaian).filter(MKBentukPenilaian.mata_kuliah_id == mata_kuliah_id).count()
    if mbp_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Mata kuliah '{data.nama}' tidak dapat dihapus karena masih memiliki bentuk penilaian kelas."
        )

    db.query(PengampuMataKuliah).filter(PengampuMataKuliah.mata_kuliah_id == mata_kuliah_id).delete()

    try:
        db.delete(data)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Mata kuliah '{data.nama}' tidak dapat dihapus karena masih memiliki data terkait."
        )
    return {"message": "Mata kuliah berhasil dihapus"}