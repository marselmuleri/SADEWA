from sqlalchemy import Column, BigInteger, Text, Enum as SAEnum, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import NarasiTipe, NarasiStatus

class NarasiEvaluasi(Base):
    __tablename__ = "narasi_evaluasi"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"), nullable=False)
    peserta_mata_kuliah_id = Column(BigInteger, ForeignKey("peserta_mata_kuliah.id"), nullable=True)
    tipe = Column(SAEnum(NarasiTipe, name="narasi_tipe_enum", values_callable=lambda e: [x.value for x in e]))
    konten = Column(Text)
    status = Column(SAEnum(NarasiStatus, name="narasi_status_enum", values_callable=lambda e: [x.value for x in e]), default=NarasiStatus.draft)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    mata_kuliah = relationship("MataKuliah", back_populates="narasi_evaluasi")
    peserta_mata_kuliah = relationship("PesertaMataKuliah", back_populates="narasi_evaluasi")