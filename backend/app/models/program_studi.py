from sqlalchemy import Column, BigInteger, String, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class ProgramStudi(Base):
    __tablename__ = "program_studi"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    kode = Column(String)
    nama = Column(String)
    fakultas_id = Column(BigInteger, ForeignKey("fakultas.id"))
    created_at = Column(TIMESTAMP, server_default=func.now())

    fakultas = relationship("Fakultas", back_populates="program_studi")
    mahasiswa = relationship("Mahasiswa", back_populates="program_studi")
    mata_kuliah = relationship("MataKuliah", back_populates="program_studi")
    cpl = relationship("CPL", back_populates="program_studi")
    kurikulum_versions = relationship("KurikulumVersion", back_populates="program_studi")
    jenis_evaluasi = relationship("JenisEvaluasi", back_populates="program_studi")