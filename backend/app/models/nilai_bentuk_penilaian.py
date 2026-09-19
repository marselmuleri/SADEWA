from sqlalchemy import Column, BigInteger, DECIMAL, ForeignKey, TIMESTAMP, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import SemesterEnum, NilaiSource

class NilaiBentukPenilaian(Base):
    __tablename__ = "nilai_bentuk_penilaian"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    peserta_mata_kuliah_id = Column(BigInteger, ForeignKey("peserta_mata_kuliah.id"), nullable=False)
    mk_bentuk_penilaian_id = Column(BigInteger, ForeignKey("mk_bentuk_penilaian.id"), nullable=False)
    semester = Column(SAEnum(SemesterEnum, name="semester_nilai_enum", values_callable=lambda e: [x.value for x in e]))
    nilai = Column(DECIMAL, nullable=False)
    source = Column(SAEnum(NilaiSource, name="nilai_source_enum", values_callable=lambda e: [x.value for x in e]), default=NilaiSource.manual)
    imported_by = Column(BigInteger, ForeignKey("users.id"))
    imported_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    peserta_mata_kuliah = relationship("PesertaMataKuliah", back_populates="nilai_bentuk_penilaian")
    mk_bentuk_penilaian = relationship("MKBentukPenilaian", back_populates="nilai_bentuk_penilaian")