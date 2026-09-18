from sqlalchemy import Column, BigInteger, String, SmallInteger, Enum as SAEnum, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import StatusMasuk

class Mahasiswa(Base):
    __tablename__ = "mahasiswa"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    nim = Column(String)
    nama = Column(String)
    semester_aktif = Column(SmallInteger)
    status_masuk = Column(SAEnum(StatusMasuk, name="status_masuk_enum", values_callable=lambda e: [x.value for x in e]))
    program_studi_id = Column(BigInteger, ForeignKey("program_studi.id"))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    program_studi = relationship("ProgramStudi", back_populates="mahasiswa")
    peserta_mata_kuliah = relationship("PesertaMataKuliah", back_populates="mahasiswa")
    ik_achievement = relationship("IKAchievement", back_populates="mahasiswa")
    cpl_achievement = relationship("CPLAchievement", back_populates="mahasiswa")