from sqlalchemy import Column, BigInteger, DECIMAL, ForeignKey, TIMESTAMP, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import SemesterEnum

class IKAchievement(Base):
    __tablename__ = "ik_achievement"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mahasiswa_id = Column(BigInteger, ForeignKey("mahasiswa.id"), nullable=False)
    ik_id = Column(BigInteger, ForeignKey("ik.id"), nullable=False)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"), nullable=False)
    semester = Column(SAEnum(SemesterEnum, name="semester_ik_ach_enum", values_callable=lambda e: [x.value for x in e]))
    nilai = Column(DECIMAL, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    mahasiswa = relationship("Mahasiswa", back_populates="ik_achievement")
    ik = relationship("IK", back_populates="ik_achievement")
    mata_kuliah = relationship("MataKuliah")