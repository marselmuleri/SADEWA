from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope
from app.models.cpl import CPL
from app.models.cpl_achievement import CPLAchievement
from app.models.cpmk import CPMK
from app.models.cpmk_achievement import CPMKAchievement
from app.models.enums import UserRole
from app.models.hasil_evaluasi import HasilEvaluasi
from app.models.ik import IK
from app.models.ik_achievement import IKAchievement
from app.models.mahasiswa import Mahasiswa
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.schemas.rapor import (
    CPLAchievementItem, CPLGabunganItem, CPMKAchievementItem, HasilEvaluasiItem, IKAchievementItem,
    RaporMahasiswaResponse,
)
from app.services.calculation.cpl_aggregate import gabung_capaian_cpl

router = APIRouter()


@router.get("/mahasiswa/{mahasiswa_id}", response_model=RaporMahasiswaResponse)
def rapor_mahasiswa(
    mahasiswa_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    # Rapor memuat capaian CPL/IK/CPMK per mahasiswa, jadi termasuk Analitik OBE:
    # wewenang Dosen, Kaprodi, dan Dekan, bukan Admin Prodi.
    if scope.user.role == UserRole.admin_prodi:
        raise HTTPException(status_code=403, detail="Admin Prodi tidak memiliki akses ke rapor capaian mahasiswa (Analitik OBE)")
    if scope.user.role not in (UserRole.dosen, UserRole.kaprodi, UserRole.dekan):
        raise HTTPException(status_code=403, detail="Role ini tidak memiliki akses rapor")

    mhs = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id).first()
    if not mhs:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    if scope.program_studi_id and mhs.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mahasiswa ini di luar prodi Anda")
    if scope.fakultas_id and mhs.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mahasiswa ini di luar fakultas Anda")

    peserta_list = db.query(PesertaMataKuliah).filter(PesertaMataKuliah.mahasiswa_id == mahasiswa_id).all()

    # Dosen hanya melihat rapor mahasiswa di mata kuliah yang diampunya, dan isinya
    # dibatasi ke mata kuliah itu saja.
    is_dosen = scope.user.role == UserRole.dosen
    dosen_mk_ids: set[int] = set()
    if is_dosen:
        dosen_mk_ids = {
            p.mata_kuliah_id
            for p in db.query(PengampuMataKuliah).filter(PengampuMataKuliah.user_id == scope.user.id).all()
        }
        peserta_list = [p for p in peserta_list if p.mata_kuliah_id in dosen_mk_ids]
        if not peserta_list:
            raise HTTPException(status_code=403, detail="Mahasiswa ini bukan peserta mata kuliah yang Anda ampu")

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

    ik_query = db.query(IKAchievement).filter(IKAchievement.mahasiswa_id == mahasiswa_id)
    if is_dosen:
        ik_query = ik_query.filter(IKAchievement.mata_kuliah_id.in_(dosen_mk_ids))

    ik_achievement = []
    for a in ik_query.all():
        ik = db.query(IK).filter(IK.id == a.ik_id).first()
        mk = db.query(MataKuliah).filter(MataKuliah.id == a.mata_kuliah_id).first()
        ik_achievement.append(IKAchievementItem(
            ik_id=a.ik_id, ik_kode=ik.kode if ik else "-",
            mata_kuliah_id=a.mata_kuliah_id, mata_kuliah_nama=mk.nama if mk else "-",
            semester=a.semester.value if a.semester else None, nilai=a.nilai,
        ))

    # Capaian CPL per mata kuliah. Dosen hanya untuk mata kuliah yang diampu.
    cpl_query = db.query(CPLAchievement).filter(CPLAchievement.mahasiswa_id == mahasiswa_id)
    if is_dosen:
        cpl_query = cpl_query.filter(CPLAchievement.mata_kuliah_id.in_(dosen_mk_ids))
    cpl_rows = cpl_query.all()

    cpl_kode = {c.id: c.kode for c in db.query(CPL).filter(CPL.id.in_({a.cpl_id for a in cpl_rows})).all()}
    cpl_achievement = [
        CPLAchievementItem(
            cpl_id=a.cpl_id, cpl_kode=cpl_kode.get(a.cpl_id, "-"),
            mata_kuliah_id=a.mata_kuliah_id,
            mata_kuliah_nama=a.mata_kuliah.nama if a.mata_kuliah else None,
            semester=a.semester.value if a.semester else None, angkatan=a.angkatan,
            nilai=a.nilai, bobot_cp=a.bobot_cp,
        )
        for a in cpl_rows
    ]

    # Gabungan lintas mata kuliah (berbobot bobot IK) hanya untuk Kaprodi & Dekan,
    # karena memuat mata kuliah yang tidak diampu Dosen.
    cpl_gabungan = [] if is_dosen else [
        CPLGabunganItem(
            cpl_id=g.cpl_id, cpl_kode=cpl_kode.get(g.cpl_id, "-"),
            nilai=g.nilai, jumlah_mata_kuliah=g.jumlah_mata_kuliah,
        )
        for g in sorted(gabung_capaian_cpl(cpl_rows).values(), key=lambda g: cpl_kode.get(g.cpl_id, ""))
    ]

    return RaporMahasiswaResponse(
        mahasiswa_id=mhs.id, nim=mhs.nim, nama=mhs.nama,
        hasil_evaluasi=hasil_evaluasi, cpmk_achievement=cpmk_achievement,
        ik_achievement=ik_achievement, cpl_achievement=cpl_achievement,
        cpl_gabungan=cpl_gabungan,
    )