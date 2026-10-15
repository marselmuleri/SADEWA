from sqlalchemy import Column, BigInteger, String, Numeric, ForeignKey, TIMESTAMP, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class SkalaNilai(Base):
    __tablename__ = "skala_nilai"
    __table_args__ = (
        UniqueConstraint("kurikulum_version_id", "huruf", name="uq_skala_nilai_kurikulum_huruf"),
        UniqueConstraint("kurikulum_version_id", "batas_min", name="uq_skala_nilai_kurikulum_batas"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    kurikulum_version_id = Column(BigInteger, ForeignKey("kurikulum_versions.id"), nullable=False)
    huruf = Column(String(10), nullable=False)
    batas_min = Column(Numeric(5, 2), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    kurikulum_version = relationship("KurikulumVersion", back_populates="skala_nilai")

