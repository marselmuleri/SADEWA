from sqlalchemy import Column, BigInteger, DECIMAL, Integer, ForeignKey, TIMESTAMP, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import SemesterEnum

class CPLAchievement(Base):
    __tablename__ = "cpl_achievement"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mahasiswa_id = Column(BigInteger, ForeignKey("mahasiswa.id"), nullable=False)
    cpl_id = Column(BigInteger, ForeignKey("cpl.id"), nullable=False)
    semester = Column(SAEnum(SemesterEnum, name="semester_cpl_ach_enum", values_callable=lambda e: [x.value for x in e]))
    angkatan = Column(Integer)
    nilai = Column(DECIMAL, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    mahasiswa = relationship("Mahasiswa", back_populates="cpl_achievement")
    cpl = relationship("CPL", back_populates="cpl_achievement")