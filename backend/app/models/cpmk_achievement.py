from sqlalchemy import Column, BigInteger, DECIMAL, SmallInteger, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class CPMKAchievement(Base):
    __tablename__ = "cpmk_achievement"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    peserta_mata_kuliah_id = Column(BigInteger, ForeignKey("peserta_mata_kuliah.id"), nullable=False)
    cpmk_id = Column(BigInteger, ForeignKey("cpmk.id"), nullable=False)
    nilai = Column(DECIMAL, nullable=False)
    nilai_kriteria = Column(SmallInteger)
    status_tercapai = Column(SmallInteger)
    created_at = Column(TIMESTAMP, server_default=func.now())

    peserta_mata_kuliah = relationship("PesertaMataKuliah", back_populates="cpmk_achievement")
    cpmk = relationship("CPMK", back_populates="cpmk_achievement")