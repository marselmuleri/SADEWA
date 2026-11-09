from sqlalchemy import Column, BigInteger, Integer, String, Numeric, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class SkalaNilai(Base):
    """
    Satu baris konversi nilai angka -> huruf pada sebuah versi kurikulum.

    Baris dikelompokkan menurut rentang angkatan (angkatan_min..angkatan_max).
    Kelompok tanpa rentang (keduanya NULL) adalah skala bawaan, dipakai bila
    angkatan mahasiswa tidak masuk rentang mana pun atau tidak diketahui.
    Keunikan huruf & batas_min per kelompok divalidasi di API
    (lihat services/skala_nilai.py), bukan oleh constraint database.
    """
    __tablename__ = "skala_nilai"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    kurikulum_version_id = Column(BigInteger, ForeignKey("kurikulum_versions.id"), nullable=False, index=True)
    huruf = Column(String(10), nullable=False)
    batas_min = Column(Numeric(5, 2), nullable=False)
    angkatan_min = Column(Integer, nullable=True)
    angkatan_max = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    kurikulum_version = relationship("KurikulumVersion", back_populates="skala_nilai")
