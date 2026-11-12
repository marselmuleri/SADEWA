from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.cpmk import CPMK
from app.models.cpmk_ik_map import CPMKIKMap
from app.models.enums import UserRole
from app.models.hasil_evaluasi import HasilEvaluasi
from app.models.ik import IK
from app.models.ik_achievement import IKAchievement
from app.models.mata_kuliah import MataKuliah
from app.models.mk_bentuk_penilaian import MKBentukPenilaian
from app.models.mk_bentuk_penilaian_ik_map import MKBentukPenilaianIKMap
from app.models.nilai_bentuk_penilaian import NilaiBentukPenilaian
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.user import User
from app.schemas.kalkulasi import KalkulasiRunResponse, ValidasiBobotResponse, ValidasiBobotRequest
from app.services.calculation.engine import cek_siap_dinilai, run_kalkulasi, validasi_bobot_mata_kuliah
from app.services.calculation.obe_formula import compute_result, pilih_huruf
from app.services.portofolio_aturan import ambang_prodi
from app.services.skala_nilai import muat_kelompok, skala_untuk_angkatan

router = APIRouter()


class UnlockRequest(BaseModel):
    alasan: str


def _check_write_access(db: Session, user: User, mata_kuliah_id: int) -> MataKuliah:
    mk = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if user.role == UserRole.admin_prodi:
        if mk.program_studi_id != user.program_studi_id:
            raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    elif user.role == UserRole.dosen:
        is_pengampu = db.query(PengampuMataKuliah).filter(
            PengampuMataKuliah.mata_kuliah_id == mata_kuliah_id,
            PengampuMataKuliah.user_id == user.id,
        ).first()
        if not is_pengampu:
            raise HTTPException(status_code=403, detail="Anda bukan dosen pengampu mata kuliah ini")
    return mk


def _execute_validasi_bobot(mata_kuliah_id: int, db: Session, user: User) -> dict:
    mk = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if user.role in (UserRole.admin_prodi, UserRole.kaprodi):
        if mk.program_studi_id != user.program_studi_id:
            raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    elif user.role == UserRole.dekan:
        if mk.program_studi.fakultas_id != user.fakultas_id:
            raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")

    warnings = validasi_bobot_mata_kuliah(db, mata_kuliah_id)
    return {"valid": len(warnings) == 0, "warnings": warnings}


@router.post("/validasi-bobot", response_model=ValidasiBobotResponse)
def validasi_bobot(
    payload: ValidasiBobotRequest | None = None,
    mata_kuliah_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    target_id = payload.mata_kuliah_id if payload else mata_kuliah_id
    if not target_id:
        raise HTTPException(status_code=400, detail="mata_kuliah_id wajib diberikan")
    return _execute_validasi_bobot(target_id, db, scope.user)


@router.post("/validasibobot", response_model=ValidasiBobotResponse, include_in_schema=False)
def validasi_bobot_alias(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """Alias backward compatibility untuk URL lama /validasibobot."""
    return _execute_validasi_bobot(mata_kuliah_id, db, scope.user)


@router.post("/run/{matkul_id}", response_model=KalkulasiRunResponse)
def run(
    matkul_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen)),
):
    """
    Jalankan engine kalkulasi OBE deterministik per mata kuliah.
    Menghitung capaian IK, CPMK, CPL, dan nilai akhir mahasiswa.
    Ditolak bila bobot penilaian belum lengkap (aturan yang sama dengan finalisasi), agar
    capaian yang tersimpan tidak dihitung dari konfigurasi bobot yang belum 100%.
    Nilai akhir peserta yang sudah difinalisasi tidak ditimpa.
    """
    _check_write_access(db, user, matkul_id)
    issues = cek_siap_dinilai(db, matkul_id)
    if issues:
        raise HTTPException(status_code=400, detail=f"Mata kuliah belum siap dinilai: {'; '.join(issues)}")
    result = run_kalkulasi(db, matkul_id)
    return result


