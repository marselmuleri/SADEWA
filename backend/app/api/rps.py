import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.rps import RPS
from app.models.user import User
from app.schemas.rps import RPSGenerateRequest, RPSResponse
from app.services import ai_client

logger = logging.getLogger(__name__)

router = APIRouter()


def _check_write_access(db: Session, user: User, mata_kuliah_id: int) -> MataKuliah:
    mk = (
        db.query(MataKuliah)
        .options(joinedload(MataKuliah.program_studi))
        .filter(MataKuliah.id == mata_kuliah_id)
        .first()
    )
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


def _semester_label(mk: MataKuliah) -> str:
    raw = mk.semester
    if hasattr(raw, "value"):
        return str(raw.value)
    return str(raw) if raw else "Ganjil"


async def _execute_generate_rps(
    mata_kuliah_id: int,
    payload: RPSGenerateRequest,
    db: Session,
    user: User,
) -> RPS:
    mk = _check_write_access(db, user, mata_kuliah_id)
    prodi_nama = mk.program_studi.nama if mk.program_studi else "Program Studi"
    sks_val = mk.sks if mk.sks in (1, 2, 3, 4, 6) else 3
    semester_val = payload.semester or _semester_label(mk)

    # Panggil AI Service via REST HTTP
    ai_result = await ai_client.generate_rps(
        mk_name=mk.nama or f"Mata Kuliah {mk.kode}",
        sks=sks_val,
        semester=semester_val,
        prodi=prodi_nama,
        deskripsi=payload.topik or "",
    )

    rps_data = ai_result.get("data")
    sumber_metadata = ai_result.get("sumber_dokumen") or ai_result.get("metadata")

    data = RPS(
        mata_kuliah_id=mata_kuliah_id,
        tahun_ajaran=payload.tahun_ajaran,
        semester=payload.semester,
        status="draft",
        konten=rps_data,
        sumber_dokumen_rag=sumber_metadata,
        created_by=user.id,
    )
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.post("/{mata_kuliah_id}/generate", response_model=RPSResponse)
async def generate_rps_prd(
    mata_kuliah_id: int,
    payload: RPSGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    """
    Generate draf RPS 16 pertemuan berbasis OBE via AI Service (REST HTTP port 8001).
    Endpoint standar PRD: POST /api/v1/rps/{mata_kuliah_id}/generate
    """
    return await _execute_generate_rps(mata_kuliah_id, payload, db, user)


@router.post("/generate/{matkul_id}", response_model=RPSResponse, include_in_schema=False)
async def generate_rps_legacy_alias(
    matkul_id: int,
    payload: RPSGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    """Alias backward compatibility untuk /generate/{matkul_id}."""
    return await _execute_generate_rps(matkul_id, payload, db, user)


@router.get("/{mata_kuliah_id}", response_model=list[RPSResponse])
def list_rps(mata_kuliah_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    query = db.query(RPS).join(MataKuliah).filter(RPS.mata_kuliah_id == mata_kuliah_id)
    if scope.program_studi_id:
        query = query.filter(MataKuliah.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi, MataKuliah.program_studi_id == ProgramStudi.id).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.order_by(RPS.id.desc()).all()