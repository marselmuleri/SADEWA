from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Dokumen(Base):
    __tablename__ = "dokumen"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    judul: Mapped[str] = mapped_column(String(250), nullable=False)
    jenis: Mapped[str] = mapped_column(String(30), nullable=False)  # RPS / EVALUASI
    konten: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False)
    mata_kuliah_id: Mapped[int | None] = mapped_column(ForeignKey("mata_kuliah.id"), nullable=True)
    program_studi_id: Mapped[int | None] = mapped_column(ForeignKey("program_studi.id"), nullable=True, index=True)
    dibuat_oleh: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    catatan: Mapped[str] = mapped_column(Text, default="", nullable=False)
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    diperbarui_pada: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
