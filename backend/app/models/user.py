from sqlalchemy import Column, BigInteger, String, Boolean, ForeignKey, Enum as SAEnum, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.enums import UserRole

class User(Base):
    __tablename__ = "users"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    nama = Column(String, nullable=True)
    email = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)
    nip = Column(String, nullable=True)
    role = Column(SAEnum(UserRole, name="role_enum", values_callable=lambda e: [x.value for x in e]), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Scope akses:
    # - admin_prodi & kaprodi: wajib punya program_studi_id (dikunci ke satu prodi)
    # - dekan: wajib punya fakultas_id (lintas semua prodi di fakultas itu, read-only)
    # - super_admin & dosen: keduanya nullable (super_admin tidak terikat prodi/fakultas
    #   sama sekali karena tidak boleh menyentuh data akademik; dosen scope-nya lewat
    #   penugasan mata kuliah di PengampuMataKuliah, bukan lewat kolom ini)
    program_studi_id = Column(BigInteger, ForeignKey("program_studi.id"), nullable=True)
    fakultas_id = Column(BigInteger, ForeignKey("fakultas.id"), nullable=True)

    program_studi = relationship("ProgramStudi", back_populates="users")
    fakultas = relationship("Fakultas", back_populates="users")

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())