from sqlalchemy import Column, BigInteger, DECIMAL, Integer, ForeignKey, TIMESTAMP, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import SemesterEnum

class CPLAchievement(Base):
    """
    Capaian CPL seorang mahasiswa pada SATU mata kuliah.

    Capaian CPL gabungan (lintas mata kuliah) tidak disimpan; dihitung saat dibaca
    sebagai rata-rata berbobot: Σ(nilai × bobot_cp) / Σ bobot_cp
    (lihat services/calculation/cpl_aggregate.py).

    Baris lama dengan mata_kuliah_id NULL berasal dari versi sebelum perubahan ini
    dan diganti otomatis saat mata kuliah dikalkulasi ulang.
    """
    __tablename__ = "cpl_achievement"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mahasiswa_id = Column(BigInteger, ForeignKey("mahasiswa.id"), nullable=False)
    cpl_id = Column(BigInteger, ForeignKey("cpl.id"), nullable=False)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"), nullable=True, index=True)
    semester = Column(SAEnum(SemesterEnum, name="semester_cpl_ach_enum", values_callable=lambda e: [x.value for x in e]))
    angkatan = Column(Integer)
    # Persen ketercapaian CPL pada mata kuliah ini (0-100)
    nilai = Column(DECIMAL, nullable=False)
    # Σ bobot IK milik CPL ini pada pemetaan CPMK mata kuliah ini
    bobot_cp = Column(DECIMAL, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    mahasiswa = relationship("Mahasiswa", back_populates="cpl_achievement")
    cpl = relationship("CPL", back_populates="cpl_achievement")
    mata_kuliah = relationship("MataKuliah")
