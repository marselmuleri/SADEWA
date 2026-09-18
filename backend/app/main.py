from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.api.v1.router import api_v1_router
from sqlalchemy import inspect, text
from app.core.database import Base, engine

app = FastAPI(title="SADEWA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    # Small development-safe upgrade for the SQLite database used by this project.
    # Production deployments must use an Alembic revision for the same columns.
    additions = {
        "program_studi": {"fakultas": "VARCHAR(150) NOT NULL DEFAULT ''"},
        "users": {
            "nip": "VARCHAR(50)", "program_studi_id": "INTEGER",
            "program_studi_ids": "JSON NOT NULL DEFAULT '[]'",
        },
        "dokumen": {"program_studi_id": "INTEGER"},
    }
    with engine.begin() as connection:
        inspector = inspect(connection)
        for table, columns in additions.items():
            present = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name not in present:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
        connection.execute(text("UPDATE users SET program_studi_id = (SELECT id FROM program_studi ORDER BY id LIMIT 1) WHERE program_studi_id IS NULL"))


@app.get("/")
def root():
    return {"message": "SADEWA API aktif"}


app.include_router(api_router)
app.include_router(api_v1_router)
