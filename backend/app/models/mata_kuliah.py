from sqlalchemy import Column, BigInteger, String, SmallInteger, Enum as SAEnum, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import SemesterEnum

class MataKuliah(Base):
    __tablename__ = "mata_kuliah"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    kurikulum_version_id = Column(BigInteger, ForeignKey("kurikulum_versions.id"), nullable=False)
    kode = Column(String)
    nama = Column(String)
    sks = Column(SmallInteger)
    semester = Column(SAEnum(SemesterEnum, name="semester_mk_enum", values_callable=lambda e: [x.value for x in e]))
    tahun_ajaran = Column(String)
    program_studi_id = Column(BigInteger, ForeignKey("program_studi.id"))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    program_studi = relationship("ProgramStudi", back_populates="mata_kuliah")
    kurikulum_version = relationship("KurikulumVersion", back_populates="mata_kuliah")
    pengampu = relationship("PengampuMataKuliah", back_populates="mata_kuliah")
    peserta = relationship("PesertaMataKuliah", back_populates="mata_kuliah")
    cpmk = relationship("CPMK", back_populates="mata_kuliah")
    mk_bentuk_penilaian = relationship("MKBentukPenilaian", back_populates="mata_kuliah")
    narasi_evaluasi = relationship("NarasiEvaluasi", back_populates="mata_kuliah")
    rps = relationship("RPS", back_populates="mata_kuliah")