from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.hasil_evaluasi import HasilEvaluasi
from app.models.mata_kuliah import MataKuliah
from app.models.mk_bentuk_penilaian import MKBentukPenilaian
from app.models.mk_bentuk_penilaian_ik_map import MKBentukPenilaianIKMap
from app.models.nilai_bentuk_penilaian import NilaiBentukPenilaian
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.program_studi import ProgramStudi
from app.models.siap_sync_log import SiapSyncLog
from app.models.user import User
from app.schemas.nilai import NilaiManualInput, NilaiResponse, NilaiUpdate, SyncLogResponse
from app.services.calculation.engine import cek_siap_dinilai

router = APIRouter()


def _check_write_access(db: Session, user: User, mata_kuliah_id: int) -> MataKuliah:
    mk = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if user.role in (UserRole.admin_prodi, UserRole.kaprodi):
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


def _mata_kuliah_id_of_mk_bentuk_penilaian(db: Session, mk_bentuk_penilaian_id: int) -> int:
    mbp = db.query(MKBentukPenilaian).filter(MKBentukPenilaian.id == mk_bentuk_penilaian_id).first()
    if not mbp:
        raise HTTPException(status_code=404, detail="Bentuk penilaian mata kuliah tidak ditemukan")
    return mbp.mata_kuliah_id


def _validate_mata_kuliah_siap_dinilai(db: Session, mata_kuliah_id: int) -> None:
    """
    Hook satu pintu untuk validasi syarat kesiapan penilaian mata kuliah (Langkah 4).
    Memeriksa C2, C5, C6, dan C7 sebelum nilai boleh dimasukkan.
    """
    issues = cek_siap_dinilai(db, mata_kuliah_id)
    if issues:
        raise HTTPException(
            status_code=400,
            detail=f"Mata kuliah belum siap dinilai: {'; '.join(issues)}"
        )


