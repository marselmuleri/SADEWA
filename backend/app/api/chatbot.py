from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.chatbot import ChatbotRequest, ChatbotResponse
from app.services.llm_service import ask_llm

router = APIRouter()


@router.post("/tanya", response_model=ChatbotResponse)
def tanya(payload: ChatbotRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return ask_llm(
        db,
        pertanyaan=payload.pertanyaan,
        mahasiswa_id=payload.mahasiswa_id,
        mata_kuliah_id=payload.mata_kuliah_id,
    )
