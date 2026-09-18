from sqlalchemy import Column, BigInteger, String, Text, DECIMAL, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class CPMK(Base):
    __tablename__ = "cpmk"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"), nullable=False)
    kode = Column(String, nullable=False)
    deskripsi = Column(Text, nullable=False)
    level_taksonomi = Column(String)
    bobot = Column(DECIMAL, nullable=False)
    created_by = Column(BigInteger, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    mata_kuliah = relationship("MataKuliah", back_populates="cpmk")
    cpmk_ik_map = relationship("CPMKIKMap", back_populates="cpmk")
    cpmk_achievement = relationship("CPMKAchievement", back_populates="cpmk")