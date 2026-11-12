from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope
from app.models.enums import UserRole
from app.models.mahasiswa import Mahasiswa
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.program_studi import ProgramStudi
from app.services.analitik import analitik_mata_kuliah, analitik_prodi
from app.services.analitik_mahasiswa import analitik_mahasiswa, daftar_mahasiswa
from app.services.kurikulum_aktif import kurikulum_aktif_id

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



def _cakupan_mahasiswa(
    db: Session, scope: AcademicScope, program_studi_id: int | None, mata_kuliah_id: int | None,
) -> dict:
    """
    Cakupan analitik per mahasiswa:
      - Dosen  : mahasiswa peserta mata kuliah yang diampu (opsional satu MK).
      - Kaprodi: seluruh mahasiswa prodi (opsional dipersempit ke peserta satu MK).
      - Dekan  : seluruh mahasiswa prodi terpilih di fakultasnya.
    """
    role = scope.user.role
    if role == UserRole.dosen:
        diampu = [
            p.mata_kuliah_id
            for p in db.query(PengampuMataKuliah).filter(PengampuMataKuliah.user_id == scope.user.id).all()
        ]
        if mata_kuliah_id:
            if mata_kuliah_id not in diampu:
                raise HTTPException(status_code=403, detail="Anda bukan dosen pengampu mata kuliah ini")
            diampu = [mata_kuliah_id]
        return {"mk_ids": diampu, "prodi_id": scope.program_studi_id, "prodi_penuh": False, "kurikulum_id": None}

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
        raise HTTPException(status_code=403, detail="Role ini tidak memiliki akses analitik OBE")

    # Kaprodi/Dekan: hanya mata kuliah kurikulum aktif prodi (ditetapkan Admin Prodi).
    aktif_id = kurikulum_aktif_id(db, prodi_id)
    mk_ids = [
        m.id for m in db.query(MataKuliah.id).filter(
            MataKuliah.program_studi_id == prodi_id, MataKuliah.kurikulum_version_id == aktif_id,
        ).all()
    ] if aktif_id else []
    if mata_kuliah_id:
        if mata_kuliah_id not in mk_ids:
            raise HTTPException(status_code=403, detail="Mata kuliah ini di luar kurikulum aktif prodi Anda")
        return {"mk_ids": [mata_kuliah_id], "prodi_id": prodi_id, "prodi_penuh": False, "kurikulum_id": aktif_id}
    return {"mk_ids": mk_ids, "prodi_id": prodi_id, "prodi_penuh": True, "kurikulum_id": aktif_id}


@router.get("/mahasiswa", response_model=dict[str, Any])
def get_daftar_mahasiswa(
    program_studi_id: int | None = None,
    mata_kuliah_id: int | None = None,
    angkatan: int | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """Ringkasan capaian per mahasiswa dalam cakupan role (lihat _cakupan_mahasiswa)."""
    cakupan = _cakupan_mahasiswa(db, scope, program_studi_id, mata_kuliah_id)
    return daftar_mahasiswa(db, angkatan=angkatan, search=search, **cakupan)


@router.get("/mahasiswa/{mahasiswa_id}", response_model=dict[str, Any])
def get_analitik_mahasiswa(
    mahasiswa_id: int,
    program_studi_id: int | None = None,
    mata_kuliah_id: int | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """Detail capaian CPL, IK, dan CPMK satu mahasiswa, dibatasi cakupan role."""
    cakupan = _cakupan_mahasiswa(db, scope, program_studi_id, mata_kuliah_id)
    mhs = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id, Mahasiswa.is_active.is_(True)).first()
    if not mhs:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    if cakupan["prodi_penuh"]:
        if mhs.program_studi_id != cakupan["prodi_id"]:
            raise HTTPException(status_code=403, detail="Mahasiswa ini di luar prodi Anda")
    else:
        ikut = db.query(PesertaMataKuliah).filter(
            PesertaMataKuliah.mahasiswa_id == mhs.id,
            PesertaMataKuliah.mata_kuliah_id.in_(cakupan["mk_ids"] or [-1]),
        ).first()
        if not ikut:
            raise HTTPException(status_code=403, detail="Mahasiswa ini bukan peserta mata kuliah dalam cakupan Anda")
    return analitik_mahasiswa(db, mhs, **cakupan)
