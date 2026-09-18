from fastapi import APIRouter
from app.api import auth, mahasiswa, mata_kuliah, cpl, cpmk, penilaian, dashboard, prodi, users, obe, super_admin

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(mahasiswa.router, prefix="/mahasiswa", tags=["mahasiswa"])
api_router.include_router(mata_kuliah.router, prefix="/mata-kuliah", tags=["mata-kuliah"])
api_router.include_router(cpl.router, prefix="/cpl", tags=["cpl"])
api_router.include_router(cpmk.router, prefix="/cpmk", tags=["cpmk"])
api_router.include_router(prodi.router, prefix="/prodi", tags=["prodi"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(penilaian.router, prefix="/penilaian", tags=["penilaian"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(obe.router, tags=["obe"])
api_router.include_router(super_admin.router, tags=["super-admin"])
