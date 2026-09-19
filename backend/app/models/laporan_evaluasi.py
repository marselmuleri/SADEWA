from sqlalchemy import Column, BigInteger, Text, JSON, Integer, ForeignKey, TIMESTAMP, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import SemesterEnum, LaporanStatus

class LaporanEvaluasi(Base):
    __tablename__ = "laporan_evaluasi"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"), nullable=False)
    dosen_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    semester = Column(SAEnum(SemesterEnum, name="semester_laporan_enum", values_callable=lambda e: [x.value for x in e]))
    konten = Column(Text)
    status = Column(SAEnum(LaporanStatus, name="laporan_status_enum", values_callable=lambda e: [x.value for x in e]), default=LaporanStatus.draft)
    sumber_narasi_ids = Column(JSON, nullable=True)
    submitted_at = Column(TIMESTAMP, nullable=True)
    validated_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    validated_at = Column(TIMESTAMP, nullable=True)
    remarks = Column(Text, nullable=True)
    version = Column(Integer, default=1)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    mata_kuliah = relationship("MataKuliah")
    dosen = relationship("User", foreign_keys=[dosen_id])
    validator = relationship("User", foreign_keys=[validated_by])