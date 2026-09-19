from sqlalchemy import Column, BigInteger, String, Text, JSON, ForeignKey, TIMESTAMP, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import SemesterEnum

class RPS(Base):
    __tablename__ = "rps"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"))
    tahun_ajaran = Column(String)
    semester = Column(SAEnum(SemesterEnum, name="semester_rps_enum", values_callable=lambda e: [x.value for x in e]))
    status = Column(Text)
    sumber_dokumen_rag = Column(JSON)
    created_by = Column(BigInteger, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    mata_kuliah = relationship("MataKuliah", back_populates="rps")
    created_by_user = relationship("User")