from sqlalchemy import Enum, ForeignKey, Integer, String, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.enums import JenisPenilaian


class Penilaian(Base):
    __tablename__ = "penilaian"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mahasiswa_id: Mapped[int] = mapped_column(ForeignKey("mahasiswa.id"), nullable=False)
    mata_kuliah_id: Mapped[int] = mapped_column(ForeignKey("mata_kuliah.id"), nullable=False)
    cpmk_id: Mapped[int] = mapped_column(ForeignKey("cpmk.id"), nullable=False)
    jenis: Mapped[JenisPenilaian] = mapped_column(Enum(JenisPenilaian), nullable=False)
    nilai: Mapped[float] = mapped_column(Float, nullable=False)
    semester: Mapped[str] = mapped_column(String(30), nullable=False)
    tahun_akademik: Mapped[str] = mapped_column(String(20), nullable=False)

    mahasiswa = relationship("Mahasiswa", back_populates="penilaian")
    mata_kuliah = relationship("MataKuliah", back_populates="penilaian")
    cpmk = relationship("CPMK", back_populates="penilaian")