@router.post("/peserta/{peserta_mata_kuliah_id}/finalize")
def finalize_peserta(
    peserta_mata_kuliah_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi, UserRole.dosen)),
):
    """
    Finalisasi nilai OBE per peserta:
    Nilai dihitung oleh server dari nilai tersimpan; disimpan sebagai snapshot.
    """
    peserta = db.query(PesertaMataKuliah).filter(PesertaMataKuliah.id == peserta_mata_kuliah_id).first()
    if not peserta:
        raise HTTPException(status_code=404, detail="Peserta mata kuliah tidak ditemukan")

    mk = peserta.mata_kuliah
    if user.role in (UserRole.admin_prodi, UserRole.kaprodi):
        if mk.program_studi_id != user.program_studi_id:
            raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    elif user.role == UserRole.dosen:
        is_pengampu = db.query(PengampuMataKuliah).filter(
            PengampuMataKuliah.mata_kuliah_id == mk.id,
            PengampuMataKuliah.user_id == user.id,
        ).first()
        if not is_pengampu:
            raise HTTPException(status_code=403, detail="Anda bukan dosen pengampu mata kuliah ini")

    # 1. Cek kesiapan penilaian mata kuliah
    issues = cek_siap_dinilai(db, mk.id)
    if issues:
        raise HTTPException(status_code=400, detail=f"Mata kuliah belum siap dinilai: {'; '.join(issues)}")

    # 2. Cek apakah peserta memiliki nilai tersimpan
    scores = db.query(NilaiBentukPenilaian).filter(NilaiBentukPenilaian.peserta_mata_kuliah_id == peserta.id).all()
    if not scores:
        raise HTTPException(status_code=400, detail="Peserta belum memiliki nilai tersimpan")

    # 3. Cek skala nilai kurikulum
    skala_list = skala_untuk_angkatan(
        muat_kelompok(db, mk.kurikulum_version_id), getattr(peserta.mahasiswa, "angkatan", None)
    )
    if not skala_list:
        raise HTTPException(status_code=400, detail="Kurikulum belum memiliki konfigurasi skala nilai huruf")
    ambang = ambang_prodi(db, mk.program_studi_id)

    # 4. Idempotensi: tolak bila sudah final
    existing = db.query(HasilEvaluasi).filter(HasilEvaluasi.peserta_mata_kuliah_id == peserta.id).first()
    if existing and existing.is_final:
        raise HTTPException(status_code=409, detail="Nilai peserta sudah difinalisasi")

    # 5. Hitung nilai secara deterministik menggunakan pipeline yang sama
    mbp_list = db.query(MKBentukPenilaian).filter(MKBentukPenilaian.mata_kuliah_id == mk.id).all()
    cpmk_list = db.query(CPMK).filter(CPMK.mata_kuliah_id == mk.id).all()

    matrix: dict[int, dict[int, Decimal]] = {}
    ik_ids_in_mk: set[int] = set()
    for mbp in mbp_list:
        matrix[mbp.id] = {}
        maps = db.query(MKBentukPenilaianIKMap).filter(MKBentukPenilaianIKMap.mk_bentuk_penilaian_id == mbp.id).all()
        for m in maps:
            matrix[mbp.id][m.ik_id] = m.bobot
            ik_ids_in_mk.add(m.ik_id)

    cpmk_ik: dict[int, dict[int, Decimal]] = {}
    for cpmk in cpmk_list:
        cpmk_ik[cpmk.id] = {}
        maps = db.query(CPMKIKMap).filter(CPMKIKMap.cpmk_id == cpmk.id).all()
        for m in maps:
            cpmk_ik[cpmk.id][m.ik_id] = m.bobot
            ik_ids_in_mk.add(m.ik_id)

    ik_to_cpl = {ik.id: ik.cpl_id for ik in db.query(IK).filter(IK.id.in_(ik_ids_in_mk)).all()} if ik_ids_in_mk else {}

    nilai_dict: dict[int, dict[int, Decimal]] = {}
    for n in scores:
        if n.ik_id is not None:
            nilai_dict.setdefault(n.mk_bentuk_penilaian_id, {})[n.ik_id] = n.nilai

    hasil_obe = compute_result(cpmk_ik=cpmk_ik, matrix=matrix, nilai=nilai_dict, ik_cpl=ik_to_cpl)
    nilai_akhir = hasil_obe.nilai_akhir
    nilai_huruf = pilih_huruf(nilai_akhir, skala_list)

    if existing:
        existing.nilai_akhir = nilai_akhir
        existing.nilai_huruf = nilai_huruf
        existing.nilai_bobot = nilai_akhir
        existing.status_outcome = "Tercapai" if nilai_akhir >= ambang else "Tidak Tercapai"
        existing.is_final = True
        existing.finalized_at = datetime.now(timezone.utc)
        existing.finalized_by = user.id
        hasil = existing
    else:
        hasil = HasilEvaluasi(
            peserta_mata_kuliah_id=peserta.id,
            kurikulum_version_id=mk.kurikulum_version_id,
            nilai_akhir=nilai_akhir,
            nilai_huruf=nilai_huruf,
            nilai_bobot=nilai_akhir,
            status_outcome="Tercapai" if nilai_akhir >= ambang else "Tidak Tercapai",
            is_final=True,
            finalized_at=datetime.now(timezone.utc),
            finalized_by=user.id,
        )
        db.add(hasil)

    db.commit()
    db.refresh(hasil)
    return {
        "id": hasil.id,
        "peserta_mata_kuliah_id": hasil.peserta_mata_kuliah_id,
        "nilai_huruf": hasil.nilai_huruf,
        "nilai_akhir": float(hasil.nilai_akhir) if hasil.nilai_akhir is not None else 0.0,
        "is_final": hasil.is_final,
        "finalized_at": hasil.finalized_at,
    }


