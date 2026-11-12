from sqlalchemy import Column, BigInteger, String, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class ProgramStudi(Base):
    __tablename__ = "program_studi"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    kode = Column(String)
    nama = Column(String)
    fakultas_id = Column(BigInteger, ForeignKey("fakultas.id"))
    # Kurikulum yang dipakai Analitik OBE; ditetapkan Admin Prodi (harus versi published).
    kurikulum_aktif_id = Column(
        BigInteger,
        ForeignKey("kurikulum_versions.id", use_alter=True, name="fk_program_studi_kurikulum_aktif", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(TIMESTAMP, server_default=func.now())

    fakultas = relationship("Fakultas", back_populates="program_studi")
    mahasiswa = relationship("Mahasiswa", back_populates="program_studi")
    mata_kuliah = relationship("MataKuliah", back_populates="program_studi")
    cpl = relationship("CPL", back_populates="program_studi")
    kurikulum_versions = relationship(
        "KurikulumVersion", back_populates="program_studi", foreign_keys="KurikulumVersion.program_studi_id"
    )
    kurikulum_aktif = relationship("KurikulumVersion", foreign_keys=[kurikulum_aktif_id], post_update=True)
    jenis_evaluasi = relationship("JenisEvaluasi", back_populates="program_studi")
    users = relationship("User", back_populates="program_studi")