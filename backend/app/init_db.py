from app.core.database import engine
from app.models import Base

def init_db():
    Base.metadata.create_all(bind=engine)
    print("Tabel berhasil dibuat di database sadewa.")

if __name__ == "__main__":
    init_db()