from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.rps import RPS
from app.models.user import User
from app.schemas.rps import RPSGenerateRequest, RPSResponse

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


@router.post("/generate/{matkul_id}", response_model=RPSResponse)
def generate_rps(
    matkul_id: int,
    payload: RPSGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    _check_write_access(db, user, matkul_id)
    # STUB: modul RAG (LangChain + ChromaDB + Qwen API) belum terhubung.
    # Begitu ai_service.py siap, baris di bawah diganti pemanggilan RAG
    # (retrieval dokumen kurikulum + adaptasi tren industri + generate JSON 16 pertemuan).
    # Kontrak endpoint tidak berubah.
    data = RPS(
        mata_kuliah_id=matkul_id,
        tahun_ajaran=payload.tahun_ajaran,
        semester=payload.semester,
        status="draft",
        sumber_dokumen_rag={"note": "placeholder - menunggu integrasi modul RAG", "topik": payload.topik},
        created_by=user.id,
    )
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.get("/{matkul_id}", response_model=list[RPSResponse])
def list_rps(matkul_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    query = db.query(RPS).join(MataKuliah).filter(RPS.mata_kuliah_id == matkul_id)
    if scope.program_studi_id:
        query = query.filter(MataKuliah.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi, MataKuliah.program_studi_id == ProgramStudi.id).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.order_by(RPS.id.desc()).all()