from sqlalchemy import Column, BigInteger, DECIMAL, ForeignKey, TIMESTAMP, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import SemesterEnum

class MKBentukPenilaian(Base):
    __tablename__ = "mk_bentuk_penilaian"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"), nullable=False)
    bentuk_penilaian_id = Column(BigInteger, ForeignKey("bentuk_penilaian.id"), nullable=False)
    bobot = Column(DECIMAL, nullable=False)
    semester = Column(SAEnum(SemesterEnum, name="semester_mbp_enum", values_callable=lambda e: [x.value for x in e]))
    created_by = Column(BigInteger, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    mata_kuliah = relationship("MataKuliah", back_populates="mk_bentuk_penilaian")
    bentuk_penilaian = relationship("BentukPenilaian", back_populates="mk_bentuk_penilaian")
    ik_map = relationship("MKBentukPenilaianIKMap", back_populates="mk_bentuk_penilaian")
    nilai_bentuk_penilaian = relationship("NilaiBentukPenilaian", back_populates="mk_bentuk_penilaian")