@router.post("/sync")
def sync(mk_id: int, semester: str, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    _check_write_access(db, user, mk_id)
    log = SiapSyncLog(
        mata_kuliah_id=mk_id,
        semester=semester,
        status="not_configured",
        total_records=0,
        triggered_by=user.id,
    )
    db.add(log)
    db.commit()
    return {
        "status": "not_configured",
        "message": "Integrasi SIAP UNDIP belum tersedia. Gunakan input manual.",
        "fallback": "/nilai/manual",
    }


@router.get("/sync-logs/{mk_id}", response_model=list[SyncLogResponse])
def get_sync_logs(mk_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    mk = db.query(MataKuliah).filter(MataKuliah.id == mk_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if scope.user.role == UserRole.dosen:
        is_pengampu = db.query(PengampuMataKuliah).filter(
            PengampuMataKuliah.mata_kuliah_id == mk_id,
            PengampuMataKuliah.user_id == scope.user.id,
        ).first()
        if not is_pengampu:
            raise HTTPException(status_code=403, detail="Anda bukan dosen pengampu mata kuliah ini")
    elif scope.program_studi_id and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    if scope.fakultas_id and mk.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")
    return db.query(SiapSyncLog).filter(SiapSyncLog.mata_kuliah_id == mk_id).order_by(SiapSyncLog.created_at.desc()).all()


@router.post("/manual", response_model=list[NilaiResponse])
def input_manual(payload: NilaiManualInput, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    # Cek hak akses ke mata kuliah
    checked_mk_ids: set[int] = set()
    for record in payload.records:
        mk_id = _mata_kuliah_id_of_mk_bentuk_penilaian(db, record.mk_bentuk_penilaian_id)
        if mk_id not in checked_mk_ids:
            _check_write_access(db, user, mk_id)
            # Panggil hook kesiapan penilaian (Langkah 4 nantinya dipusatkan di sini)
            _validate_mata_kuliah_siap_dinilai(db, mk_id)
            checked_mk_ids.add(mk_id)

    # 1. Validasi per record. Nilai tanpa IK berlaku untuk SEMUA IK pada matriks bentuk
    #    penilaian itu (satu nilai Tugas/UTS/UAS seperti di form dan impor Excel), sama dengan
    #    aturan mesin kalkulasi untuk nilai tanpa IK. Kolom ik_id di database wajib terisi.
    ik_per_mbp: dict[int, list[int]] = {}
    peserta_cek: dict[int, int] = {}
    seen_keys: set[tuple[int, int, int]] = set()
    rencana: list[tuple[int, int, int, Decimal]] = []
    for record in payload.records:
        # Validasi rentang nilai 0..100 (C8)
        if record.nilai < Decimal("0") or record.nilai > Decimal("100"):
            raise HTTPException(status_code=400, detail="Nilai harus berada dalam rentang 0 sampai 100")

        pid = record.peserta_mata_kuliah_id
        mbp_id = record.mk_bentuk_penilaian_id
        if pid not in peserta_cek:
            peserta = db.query(PesertaMataKuliah).filter(PesertaMataKuliah.id == pid).first()
            if not peserta or peserta.mata_kuliah_id != _mata_kuliah_id_of_mk_bentuk_penilaian(db, mbp_id):
                raise HTTPException(status_code=400, detail=f"Peserta ID {pid} bukan peserta mata kuliah ini")
            # Validasi peserta tidak terkunci karena sudah difinalisasi
            he = db.query(HasilEvaluasi).filter(HasilEvaluasi.peserta_mata_kuliah_id == pid).first()
            if he and he.is_final:
                raise HTTPException(
                    status_code=409,
                    detail=f"Peserta ID {pid} telah difinalisasi dan nilai terkunci. Buka kunci terlebih dahulu untuk mengoreksi nilai.",
                )
            peserta_cek[pid] = peserta.mata_kuliah_id

        if mbp_id not in ik_per_mbp:
            ik_per_mbp[mbp_id] = [
                m.ik_id
                for m in db.query(MKBentukPenilaianIKMap).filter(MKBentukPenilaianIKMap.mk_bentuk_penilaian_id == mbp_id).all()
                if m.bobot is not None and Decimal(str(m.bobot)) > Decimal("0")
            ]

        if record.ik_id is None:
            ik_ids = ik_per_mbp[mbp_id]
            if not ik_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"Bentuk penilaian {mbp_id} belum memiliki pemetaan IK (Setting Bobot IK) sehingga belum bisa dinilai",
                )
        else:
            # Validasi IK harus ada dalam matriks bentuk penilaian dengan bobot sel > 0
            if record.ik_id not in ik_per_mbp[mbp_id]:
                raise HTTPException(
                    status_code=400,
                    detail=f"IK ID {record.ik_id} tidak terdapat dalam matriks bentuk penilaian {mbp_id} atau bobot selnya 0",
                )
            ik_ids = [record.ik_id]

        for ik_id in ik_ids:
            key = (pid, mbp_id, ik_id)
            if key in seen_keys:
                raise HTTPException(status_code=400, detail="Duplikat kombinasi peserta, bentuk penilaian, dan IK dalam satu request")
            seen_keys.add(key)
            rencana.append((pid, mbp_id, ik_id, record.nilai))

    created_or_updated = []
    for pid, mbp_id, ik_id, nilai in rencana:
        # Kombinasi yang sudah ada = koreksi nilai (upsert)
        existing = db.query(NilaiBentukPenilaian).filter(
            NilaiBentukPenilaian.peserta_mata_kuliah_id == pid,
            NilaiBentukPenilaian.mk_bentuk_penilaian_id == mbp_id,
            NilaiBentukPenilaian.ik_id == ik_id,
        ).first()

        if existing:
            existing.nilai = nilai
            existing.semester = payload.semester
            existing.source = payload.sumber
            existing.imported_by = user.id
            created_or_updated.append(existing)
        else:
            data = NilaiBentukPenilaian(
                peserta_mata_kuliah_id=pid,
                mk_bentuk_penilaian_id=mbp_id,
                ik_id=ik_id,
                semester=payload.semester,
                nilai=nilai,
                source=payload.sumber,
                imported_by=user.id,
            )
            db.add(data)
            created_or_updated.append(data)

    db.commit()
    for d in created_or_updated:
        db.refresh(d)
    return created_or_updated


@router.get("/{mk_id}", response_model=list[NilaiResponse])
def get_nilai(mk_id: int, db: Session = Depends(get_db), scope: AcademicScope = Depends(get_academic_scope)):
    mk = db.query(MataKuliah).filter(MataKuliah.id == mk_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    if scope.user.role == UserRole.dosen:
        is_pengampu = db.query(PengampuMataKuliah).filter(
            PengampuMataKuliah.mata_kuliah_id == mk_id,
            PengampuMataKuliah.user_id == scope.user.id,
        ).first()
        if not is_pengampu:
            raise HTTPException(status_code=403, detail="Anda bukan dosen pengampu mata kuliah ini")
    elif scope.program_studi_id and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    if scope.fakultas_id and mk.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")
    return db.query(NilaiBentukPenilaian).join(PesertaMataKuliah).filter(PesertaMataKuliah.mata_kuliah_id == mk_id).all()


@router.put("/{nilai_id}", response_model=NilaiResponse)
def update_nilai(nilai_id: int, payload: NilaiUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    data = db.query(NilaiBentukPenilaian).filter(NilaiBentukPenilaian.id == nilai_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Nilai tidak ditemukan")
    mk_id = _mata_kuliah_id_of_mk_bentuk_penilaian(db, data.mk_bentuk_penilaian_id)
    _check_write_access(db, user, mk_id)
    he = db.query(HasilEvaluasi).filter(HasilEvaluasi.peserta_mata_kuliah_id == data.peserta_mata_kuliah_id).first()
    if he and he.is_final:
        raise HTTPException(
            status_code=409,
            detail=f"Peserta ID {data.peserta_mata_kuliah_id} telah difinalisasi dan nilai terkunci. Buka kunci terlebih dahulu untuk mengoreksi nilai.",
        )
    data.nilai = payload.nilai
    db.commit()
    db.refresh(data)
    return data


@router.delete("/{nilai_id}")
def delete_nilai(nilai_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.dosen))):
    data = db.query(NilaiBentukPenilaian).filter(NilaiBentukPenilaian.id == nilai_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Nilai tidak ditemukan")
    mk_id = _mata_kuliah_id_of_mk_bentuk_penilaian(db, data.mk_bentuk_penilaian_id)
    _check_write_access(db, user, mk_id)
    he = db.query(HasilEvaluasi).filter(HasilEvaluasi.peserta_mata_kuliah_id == data.peserta_mata_kuliah_id).first()
    if he and he.is_final:
        raise HTTPException(
            status_code=409,
            detail=f"Peserta ID {data.peserta_mata_kuliah_id} telah difinalisasi dan nilai terkunci. Buka kunci terlebih dahulu untuk menghapus nilai.",
        )
    db.delete(data)
    db.commit()
    return {"message": "Nilai dihapus"}