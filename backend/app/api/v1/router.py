from fastapi import APIRouter

from app.api import analisis, auth, chatbot, cpl, cpmk, dashboard, mahasiswa, mata_kuliah, penilaian, prodi, users

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_v1_router.include_router(mahasiswa.router, prefix="/mahasiswa", tags=["mahasiswa"])
api_v1_router.include_router(mata_kuliah.router, prefix="/mata-kuliah", tags=["mata-kuliah"])
api_v1_router.include_router(cpl.router, prefix="/cpl", tags=["cpl"])
api_v1_router.include_router(cpmk.router, prefix="/cpmk", tags=["cpmk"])
api_v1_router.include_router(prodi.router, prefix="/prodi", tags=["prodi"])
api_v1_router.include_router(users.router, prefix="/users", tags=["users"])
api_v1_router.include_router(penilaian.router, prefix="/penilaian", tags=["penilaian"])
api_v1_router.include_router(analisis.router, prefix="/analisis", tags=["analisis"])
api_v1_router.include_router(chatbot.router, prefix="/chatbot", tags=["chatbot"])
api_v1_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
