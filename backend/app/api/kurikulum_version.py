from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope, require_roles
from app.models.enums import UserRole
from app.models.kurikulum_version import KurikulumVersion
from app.models.program_studi import ProgramStudi
from app.models.skala_nilai import SkalaNilai
from app.models.user import User
from app.schemas.kurikulum_version import KurikulumVersionCreate, KurikulumVersionResponse
from app.schemas.skala_nilai import KelompokSkalaResponse, SkalaItem, SkalaNilaiRequest, SkalaNilaiResponse
from app.services.skala_nilai import KelompokSkala, muat_kelompok, validasi_kelompok
from app.services.arsip import arsipkan_publish

router = APIRouter()


def _require_prodi_scope(user: User) -> int:
    if not user.program_studi_id:
        raise HTTPException(status_code=400, detail="Akun ini belum terhubung ke Program Studi manapun")
    return user.program_studi_id


@router.get("", response_model=list[KurikulumVersionResponse])
def list_versions(
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    query = db.query(KurikulumVersion)
    if scope.program_studi_id:
        query = query.filter(KurikulumVersion.program_studi_id == scope.program_studi_id)
    elif scope.fakultas_id:
        query = query.join(ProgramStudi).filter(ProgramStudi.fakultas_id == scope.fakultas_id)
    return query.order_by(KurikulumVersion.id.desc()).all()


@router.post("", response_model=KurikulumVersionResponse)
def create_version(
    payload: KurikulumVersionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    prodi_id = _require_prodi_scope(user)
    v_label = payload.version_label or payload.versi
    if not v_label:
        raise HTTPException(status_code=400, detail="Versi kurikulum wajib diisi")

    data = KurikulumVersion(
        program_studi_id=prodi_id,
        version_label=v_label,
        deskripsi=payload.deskripsi,
        tahun=payload.tahun,
        status="draft",
        created_by=user.id,
    )
    db.add(data)
    db.commit()
    db.refresh(data)
    return data


@router.post("/{version_id}/publish", response_model=KurikulumVersionResponse)
def publish_version(
    version_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi)),
):
    prodi_id = _require_prodi_scope(user)
    data = db.query(KurikulumVersion).filter(KurikulumVersion.id == version_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Versi kurikulum tidak ditemukan")
    if data.program_studi_id != prodi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh publish kurikulum di luar prodi Anda")
    data.status = "published"
    data.published_at = datetime.now(timezone.utc)
    db.flush()
    # Data Master: snapshot kurikulum yang fix dipakai (hanya saat publish pertama).
    arsipkan_publish(db, data, user.id)
    db.commit()
    db.refresh(data)
    return data


def _skala_response(db: Session, version_id: int) -> SkalaNilaiResponse:
    kelompok = muat_kelompok(db, version_id)
    bawaan = next((k for k in kelompok if k.bawaan), None)
    return SkalaNilaiResponse(
        kurikulum_version_id=version_id,
        skala=[SkalaItem(huruf=h, batas_min=b) for h, b in (bawaan.skala if bawaan else [])],
        kelompok=[
            KelompokSkalaResponse(
                angkatan_min=k.angkatan_min,
                angkatan_max=k.angkatan_max,
                label=k.label,
                skala=[SkalaItem(huruf=h, batas_min=b) for h, b in k.skala],
            )
            for k in kelompok
        ],
    )


@router.post("/{version_id}/skala-nilai", response_model=SkalaNilaiResponse)
def atur_skala_nilai(
    version_id: int,
    payload: SkalaNilaiRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi)),
):
    """
    Atur skala nilai huruf kurikulum. Bisa per kelompok angkatan (field `kelompok`)
    atau hanya skala bawaan (field `skala`, format lama).
    Nilai yang sudah difinalisasi tidak berubah (snapshot).
    """
    kur = db.query(KurikulumVersion).filter(KurikulumVersion.id == version_id).first()
    if not kur:
        raise HTTPException(status_code=404, detail="Versi kurikulum tidak ditemukan")
    if kur.program_studi_id != user.program_studi_id:
        raise HTTPException(status_code=403, detail="Tidak boleh mengubah skala kurikulum di luar prodi Anda")

    def ke_kelompok(angkatan_min, angkatan_max, items) -> KelompokSkala:
        return KelompokSkala(
            angkatan_min=angkatan_min,
            angkatan_max=angkatan_max,
            skala=[(i.huruf.strip(), Decimal(str(i.batas_min))) for i in items],
        )

    if payload.kelompok is not None:
        baru = [ke_kelompok(k.angkatan_min, k.angkatan_max, k.skala) for k in payload.kelompok]
    elif payload.skala is not None:
        lama = [k for k in muat_kelompok(db, version_id) if not k.bawaan]
        baru = lama + [ke_kelompok(None, None, payload.skala)]
    else:
        raise HTTPException(status_code=400, detail="Kirim 'kelompok' atau 'skala'")

    errors = validasi_kelompok(baru)
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    db.query(SkalaNilai).filter(SkalaNilai.kurikulum_version_id == version_id).delete()
    for k in baru:
        for huruf, batas in k.skala:
            db.add(SkalaNilai(
                kurikulum_version_id=version_id,
                huruf=huruf,
                batas_min=batas,
                angkatan_min=k.angkatan_min,
                angkatan_max=k.angkatan_max,
            ))
    db.commit()
    return _skala_response(db, version_id)


@router.get("/{version_id}/skala-nilai", response_model=SkalaNilaiResponse)
def get_skala_nilai(
    version_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    kur = db.query(KurikulumVersion).filter(KurikulumVersion.id == version_id).first()
    if not kur:
        raise HTTPException(status_code=404, detail="Versi kurikulum tidak ditemukan")

    if scope.program_studi_id and kur.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Kurikulum ini di luar prodi Anda")
    if scope.fakultas_id and kur.program_studi.fakultas_id != scope.fakultas_id:
        raise HTTPException(status_code=403, detail="Kurikulum ini di luar fakultas Anda")

    return _skala_response(db, version_id)