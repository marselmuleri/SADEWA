from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class RekomendasiLLM(Base):
    __tablename__ = "rekomendasi_llm"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mahasiswa_id: Mapped[int | None] = mapped_column(ForeignKey("mahasiswa.id"), nullable=True)
    pertanyaan: Mapped[str] = mapped_column(Text, nullable=False)
    respons_llm: Mapped[str] = mapped_column(Text, nullable=False)
    context_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    mahasiswa = relationship("Mahasiswa", back_populates="rekomendasi_llm")
