"""SALINAN conftest.py bawaan backend/tests, HANYA diubah agar memakai PostgreSQL.
Berkas tes lain disalin apa adanya. Tes asli di repo tidak diubah."""
import pytest
from sqlalchemy import create_engine, StaticPool, BigInteger
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.models import Base


# SQLite tidak mengenali BigInteger sebagai rowid/autoincrement seperti PostgreSQL.
# Override ini membuat BigInteger dikompilasi sebagai INTEGER biasa HANYA untuk
# dialect sqlite (test), tidak mempengaruhi PostgreSQL production sama sekali.
@compiles(BigInteger, "sqlite")
def compile_big_integer_sqlite(type_, compiler, **kw):
    return "INTEGER"


import os
TEST_DATABASE_URL = os.environ["PG_TEST_URL"]  # SALINAN: diarahkan ke PostgreSQL

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    from sqlalchemy import text
    engine.dispose()
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c