@router.post("/peserta/{peserta_mata_kuliah_id}/unlock")
def unlock_peserta(
    peserta_mata_kuliah_id: int,
    payload: UnlockRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi)),
):
    """
    Membuka kunci nilai peserta:
    Hanya boleh dilakukan oleh Admin Prodi dan Kaprodi, dengan alasan yang wajib diisi.
    """
    peserta = db.query(PesertaMataKuliah).filter(PesertaMataKuliah.id == peserta_mata_kuliah_id).first()
    if not peserta:
        raise HTTPException(status_code=404, detail="Peserta mata kuliah tidak ditemukan")

    mk = peserta.mata_kuliah
    if mk.program_studi_id != user.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")

    if not payload.alasan or not payload.alasan.strip():
        raise HTTPException(status_code=400, detail="Alasan pembukaan kunci wajib diisi")

    hasil = db.query(HasilEvaluasi).filter(HasilEvaluasi.peserta_mata_kuliah_id == peserta.id).first()
    if not hasil or not hasil.is_final:
        raise HTTPException(status_code=400, detail="Nilai peserta belum difinalisasi")

    hasil.is_final = False
    hasil.unlocked_at = datetime.now(timezone.utc)
    hasil.unlocked_by = user.id
    hasil.alasan_buka = payload.alasan.strip()
    db.commit()
    db.refresh(hasil)

    return {
        "id": hasil.id,
        "peserta_mata_kuliah_id": hasil.peserta_mata_kuliah_id,
        "is_final": hasil.is_final,
        "unlocked_at": hasil.unlocked_at,
        "alasan_buka": hasil.alasan_buka,
    }


@router.get("/hasil/{hasil_id}")
def get_hasil_detail(
    hasil_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """Ambil detail snapshot hasil evaluasi yang tersimpan."""
    hasil = db.query(HasilEvaluasi).filter(HasilEvaluasi.id == hasil_id).first()
    if not hasil:
        raise HTTPException(status_code=404, detail="Hasil evaluasi tidak ditemukan")
    mk = hasil.peserta_mata_kuliah.mata_kuliah if hasil.peserta_mata_kuliah else None
    if not mk:
        raise HTTPException(status_code=404, detail="Hasil evaluasi tidak ditemukan")
    if scope.program_studi_id and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Hasil evaluasi ini di luar prodi Anda")
    if scope.fakultas_id and (not mk.program_studi or mk.program_studi.fakultas_id != scope.fakultas_id):
        raise HTTPException(status_code=403, detail="Hasil evaluasi ini di luar fakultas Anda")
    if scope.user.role == UserRole.dosen and not db.query(PengampuMataKuliah).filter(
        PengampuMataKuliah.mata_kuliah_id == mk.id, PengampuMataKuliah.user_id == scope.user.id,
    ).first():
        raise HTTPException(status_code=403, detail="Anda bukan dosen pengampu mata kuliah ini")

    return {
        "id": hasil.id,
        "nilai_huruf": hasil.nilai_huruf,
        "nilai_akhir": float(hasil.nilai_akhir) if hasil.nilai_akhir is not None else 0.0,
        "is_final": hasil.is_final,
    }


@router.get("/{matkul_id}")
def get_hasil(
    matkul_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """Ambil ringkasan hasil kalkulasi IK per mata kuliah."""
    mk = db.query(MataKuliah).filter(MataKuliah.id == matkul_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if scope.program_studi_id and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    if scope.fakultas_id and mk.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")

    results = db.query(IKAchievement).filter(IKAchievement.mata_kuliah_id == matkul_id).all()
    return [{"mahasiswa_id": r.mahasiswa_id, "ik_id": r.ik_id, "nilai": float(r.nilai)} for r in results]
