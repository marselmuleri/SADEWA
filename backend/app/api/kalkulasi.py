from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import require_roles, get_current_user
from app.models.enums import UserRole
from app.models.ik_achievement import IKAchievement
from app.models.user import User
from app.schemas.kalkulasi import KalkulasiRunResponse, ValidasiBobotResponse
from app.services.calculation.engine import run_kalkulasi, validasi_bobot_mata_kuliah

router = APIRouter()


@router.post("/validasibobot", response_model=ValidasiBobotResponse)
def validasi_bobot(mata_kuliah_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    warnings = validasi_bobot_mata_kuliah(db, mata_kuliah_id)
    return {"valid": len(warnings) == 0, "warnings": warnings}


@router.post("/run/{matkul_id}", response_model=KalkulasiRunResponse)
def run(matkul_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin, UserRole.dosen))):
    result = run_kalkulasi(db, matkul_id)
    return result


@router.get("/{matkul_id}")
def get_hasil(matkul_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    results = db.query(IKAchievement).filter(IKAchievement.mata_kuliah_id == matkul_id).all()
    return [{"mahasiswa_id": r.mahasiswa_id, "ik_id": r.ik_id, "nilai": float(r.nilai)} for r in results]