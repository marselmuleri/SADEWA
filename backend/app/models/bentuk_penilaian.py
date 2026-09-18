from sqlalchemy import Column, BigInteger, String, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class BentukPenilaian(Base):
    __tablename__ = "bentuk_penilaian"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    jenis_evaluasi_id = Column(BigInteger, ForeignKey("jenis_evaluasi.id"), nullable=False)
    nama = Column(String, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    jenis_evaluasi = relationship("JenisEvaluasi", back_populates="bentuk_penilaian")
    mk_bentuk_penilaian = relationship("MKBentukPenilaian", back_populates="bentuk_penilaian")