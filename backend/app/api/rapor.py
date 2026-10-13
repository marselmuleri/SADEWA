from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope
from app.models.cpl import CPL
from app.models.cpl_achievement import CPLAchievement
from app.models.cpmk import CPMK
from app.models.cpmk_achievement import CPMKAchievement
from app.models.hasil_evaluasi import HasilEvaluasi
from app.models.ik import IK
from app.models.ik_achievement import IKAchievement
from app.models.mahasiswa import Mahasiswa
from app.models.mata_kuliah import MataKuliah
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.schemas.rapor import (
    CPLAchievementItem, CPMKAchievementItem, HasilEvaluasiItem, IKAchievementItem, RaporMahasiswaResponse,
)

router = APIRouter()


@router.get("/mahasiswa/{mahasiswa_id}", response_model=RaporMahasiswaResponse)
def rapor_mahasiswa(
    mahasiswa_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    mhs = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id).first()
    if not mhs:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    if scope.program_studi_id and mhs.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mahasiswa ini di luar prodi Anda")
    if scope.fakultas_id and mhs.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mahasiswa ini di luar fakultas Anda")

    peserta_list = db.query(PesertaMataKuliah).filter(PesertaMataKuliah.mahasiswa_id == mahasiswa_id).all()
    peserta_ids = [p.id for p in peserta_list]
    mk_by_peserta_id = {p.id: p.mata_kuliah for p in peserta_list}

    hasil_evaluasi = [
        HasilEvaluasiItem(
            mata_kuliah_id=mk_by_peserta_id[h.peserta_mata_kuliah_id].id,
            mata_kuliah_nama=mk_by_peserta_id[h.peserta_mata_kuliah_id].nama,
            nilai_akhir=h.nilai_akhir,
            nilai_huruf=h.nilai_huruf,
            status_outcome=h.status_outcome.value if h.status_outcome else None,
        )
        for h in db.query(HasilEvaluasi).filter(HasilEvaluasi.peserta_mata_kuliah_id.in_(peserta_ids)).all()
    ]

    cpmk_achievement = []
    for c in db.query(CPMKAchievement).filter(CPMKAchievement.peserta_mata_kuliah_id.in_(peserta_ids)).all():
        cpmk = db.query(CPMK).filter(CPMK.id == c.cpmk_id).first()
        mk = mk_by_peserta_id[c.peserta_mata_kuliah_id]
        cpmk_achievement.append(CPMKAchievementItem(
            cpmk_id=c.cpmk_id, cpmk_kode=cpmk.kode if cpmk else "-",
            mata_kuliah_id=mk.id, mata_kuliah_nama=mk.nama,
            nilai=c.nilai, status_tercapai=c.status_tercapai == 1,
        ))

    ik_achievement = []
    for a in db.query(IKAchievement).filter(IKAchievement.mahasiswa_id == mahasiswa_id).all():
        ik = db.query(IK).filter(IK.id == a.ik_id).first()
        mk = db.query(MataKuliah).filter(MataKuliah.id == a.mata_kuliah_id).first()
        ik_achievement.append(IKAchievementItem(
            ik_id=a.ik_id, ik_kode=ik.kode if ik else "-",
            mata_kuliah_id=a.mata_kuliah_id, mata_kuliah_nama=mk.nama if mk else "-",
            semester=a.semester.value if a.semester else None, nilai=a.nilai,
        ))

    cpl_achievement = []
    for a in db.query(CPLAchievement).filter(CPLAchievement.mahasiswa_id == mahasiswa_id).all():
        cpl = db.query(CPL).filter(CPL.id == a.cpl_id).first()
        cpl_achievement.append(CPLAchievementItem(
            cpl_id=a.cpl_id, cpl_kode=cpl.kode if cpl else "-",
            semester=a.semester.value if a.semester else None, angkatan=a.angkatan, nilai=a.nilai,
        ))

    return RaporMahasiswaResponse(
        mahasiswa_id=mhs.id, nim=mhs.nim, nama=mhs.nama,
        hasil_evaluasi=hasil_evaluasi, cpmk_achievement=cpmk_achievement,
        ik_achievement=ik_achievement, cpl_achievement=cpl_achievement,
    )