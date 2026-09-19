from sqlalchemy import Column, BigInteger, Integer, ForeignKey, TIMESTAMP, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import SemesterEnum, SiapSyncStatus

class SiapSyncLog(Base):
    __tablename__ = "siap_sync_logs"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"), nullable=False)
    semester = Column(SAEnum(SemesterEnum, name="semester_sync_enum", values_callable=lambda e: [x.value for x in e]))
    status = Column(SAEnum(SiapSyncStatus, name="siap_sync_status_enum", values_callable=lambda e: [x.value for x in e]))
    total_records = Column(Integer, default=0)
    triggered_by = Column(BigInteger, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.now())

    mata_kuliah = relationship("MataKuliah")
    triggered_by_user = relationship("User")