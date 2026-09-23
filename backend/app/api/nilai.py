from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.mk_bentuk_penilaian import MKBentukPenilaian
from app.models.nilai_bentuk_penilaian import NilaiBentukPenilaian
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.siap_sync_log import SiapSyncLog
from app.models.user import User
from app.schemas.nilai import NilaiManualInput, NilaiResponse, NilaiUpdate, SyncLogResponse

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


def _mata_kuliah_id_of_mk_bentuk_penilaian(db: Session, mk_bentuk_penilaian_id: int) -> int:
    mbp = db.query(MKBentukPenilaian).filter(MKBentukPenilaian.id == mk_bentuk_penilaian_id).first()
    if not mbp:
        raise HTTPException(status_code=404, detail="Bentuk penilaian mata kuliah tidak ditemukan")
    return mbp.mata_kuliah_id


@router.post("/sync")
def sync(mk_id: int, semester: str, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    _check_write_access(db, user, mk_id)
    # STUB: siap_undip_adapter.py belum diimplementasikan.
    # Endpoint & kontrak tetap sama; begitu adapter selesai, cukup ganti response
    # dan isi total_records dari hasil sinkronisasi nyata.
    log = SiapSyncLog(
        mata_kuliah_id=mk_id,
        semester=semester,
        status="not_configured",
        total_records=0,
        triggered_by=user.id,
    )
    db.add(log)
    db.commit()
    return {
        "status": "not_configured",
        "message": "Integrasi SIAP UNDIP belum tersedia. Gunakan input manual.",
        "fallback": "/nilai/manual",
    }


@router.get("/sync-logs/{mk_id}", response_model=list[SyncLogResponse])
def get_sync_logs(mk_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    mk = db.query(MataKuliah).filter(MataKuliah.id == mk_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if scope.program_studi_id and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    if scope.fakultas_id and mk.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")
    return db.query(SiapSyncLog).filter(SiapSyncLog.mata_kuliah_id == mk_id).order_by(SiapSyncLog.created_at.desc()).all()


@router.post("/manual", response_model=list[NilaiResponse])
def input_manual(payload: NilaiManualInput, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    # Cek akses tiap record berdasarkan mata kuliah yang dituju oleh mk_bentuk_penilaian_id-nya,
    # supaya tidak ada input nilai yang menyelinap ke mata kuliah di luar wewenang pengirim.
    checked_mk_ids: set[int] = set()
    for record in payload.records:
        mk_id = _mata_kuliah_id_of_mk_bentuk_penilaian(db, record.mk_bentuk_penilaian_id)
        if mk_id not in checked_mk_ids:
            _check_write_access(db, user, mk_id)
            checked_mk_ids.add(mk_id)

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
def get_nilai(mk_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    mk = db.query(MataKuliah).filter(MataKuliah.id == mk_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if scope.program_studi_id and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    if scope.fakultas_id and mk.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")
    return db.query(NilaiBentukPenilaian).join(PesertaMataKuliah).filter(PesertaMataKuliah.mata_kuliah_id == mk_id).all()


@router.put("/{nilai_id}", response_model=NilaiResponse)
def update_nilai(nilai_id: int, payload: NilaiUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    data = db.query(NilaiBentukPenilaian).filter(NilaiBentukPenilaian.id == nilai_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Nilai tidak ditemukan")
    mk_id = _mata_kuliah_id_of_mk_bentuk_penilaian(db, data.mk_bentuk_penilaian_id)
    _check_write_access(db, user, mk_id)
    data.nilai = payload.nilai
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{nilai_id}")
def delete_nilai(nilai_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    data = db.query(NilaiBentukPenilaian).filter(NilaiBentukPenilaian.id == nilai_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Nilai tidak ditemukan")
    mk_id = _mata_kuliah_id_of_mk_bentuk_penilaian(db, data.mk_bentuk_penilaian_id)
    _check_write_access(db, user, mk_id)
    db.delete(data)
    db.commit()
    return {"message": "Nilai dihapus"}