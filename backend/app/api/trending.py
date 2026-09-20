from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope
from app.models.cpl import CPL
from app.models.cpl_achievement import CPLAchievement
from app.models.program_studi import ProgramStudi
from app.schemas.dashboard import TrendingItem

router = APIRouter()


@router.get("/cpl-by-angkatan", response_model=list[TrendingItem])
def trending_cpl_by_angkatan(
    program_studi_id: int | None = None,
    cpl_ids: list[int] = Query(default=[]),
    year_start: int | None = None,
    year_end: int | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    if scope.program_studi_id:
        # Admin Prodi & Kaprodi: prodi selalu dari akun login, parameter client diabaikan.
        prodi_id = scope.program_studi_id
    elif scope.fakultas_id:
        # Dekan lintas prodi: wajib pilih salah satu prodi di fakultasnya sendiri.
        if not program_studi_id:
            raise HTTPException(status_code=400, detail="program_studi_id wajib diisi (pilih salah satu prodi di fakultas Anda)")
        prodi = db.query(ProgramStudi).filter(ProgramStudi.id == program_studi_id).first()
        if not prodi or prodi.fakultas_id != scope.fakultas_id:
            raise HTTPException(status_code=403, detail="Program Studi ini di luar fakultas Anda")
        prodi_id = program_studi_id
    else:
        raise HTTPException(status_code=403, detail="Role ini tidak memiliki akses trending")

    query = db.query(CPLAchievement).join(CPL).filter(CPL.program_studi_id == prodi_id)
    if cpl_ids:
        query = query.filter(CPLAchievement.cpl_id.in_(cpl_ids))
    if year_start:
        query = query.filter(CPLAchievement.angkatan >= year_start)
    if year_end:
        query = query.filter(CPLAchievement.angkatan <= year_end)

    achs = query.all()
    grouped: dict[tuple[int, int], list] = {}
    for a in achs:
        if a.angkatan is None:
            continue
        key = (a.angkatan, a.cpl_id)
        grouped.setdefault(key, []).append(a.nilai)

    results = []
    for (angkatan, cpl_id), nilai_list in grouped.items():
        cpl = db.query(CPL).filter(CPL.id == cpl_id).first()
        results.append(TrendingItem(
            angkatan=angkatan,
            cpl_id=cpl_id,
            cpl_kode=cpl.kode if cpl else "-",
            rata_rata=sum(nilai_list) / len(nilai_list),
        ))
    return sorted(results, key=lambda r: (r.angkatan, r.cpl_kode))