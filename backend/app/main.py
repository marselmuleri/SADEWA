from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.api.v1.router import api_v1_router
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


@app.get("/")
def root():
    return {"message": "SADEWA API aktif"}


app.include_router(api_router)
app.include_router(api_v1_router)
