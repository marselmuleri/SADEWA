from sqlalchemy import Column, BigInteger, String, Numeric, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class RangeNilaiCPL(Base):
    __tablename__ = "range_nilai_cpl"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    program_studi_id = Column(BigInteger, ForeignKey("program_studi.id"), nullable=False)
    nama = Column(String(100), nullable=False)
    batas_bawah = Column(Numeric(5, 2), nullable=False)
    batas_atas = Column(Numeric(5, 2), nullable=False)
    warna = Column(String(50), nullable=True)
    keterangan = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    program_studi = relationship("ProgramStudi")

