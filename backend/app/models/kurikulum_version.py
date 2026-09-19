from sqlalchemy import Column, BigInteger, String, ForeignKey, TIMESTAMP, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import StatusKurikulum, SemesterEnum

class KurikulumVersion(Base):
    __tablename__ = "kurikulum_versions"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    program_studi_id = Column(BigInteger, ForeignKey("program_studi.id"), nullable=False)
    version_label = Column(String, nullable=False)
    semester = Column(SAEnum(SemesterEnum, name="semester_kurikulum_enum", values_callable=lambda e: [x.value for x in e]))
    status = Column(SAEnum(StatusKurikulum, name="status_kurikulum_enum", values_callable=lambda e: [x.value for x in e]), default=StatusKurikulum.draft)
    created_by = Column(BigInteger, ForeignKey("users.id"))
    published_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    program_studi = relationship("ProgramStudi", back_populates="kurikulum_versions")
    created_by_user = relationship("User")
    cpl = relationship("CPL", back_populates="kurikulum_version")
    mata_kuliah = relationship("MataKuliah", back_populates="kurikulum_version")