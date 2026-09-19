from sqlalchemy import Column, BigInteger, String, Text, SmallInteger, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class IK(Base):
    __tablename__ = "ik"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    cpl_id = Column(BigInteger, ForeignKey("cpl.id"), nullable=False)
    kode = Column(String, nullable=False)
    deskripsi = Column(Text, nullable=False)
    urutan = Column(SmallInteger)
    created_by = Column(BigInteger, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    cpl = relationship("CPL", back_populates="ik")
    cpmk_ik_map = relationship("CPMKIKMap", back_populates="ik")
    mk_bentuk_penilaian_ik_map = relationship("MKBentukPenilaianIKMap", back_populates="ik")
    ik_achievement = relationship("IKAchievement", back_populates="ik")