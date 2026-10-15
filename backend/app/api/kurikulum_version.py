from datetime import datetime, timezone
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
from app.schemas.skala_nilai import SkalaItem, SkalaNilaiRequest, SkalaNilaiResponse

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
    data = KurikulumVersion(
        **{**payload.model_dump(), "program_studi_id": prodi_id},
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
    db.commit()
    db.refresh(data)
    return data


@router.post("/{version_id}/skala-nilai", response_model=SkalaNilaiResponse)
def atur_skala_nilai(
    version_id: int,
    payload: SkalaNilaiRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin_prodi, UserRole.kaprodi)),
):
    kur = db.query(KurikulumVersion).filter(KurikulumVersion.id == version_id).first()
    if not kur:
        raise HTTPException(status_code=404, detail="Versi kurikulum tidak ditemukan")

    if user.role in (UserRole.admin_prodi, UserRole.kaprodi):
        if kur.program_studi_id != user.program_studi_id:
            raise HTTPException(status_code=403, detail="Tidak boleh mengubah skala kurikulum di luar prodi Anda")

    skala = payload.skala

    # 1. Wajib ada batas_min 0
    if not any(item.batas_min == 0 for item in skala):
        raise HTTPException(status_code=400, detail="Wajib ada skala dengan batas minimal 0")

    # 2. Batas_min kembar ditolak
    batas_list = [item.batas_min for item in skala]
    if len(batas_list) != len(set(batas_list)):
        raise HTTPException(status_code=400, detail="Batas minimal tidak boleh kembar")

    # 3. Huruf kembar ditolak
    huruf_list = [item.huruf.strip().upper() for item in skala]
    if len(huruf_list) != len(set(huruf_list)):
        raise HTTPException(status_code=400, detail="Huruf tidak boleh kembar")

    # 4. Batas di luar 0-100 ditolak
    for item in skala:
        if item.batas_min < 0 or item.batas_min > 100:
            raise HTTPException(status_code=400, detail="Batas minimal harus berada dalam rentang 0-100")

    # Hapus skala lama dan simpan yang baru
    db.query(SkalaNilai).filter(SkalaNilai.kurikulum_version_id == version_id).delete()

    created_items = []
    # Urutkan berdasarkan batas_min descending
    for item in sorted(skala, key=lambda x: x.batas_min, reverse=True):
        row = SkalaNilai(
            kurikulum_version_id=version_id,
            huruf=item.huruf.strip(),
            batas_min=item.batas_min,
        )
        db.add(row)
        created_items.append(SkalaItem(huruf=row.huruf, batas_min=row.batas_min))

    db.commit()
    return SkalaNilaiResponse(kurikulum_version_id=version_id, skala=created_items)


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

    rows = (
        db.query(SkalaNilai)
        .filter(SkalaNilai.kurikulum_version_id == version_id)
        .order_by(SkalaNilai.batas_min.desc())
        .all()
    )
    items = [SkalaItem(huruf=r.huruf, batas_min=r.batas_min) for r in rows]
    return SkalaNilaiResponse(kurikulum_version_id=version_id, skala=items)