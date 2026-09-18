from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class CPMKIK(Base):
    __tablename__ = "cpmk_ik"
    __table_args__ = (UniqueConstraint("cpmk_id", "ik_id", name="uq_cpmk_ik"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cpmk_id: Mapped[int] = mapped_column(ForeignKey("cpmk.id"), nullable=False)
    ik_id: Mapped[int] = mapped_column(ForeignKey("ik.id"), nullable=False)
    cpmk = relationship("CPMK", back_populates="ik_mappings")
    ik = relationship("IK", back_populates="mappings")
