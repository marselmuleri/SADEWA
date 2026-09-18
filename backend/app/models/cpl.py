from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class CPL(Base):
    __tablename__ = "cpl"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    kode_cpl: Mapped[str] = mapped_column(String(20), nullable=False)
    deskripsi: Mapped[str] = mapped_column(Text, nullable=False)
    program_studi_id: Mapped[int] = mapped_column(ForeignKey("program_studi.id"), nullable=False)

    program_studi = relationship("ProgramStudi", back_populates="cpl")
    hasil_prediksi = relationship("HasilPrediksi", back_populates="cpl")
    ik = relationship("IK", back_populates="cpl", cascade="all, delete-orphan")
