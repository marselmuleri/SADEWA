from sqlalchemy import Column, BigInteger, String, Text, DECIMAL, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class CPL(Base):
    __tablename__ = "cpl"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    kurikulum_version_id = Column(BigInteger, ForeignKey("kurikulum_versions.id"), nullable=False)
    kode = Column(String, nullable=False)
    deskripsi = Column(Text, nullable=False)
    program_studi_id = Column(BigInteger, ForeignKey("program_studi.id"), nullable=False)
    threshold_capaian = Column(DECIMAL, default=70.0, nullable=False)
    created_by = Column(BigInteger, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    kurikulum_version = relationship("KurikulumVersion", back_populates="cpl")
    program_studi = relationship("ProgramStudi", back_populates="cpl")
    ik = relationship("IK", back_populates="cpl")
    cpl_achievement = relationship("CPLAchievement", back_populates="cpl")