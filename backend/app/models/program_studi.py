from datetime import datetime
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class ProgramStudi(Base):
    __tablename__ = "program_studi"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nama: Mapped[str] = mapped_column(String(150), nullable=False)
    kode: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    jenjang: Mapped[str] = mapped_column(String(20), nullable=False)
    fakultas: Mapped[str] = mapped_column(String(150), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    mata_kuliah = relationship("MataKuliah", back_populates="program_studi")
    mahasiswa = relationship("Mahasiswa", back_populates="program_studi")
    cpl = relationship("CPL", back_populates="program_studi")
    users = relationship("User", back_populates="program_studi")
