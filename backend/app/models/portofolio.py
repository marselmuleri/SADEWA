from sqlalchemy import BigInteger, Column, Date, ForeignKey, Integer, String, Text, TIMESTAMP, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class PortofolioBerkas(Base):
    """
    Berkas portofolio mata kuliah yang diunggah dosen pengampu.
    jenis: "rps" (dokumen RPS resmi) atau "lampiran" (soal, rubrik, contoh jawaban, presensi, dst).
    File disimpan di disk (settings.UPLOAD_DIR); tabel ini hanya menyimpan metadatanya.
    """
    __tablename__ = "portofolio_berkas"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"), nullable=False, index=True)
    jenis = Column(String(20), nullable=False)
    judul = Column(String(255), nullable=False)
    keterangan = Column(Text, nullable=True)
    nama_file = Column(String(255), nullable=False)
    path_file = Column(String(500), nullable=False)
    content_type = Column(String(120), nullable=True)
    ukuran = Column(Integer, nullable=False, default=0)
    uploaded_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    mata_kuliah = relationship("MataKuliah")
    uploader = relationship("User")


class EvaluasiCPMK(Base):
    """
    Teks sheet Evaluasi portofolio per CPMK: analisis pelaksanaan pembelajaran dan
    rencana perbaikan semester depan. Bisa berasal dari saran AI lalu diedit dosen.
    """
    __tablename__ = "evaluasi_cpmk"
    __table_args__ = (
        UniqueConstraint("mata_kuliah_id", "cpmk_id", name="uq_evaluasi_mk_cpmk"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"), nullable=False, index=True)
    cpmk_id = Column(BigInteger, ForeignKey("cpmk.id", ondelete="CASCADE"), nullable=False)
    analisis = Column(Text, nullable=True)
    rencana_perbaikan = Column(Text, nullable=True)
    updated_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class PortofolioInfo(Base):
    """
    Isian portofolio yang belum ada di data akademik lain: identitas dokumen (cover)
    dan teks kontrak perkuliahan. Satu baris per mata kuliah, diisi dosen pengampu.
    """
    __tablename__ = "portofolio_info"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"), nullable=False, unique=True)
    no_dokumen = Column(String(150), nullable=True)
    revisi = Column(String(100), nullable=True)
    tanggal_terbit = Column(Date, nullable=True)
    prasyarat = Column(String(255), nullable=True)
    manfaat = Column(Text, nullable=True)
    deskripsi = Column(Text, nullable=True)
    strategi = Column(Text, nullable=True)
    tata_tertib = Column(Text, nullable=True)
    waktu_tempat = Column(Text, nullable=True)
    referensi = Column(Text, nullable=True)
    updated_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class RPPPertemuan(Base):
    """Rencana Pelaksanaan Pembelajaran: satu baris per pertemuan sebuah mata kuliah."""
    __tablename__ = "rpp_pertemuan"
    __table_args__ = (
        UniqueConstraint("mata_kuliah_id", "pertemuan_ke", name="uq_rpp_mk_pertemuan"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"), nullable=False, index=True)
    pertemuan_ke = Column(Integer, nullable=False)
    tanggal = Column(Date, nullable=True)
    cpmk = Column(String(100), nullable=True)
    materi = Column(Text, nullable=True)
    metode = Column(Text, nullable=True)
    waktu = Column(String(100), nullable=True)
    pengalaman_belajar = Column(Text, nullable=True)
    indikator_kriteria = Column(Text, nullable=True)
    realisasi = Column(Text, nullable=True)
    catatan = Column(Text, nullable=True)
    updated_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
