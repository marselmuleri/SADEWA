from sqlalchemy import Column, BigInteger, String, Boolean, Enum as SAEnum, TIMESTAMP
from sqlalchemy.sql import func
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
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())