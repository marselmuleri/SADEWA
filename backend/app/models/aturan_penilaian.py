from sqlalchemy import BigInteger, Column, ForeignKey, Numeric, String, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class AturanPenilaianProdi(Base):
    """
    Aturan penilaian per program studi (diatur Admin Prodi / Kaprodi).

    - ambang: nilai minimal (0-100) agar CPMK dianggap tercapai dan nilai akhir dianggap
      lulus. Dipakai mesin kalkulasi, Analitik OBE, dan Portofolio.
    - target_rerata_skala & target_persen: syarat "Memenuhi" pada Evaluasi Pemenuhan CPMK.
    - gpm_nama & gpm_nip: Ketua Gugus Penjaminan Mutu, untuk cover portofolio.
    Bila baris belum ada, dipakai nilai bawaan (lihat services/portofolio_aturan.py).
    """
    __tablename__ = "aturan_penilaian_prodi"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    program_studi_id = Column(BigInteger, ForeignKey("program_studi.id"), nullable=False, unique=True)
    ambang = Column(Numeric(5, 2), nullable=False)
    target_rerata_skala = Column(Numeric(4, 2), nullable=False)
    target_persen = Column(Numeric(5, 2), nullable=False)
    gpm_nama = Column(String(255), nullable=True)
    gpm_nip = Column(String(100), nullable=True)
    updated_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    program_studi = relationship("ProgramStudi")
