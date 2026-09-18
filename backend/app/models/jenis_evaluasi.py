from sqlalchemy import Column, BigInteger, String, SmallInteger, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class JenisEvaluasi(Base):
    __tablename__ = "jenis_evaluasi"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    program_studi_id = Column(BigInteger, ForeignKey("program_studi.id"), nullable=False)
    nama = Column(String, nullable=False)
    urutan = Column(SmallInteger)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    program_studi = relationship("ProgramStudi", back_populates="jenis_evaluasi")
    bentuk_penilaian = relationship("BentukPenilaian", back_populates="jenis_evaluasi")