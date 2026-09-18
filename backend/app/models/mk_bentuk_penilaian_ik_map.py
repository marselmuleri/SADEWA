from sqlalchemy import Column, BigInteger, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class MKBentukPenilaianIKMap(Base):
    __tablename__ = "mk_bentuk_penilaian_ik_map"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mk_bentuk_penilaian_id = Column(BigInteger, ForeignKey("mk_bentuk_penilaian.id"), nullable=False)
    ik_id = Column(BigInteger, ForeignKey("ik.id"), nullable=False)
    bobot = Column(DECIMAL, nullable=False)

    mk_bentuk_penilaian = relationship("MKBentukPenilaian", back_populates="ik_map")
    ik = relationship("IK", back_populates="mk_bentuk_penilaian_ik_map")