from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nama: Mapped[str] = mapped_column(String(150), nullable=False)
    nip: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.dosen)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # One academic program for operational roles; Dekan may be assigned many.
    program_studi_id: Mapped[int | None] = mapped_column(ForeignKey("program_studi.id"), nullable=True, index=True)
    program_studi_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    mata_kuliah = relationship("MataKuliah", back_populates="dosen")
    program_studi = relationship("ProgramStudi", back_populates="users")
