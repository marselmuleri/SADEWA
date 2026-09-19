from fastapi import APIRouter

from app.api import (
    auth, bentuk_penilaian, cpl, cpmk, dashboard, fakultas, ik, jenis_evaluasi,
    kalkulasi, kurikulum_version, laporan, mahasiswa, mata_kuliah, mk_bentuk_penilaian,
    narasi, nilai, peserta_mata_kuliah, prodi, rps, trending, users, validasi,
)


api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_v1_router.include_router(fakultas.router, prefix="/fakultas", tags=["fakultas"])
api_v1_router.include_router(prodi.router, prefix="/prodi", tags=["prodi"])
api_v1_router.include_router(mahasiswa.router, prefix="/mahasiswa", tags=["mahasiswa"])
api_v1_router.include_router(users.router, prefix="/users", tags=["users"])
api_v1_router.include_router(kurikulum_version.router, prefix="/kurikulum/versions", tags=["kurikulum"])
api_v1_router.include_router(cpl.router, prefix="/cpl", tags=["cpl"])
api_v1_router.include_router(ik.router, prefix="/ik", tags=["ik"])
api_v1_router.include_router(mata_kuliah.router, prefix="/mata-kuliah", tags=["mata-kuliah"])
api_v1_router.include_router(cpmk.router, prefix="/cpmk", tags=["cpmk"])
api_v1_router.include_router(jenis_evaluasi.router, prefix="/jenis-evaluasi", tags=["jenis-evaluasi"])
api_v1_router.include_router(bentuk_penilaian.router, prefix="/bentuk-penilaian", tags=["bentuk-penilaian"])
api_v1_router.include_router(mk_bentuk_penilaian.router, prefix="/mk-bentuk-penilaian", tags=["mk-bentuk-penilaian"])
api_v1_router.include_router(peserta_mata_kuliah.router, prefix="/peserta-mata-kuliah", tags=["peserta"])
api_v1_router.include_router(nilai.router, prefix="/nilai", tags=["nilai"])
api_v1_router.include_router(kalkulasi.router, prefix="/kalkulasi", tags=["kalkulasi"])
api_v1_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_v1_router.include_router(trending.router, prefix="/trending", tags=["trending"])
api_v1_router.include_router(narasi.router, prefix="/narasi", tags=["narasi"])
api_v1_router.include_router(laporan.router, prefix="/laporan", tags=["laporan"])
api_v1_router.include_router(validasi.router, prefix="/validasi", tags=["validasi"])
api_v1_router.include_router(rps.router, prefix="/rps", tags=["rps"])