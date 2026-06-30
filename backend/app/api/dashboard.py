from sqlalchemy import func
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.cpl import CPL
from app.models.cpmk import CPMK
from app.models.hasil_prediksi import HasilPrediksi
from app.models.mahasiswa import Mahasiswa
from app.models.mata_kuliah import MataKuliah
from app.models.penilaian import Penilaian
from app.models.user import User

router = APIRouter()


@router.get("/ringkasan")
def ringkasan(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    total_mahasiswa = db.query(func.count(Mahasiswa.id)).scalar() or 0
    rata_cpl = db.query(func.avg(HasilPrediksi.probabilitas_lulus)).scalar() or 0
    total_mk = db.query(func.count(MataKuliah.id)).scalar() or 0
    total_cpl = db.query(func.count(CPL.id)).scalar() or 0
    return {
        "total_mahasiswa": total_mahasiswa,
        "total_mata_kuliah": total_mk,
        "total_cpl": total_cpl,
        "rata_rata_ketercapaian_cpl": round(float(rata_cpl) * 100, 2),
    }


@router.get("/heatmap")
def heatmap(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (
        db.query(
            MataKuliah.id.label("mata_kuliah_id"),
            MataKuliah.nama_mk,
            CPMK.id.label("cpmk_id"),
            CPMK.kode_cpmk,
            func.avg(Penilaian.nilai).label("nilai_avg"),
        )
        .join(CPMK, CPMK.mata_kuliah_id == MataKuliah.id)
        .outerjoin(Penilaian, Penilaian.cpmk_id == CPMK.id)
        .group_by(MataKuliah.id, MataKuliah.nama_mk, CPMK.id, CPMK.kode_cpmk)
        .all()
    )

    return [
        {
            "mata_kuliah_id": r.mata_kuliah_id,
            "nama_mk": r.nama_mk,
            "cpmk_id": r.cpmk_id,
            "kode_cpmk": r.kode_cpmk,
            "ketercapaian": round(float(r.nilai_avg or 0), 2),
        }
        for r in rows
    ]


@router.get("/tren-semester")
def tren_semester(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (
        db.query(
            Penilaian.semester,
            Penilaian.tahun_akademik,
            func.avg(Penilaian.nilai).label("nilai_rata"),
        )
        .group_by(Penilaian.semester, Penilaian.tahun_akademik)
        .order_by(Penilaian.tahun_akademik, Penilaian.semester)
        .all()
    )

    return [
        {
            "semester": r.semester,
            "tahun_akademik": r.tahun_akademik,
            "rata_ketercapaian": round(float(r.nilai_rata or 0), 2),
        }
        for r in rows
    ]
