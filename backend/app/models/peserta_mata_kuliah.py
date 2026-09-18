from sqlalchemy import Column, BigInteger, String, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class PesertaMataKuliah(Base):
    __tablename__ = "peserta_mata_kuliah"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"))
    mahasiswa_id = Column(BigInteger, ForeignKey("mahasiswa.id"))
    kelas = Column(String)
    created_at = Column(TIMESTAMP, server_default=func.now())

    mata_kuliah = relationship("MataKuliah", back_populates="peserta")
    mahasiswa = relationship("Mahasiswa", back_populates="peserta_mata_kuliah")
    nilai_bentuk_penilaian = relationship("NilaiBentukPenilaian", back_populates="peserta_mata_kuliah")
    hasil_evaluasi = relationship("HasilEvaluasi", back_populates="peserta_mata_kuliah", uselist=False)
    cpmk_achievement = relationship("CPMKAchievement", back_populates="peserta_mata_kuliah")
    narasi_evaluasi = relationship("NarasiEvaluasi", back_populates="peserta_mata_kuliah")