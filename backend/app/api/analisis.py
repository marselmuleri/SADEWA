from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.analisis import PrediksiRequest, PrediksiResponse
from app.services.ml_service import early_warning, ketercapaian_cpl, predict, predict_batch, train_model

router = APIRouter()


@router.post("/train")
def train(db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.admin))):
    return train_model(db)


@router.post("/prediksi", response_model=PrediksiResponse)
def prediksi(payload: PrediksiRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return predict(
        db,
        mahasiswa_id=payload.mahasiswa_id,
        cpl_id=payload.cpl_id,
        mata_kuliah_id=payload.mata_kuliah_id,
    )


@router.get("/prediksi-batch/{mata_kuliah_id}")
def prediksi_batch(mata_kuliah_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return predict_batch(db, mata_kuliah_id)


@router.get("/early-warning")
def get_early_warning(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return early_warning(db)


@router.get("/ketercapaian-cpl/{prodi_id}")
def get_ketercapaian(prodi_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return ketercapaian_cpl(db, prodi_id)
