from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class HasilPrediksi(Base):
    __tablename__ = "hasil_prediksi"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mahasiswa_id: Mapped[int] = mapped_column(ForeignKey("mahasiswa.id"), nullable=False)
    cpl_id: Mapped[int] = mapped_column(ForeignKey("cpl.id"), nullable=False)
    mata_kuliah_id: Mapped[int] = mapped_column(ForeignKey("mata_kuliah.id"), nullable=False)
    probabilitas_lulus: Mapped[float] = mapped_column(Float, nullable=False)
    probabilitas_gagal: Mapped[float] = mapped_column(Float, nullable=False)
    prediksi: Mapped[str] = mapped_column(String(30), nullable=False)
    feature_importance: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    mahasiswa = relationship("Mahasiswa", back_populates="hasil_prediksi")
    cpl = relationship("CPL", back_populates="hasil_prediksi")
    mata_kuliah = relationship("MataKuliah", back_populates="hasil_prediksi")
