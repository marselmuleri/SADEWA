from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class CPMK(Base):
    __tablename__ = "cpmk"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    kode_cpmk: Mapped[str] = mapped_column(String(20), nullable=False)
    deskripsi: Mapped[str] = mapped_column(Text, nullable=False)
    mata_kuliah_id: Mapped[int] = mapped_column(ForeignKey("mata_kuliah.id"), nullable=False)
    bobot_ke_cpl: Mapped[dict] = mapped_column(JSON, nullable=False)

    mata_kuliah = relationship("MataKuliah", back_populates="cpmk")
    penilaian = relationship("Penilaian", back_populates="cpmk")
