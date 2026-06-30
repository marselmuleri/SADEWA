from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Mahasiswa(Base):
    __tablename__ = "mahasiswa"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nim: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    nama: Mapped[str] = mapped_column(String(150), nullable=False)
    angkatan: Mapped[int] = mapped_column(Integer, nullable=False)
    program_studi_id: Mapped[int] = mapped_column(ForeignKey("program_studi.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    program_studi = relationship("ProgramStudi", back_populates="mahasiswa")
    penilaian = relationship("Penilaian", back_populates="mahasiswa")
    hasil_prediksi = relationship("HasilPrediksi", back_populates="mahasiswa")
    rekomendasi_llm = relationship("RekomendasiLLM", back_populates="mahasiswa")
