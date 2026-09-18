from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class IK(Base):
    __tablename__ = "ik"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kode_ik: Mapped[str] = mapped_column(String(30), nullable=False)
    nama: Mapped[str] = mapped_column(String(200), nullable=False)
    deskripsi: Mapped[str] = mapped_column(Text, default="", nullable=False)
    urutan: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cpl_id: Mapped[int] = mapped_column(ForeignKey("cpl.id"), nullable=False)

    cpl = relationship("CPL", back_populates="ik")
    mappings = relationship("CPMKIK", back_populates="ik", cascade="all, delete-orphan")
