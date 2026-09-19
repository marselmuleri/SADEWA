from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.cpl import CPL
from app.models.cpl_achievement import CPLAchievement
from app.models.cpmk import CPMK
from app.models.cpmk_achievement import CPMKAchievement
from app.models.hasil_evaluasi import HasilEvaluasi
from app.models.ik import IK
from app.models.ik_achievement import IKAchievement
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.user import User
from app.schemas.dashboard import (
    CPLOverviewItem, CPMKBreakdownItem, IKBreakdownItem, IKBreakdownItemMK, MataKuliahDashboardResponse,
)

router = APIRouter()


# --- Route spesifik (path literal) HARUS didefinisikan lebih dulu ---

@router.get("/cpl-overview", response_model=list[CPLOverviewItem])
def cpl_overview(program_studi_id: int, semester: str | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cpl_list = db.query(CPL).filter(CPL.program_studi_id == program_studi_id).all()
    results = []
    for cpl in cpl_list:
        query = db.query(CPLAchievement).filter(CPLAchievement.cpl_id == cpl.id)
        if semester:
            query = query.filter(CPLAchievement.semester == semester)
        achs = query.all()
        if not achs:
            continue
        rata_rata = sum(a.nilai for a in achs) / len(achs)
        tercapai = sum(1 for a in achs if a.nilai >= cpl.threshold_capaian)
        results.append(CPLOverviewItem(
            cpl_id=cpl.id,
            kode=cpl.kode,
            deskripsi=cpl.deskripsi,
            rata_rata=rata_rata,
            threshold=cpl.threshold_capaian,
            persen_tercapai=round((tercapai / len(achs)) * 100, 2),
            jumlah_mahasiswa=len(achs),
        ))
    return results


@router.get("/ik-breakdown/{cpl_id}", response_model=list[IKBreakdownItem])
def ik_breakdown_by_cpl(cpl_id: int, semester: str | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    ik_list = db.query(IK).filter(IK.cpl_id == cpl_id).all()
    if not ik_list:
        raise HTTPException(status_code=404, detail="Belum ada IK untuk CPL ini")

    results = []
    for ik in ik_list:
        query = db.query(IKAchievement).filter(IKAchievement.ik_id == ik.id)
        if semester:
            query = query.filter(IKAchievement.semester == semester)
        achs = query.all()
        if not achs:
            continue
        results.append(IKBreakdownItem(
            ik_id=ik.id,
            kode=ik.kode,
            deskripsi=ik.deskripsi,
            rata_rata=sum(a.nilai for a in achs) / len(achs),
            jumlah_mahasiswa=len(achs),
        ))
    return results


# --- Route dinamis generik HARUS di paling bawah ---

@router.get("/{matkul_id}", response_model=MataKuliahDashboardResponse)
def dashboard_mata_kuliah(matkul_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    peserta_list = db.query(PesertaMataKuliah).filter(PesertaMataKuliah.mata_kuliah_id == matkul_id).all()
    if not peserta_list:
        raise HTTPException(status_code=404, detail="Belum ada peserta untuk mata kuliah ini")

    peserta_ids = [p.id for p in peserta_list]

    hasil_list = db.query(HasilEvaluasi).filter(HasilEvaluasi.peserta_mata_kuliah_id.in_(peserta_ids)).all()
    rata_rata_akhir = (sum(h.nilai_akhir for h in hasil_list) / len(hasil_list)) if hasil_list else None

    ik_achs = db.query(IKAchievement).filter(IKAchievement.mata_kuliah_id == matkul_id).all()
    ik_grouped: dict[int, list[Decimal]] = {}
    for a in ik_achs:
        ik_grouped.setdefault(a.ik_id, []).append(a.nilai)
    ik_breakdown = []
    for ik_id, nilai_list in ik_grouped.items():
        ik = db.query(IK).filter(IK.id == ik_id).first()
        ik_breakdown.append(IKBreakdownItemMK(
            ik_id=ik_id,
            kode=ik.kode if ik else "-",
            rata_rata=sum(nilai_list) / len(nilai_list),
        ))

    cpmk_list = db.query(CPMK).filter(CPMK.mata_kuliah_id == matkul_id).all()
    cpmk_breakdown = []
    for cpmk in cpmk_list:
        achs = db.query(CPMKAchievement).filter(
            CPMKAchievement.cpmk_id == cpmk.id,
            CPMKAchievement.peserta_mata_kuliah_id.in_(peserta_ids),
        ).all()
        if not achs:
            continue
        cpmk_breakdown.append(CPMKBreakdownItem(
            cpmk_id=cpmk.id,
            kode=cpmk.kode,
            rata_rata=sum(a.nilai for a in achs) / len(achs),
            jumlah_tercapai=sum(1 for a in achs if a.status_tercapai == 1),
            jumlah_peserta=len(achs),
        ))

    return MataKuliahDashboardResponse(
        mata_kuliah_id=matkul_id,
        jumlah_peserta=len(peserta_list),
        rata_rata_nilai_akhir=rata_rata_akhir,
        ik_breakdown=ik_breakdown,
        cpmk_breakdown=cpmk_breakdown,
    )


@router.get("/cpl-overview", response_model=list[CPLOverviewItem])
def cpl_overview(program_studi_id: int, semester: str | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cpl_list = db.query(CPL).filter(CPL.program_studi_id == program_studi_id).all()
    results = []
    for cpl in cpl_list:
        query = db.query(CPLAchievement).filter(CPLAchievement.cpl_id == cpl.id)
        if semester:
            query = query.filter(CPLAchievement.semester == semester)
        achs = query.all()
        if not achs:
            continue
        rata_rata = sum(a.nilai for a in achs) / len(achs)
        tercapai = sum(1 for a in achs if a.nilai >= cpl.threshold_capaian)
        results.append(CPLOverviewItem(
            cpl_id=cpl.id,
            kode=cpl.kode,
            deskripsi=cpl.deskripsi,
            rata_rata=rata_rata,
            threshold=cpl.threshold_capaian,
            persen_tercapai=round((tercapai / len(achs)) * 100, 2),
            jumlah_mahasiswa=len(achs),
        ))
    return results


@router.get("/ik-breakdown/{cpl_id}", response_model=list[IKBreakdownItem])
def ik_breakdown_by_cpl(cpl_id: int, semester: str | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    ik_list = db.query(IK).filter(IK.cpl_id == cpl_id).all()
    if not ik_list:
        raise HTTPException(status_code=404, detail="Belum ada IK untuk CPL ini")

    results = []
    for ik in ik_list:
        query = db.query(IKAchievement).filter(IKAchievement.ik_id == ik.id)
        if semester:
            query = query.filter(IKAchievement.semester == semester)
        achs = query.all()
        if not achs:
            continue
        results.append(IKBreakdownItem(
            ik_id=ik.id,
            kode=ik.kode,
            deskripsi=ik.deskripsi,
            rata_rata=sum(a.nilai for a in achs) / len(achs),
            jumlah_mahasiswa=len(achs),
        ))
    return results