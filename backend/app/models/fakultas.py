from sqlalchemy import Column, BigInteger, String, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class Fakultas(Base):
    __tablename__ = "fakultas"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    kode = Column(String)
    nama = Column(String)
    created_at = Column(TIMESTAMP, server_default=func.now())

    program_studi = relationship("ProgramStudi", back_populates="fakultas")