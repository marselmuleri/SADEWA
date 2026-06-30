from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class MataKuliah(Base):
    __tablename__ = "mata_kuliah"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    kode_mk: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nama_mk: Mapped[str] = mapped_column(String(150), nullable=False)
    sks: Mapped[int] = mapped_column(Integer, nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    program_studi_id: Mapped[int] = mapped_column(ForeignKey("program_studi.id"), nullable=False)
    dosen_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    program_studi = relationship("ProgramStudi", back_populates="mata_kuliah")
    dosen = relationship("User", back_populates="mata_kuliah")
    cpmk = relationship("CPMK", back_populates="mata_kuliah")
    penilaian = relationship("Penilaian", back_populates="mata_kuliah")
    hasil_prediksi = relationship("HasilPrediksi", back_populates="mata_kuliah")
