from sqlalchemy import Column, BigInteger, String, DECIMAL, Boolean, Enum as SAEnum, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import StatusOutcome

class HasilEvaluasi(Base):
    __tablename__ = "hasil_evaluasi"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    peserta_mata_kuliah_id = Column(BigInteger, ForeignKey("peserta_mata_kuliah.id"), nullable=True, unique=True)
    kurikulum_version_id = Column(BigInteger, ForeignKey("kurikulum_versions.id"), nullable=True)
    nilai_akhir = Column(DECIMAL)
    nilai_huruf = Column(String)
    nilai_bobot = Column(DECIMAL)
    status_outcome = Column(SAEnum(StatusOutcome, name="status_outcome_enum", values_callable=lambda e: [x.value for x in e]), nullable=True)
    is_final = Column(Boolean, default=False)
    finalized_at = Column(TIMESTAMP, nullable=True)
    finalized_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    peserta_mata_kuliah = relationship("PesertaMataKuliah", back_populates="hasil_evaluasi")
    kurikulum_version = relationship("KurikulumVersion")