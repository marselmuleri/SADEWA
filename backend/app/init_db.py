from app.core.database import engine
from app.models import Base
from app.main import auto_sync_schema

def init_db():
    Base.metadata.create_all(bind=engine)
    auto_sync_schema(engine)
    print("Tabel dan kolom berhasil disinkronkan di database sadewa.")

if __name__ == "__main__":
    init_db()
