from sqlalchemy import Column, BigInteger, String, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class PengampuMataKuliah(Base):
    __tablename__ = "pengampu_mata_kuliah"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    mata_kuliah_id = Column(BigInteger, ForeignKey("mata_kuliah.id"))
    user_id = Column(BigInteger, ForeignKey("users.id"))
    is_koordinator = Column(String, default="0")

    mata_kuliah = relationship("MataKuliah", back_populates="pengampu")
    user = relationship("User")