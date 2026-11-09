from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, get_scoped_prodi_id, get_current_user
from app.models.arsip_kurikulum import ArsipKurikulum
from app.models.enums import SemesterEnum, UserRole
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.schemas.arsip import ArsipDetail, ArsipRingkas, ArsipSemesterCreate
from app.services.arsip import JENIS_PUBLISH, JENIS_SEMESTER, arsipkan_semester

router = APIRouter()


def _ringkas(a: ArsipKurikulum, cls=ArsipRingkas, **extra):
    return cls(
        id=a.id, program_studi_id=a.program_studi_id, jenis=a.jenis, judul=a.judul,
        kurikulum_version_id=a.kurikulum_version_id,
        semester=a.semester.value if a.semester else None, tahun_ajaran=a.tahun_ajaran,
        ringkasan=a.ringkasan, dibuat_oleh_nama=a.pembuat.nama if a.pembuat else None,
        created_at=a.created_at, **extra,
    )


def _scoped_query(db: Session, scope: AcademicScope, program_studi_id: int | None):
    query = db.query(ArsipKurikulum)
    if scope.program_studi_id:
        return query.filter(ArsipKurikulum.program_studi_id == scope.program_studi_id)
    if scope.fakultas_id:
        prodi_ids = [p.id for p in db.query(ProgramStudi.id).filter(ProgramStudi.fakultas_id == scope.fakultas_id).all()]
        if program_studi_id is not None:
            if program_studi_id not in prodi_ids:
                raise HTTPException(status_code=403, detail="Program Studi ini di luar fakultas Anda")
            prodi_ids = [program_studi_id]
        return query.filter(ArsipKurikulum.program_studi_id.in_(prodi_ids))
    raise HTTPException(status_code=403, detail="Role ini tidak memiliki akses arsip kurikulum")


@router.get("", response_model=list[ArsipRingkas])
def list_arsip(
    jenis: str | None = None,
    program_studi_id: int | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """Daftar arsip Data Master (tanpa isi). Semua role akademik, read-only."""
    if jenis and jenis not in (JENIS_PUBLISH, JENIS_SEMESTER):
        raise HTTPException(status_code=400, detail="Jenis arsip tidak dikenal")
    query = _scoped_query(db, scope, program_studi_id)
    if jenis:
        query = query.filter(ArsipKurikulum.jenis == jenis)
    rows = query.order_by(ArsipKurikulum.created_at.desc(), ArsipKurikulum.id.desc()).all()
    return [_ringkas(a) for a in rows]


@router.get("/{arsip_id}", response_model=ArsipDetail)
def get_arsip(
    arsip_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    arsip = _scoped_query(db, scope, None).filter(ArsipKurikulum.id == arsip_id).first()
    if not arsip:
        raise HTTPException(status_code=404, detail="Arsip tidak ditemukan")
    return _ringkas(arsip, ArsipDetail, data=arsip.data)


@router.post("/semester", response_model=ArsipRingkas)
def tutup_semester(
    payload: ArsipSemesterCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Admin Prodi mengarsipkan data mata kuliah satu semester yang sudah selesai berjalan."""
    if user.role != UserRole.admin_prodi:
        raise HTTPException(status_code=403, detail="Hanya Admin Prodi yang dapat mengarsipkan semester")
    prodi_id = get_scoped_prodi_id(user)
    semester = SemesterEnum(payload.semester)
    tahun_ajaran = payload.tahun_ajaran.strip()

    sudah = db.query(ArsipKurikulum).filter(
        ArsipKurikulum.program_studi_id == prodi_id,
        ArsipKurikulum.jenis == JENIS_SEMESTER,
        ArsipKurikulum.semester == semester,
        ArsipKurikulum.tahun_ajaran == tahun_ajaran,
    ).first()
    if sudah:
        raise HTTPException(status_code=409, detail=f"Semester {semester.value} {tahun_ajaran} sudah diarsipkan")

    arsip = arsipkan_semester(db, prodi_id, semester, tahun_ajaran, user.id)
    if not arsip.data["mata_kuliah"]:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Tidak ada mata kuliah pada semester {semester.value} {tahun_ajaran}")
    db.commit()
    db.refresh(arsip)
    return _ringkas(arsip)
