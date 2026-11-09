from sqlalchemy import Column, BigInteger, String, JSON, ForeignKey, TIMESTAMP, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import SemesterEnum


class ArsipKurikulum(Base):
    """
    Data Master: snapshot data kurikulum yang sudah fix dipakai.

    Tabel asli (CPL, IK, MK, CPMK, ...) adalah Data Current dan boleh dikoreksi
    kapan saja. Arsip hanya dibuat pada titik resmi, sehingga koreksi salah input
    tidak tercatat:
      - jenis "publish_kurikulum": otomatis saat versi kurikulum pertama kali dipublish.
      - jenis "tutup_semester": dibuat Admin Prodi di akhir semester.
    Arsip tidak pernah diubah atau dihapus. Lihat app/services/arsip.py.
    """
    __tablename__ = "arsip_kurikulum"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    program_studi_id = Column(BigInteger, ForeignKey("program_studi.id"), nullable=False, index=True)
    jenis = Column(String(30), nullable=False)
    kurikulum_version_id = Column(BigInteger, ForeignKey("kurikulum_versions.id"), nullable=True, index=True)
    semester = Column(SAEnum(SemesterEnum, name="semester_arsip_enum", values_callable=lambda e: [x.value for x in e]), nullable=True)
    tahun_ajaran = Column(String, nullable=True)
    judul = Column(String(255), nullable=False)
    ringkasan = Column(JSON, nullable=True)   # jumlah CPL, IK, MK, CPMK, ...
    data = Column(JSON, nullable=False)       # isi snapshot lengkap
    dibuat_oleh = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)

    pembuat = relationship("User")
    kurikulum_version = relationship("KurikulumVersion")
