from sqlalchemy import Column, BigInteger, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class CPMKIKMap(Base):
    __tablename__ = "cpmk_ik_map"
    cpmk_id = Column(BigInteger, ForeignKey("cpmk.id"), primary_key=True)
    ik_id = Column(BigInteger, ForeignKey("ik.id"), primary_key=True)
    bobot = Column(DECIMAL, nullable=False)

    cpmk = relationship("CPMK", back_populates="cpmk_ik_map")
    ik = relationship("IK", back_populates="cpmk_ik_map")