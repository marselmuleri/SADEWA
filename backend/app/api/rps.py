from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.rps import RPS
from app.models.user import User
from app.schemas.rps import RPSGenerateRequest, RPSResponse

router = APIRouter()


@router.post("/generate/{matkul_id}", response_model=RPSResponse)
def generate_rps(
    matkul_id: int,
    payload: RPSGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
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
def list_rps(matkul_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(RPS).filter(RPS.mata_kuliah_id == matkul_id).order_by(RPS.id.desc()).all()