"""
Kurikulum aktif per program studi: satu versi kurikulum yang dipakai Analitik OBE.

Ditetapkan Admin Prodi (ProgramStudi.kurikulum_aktif_id). Selama belum ditetapkan,
dipakai versi published terbaru supaya analitik tetap tampil, dan ditandai
`ditetapkan=False` agar UI bisa mengingatkan.
"""
from sqlalchemy.orm import Session

from app.models.enums import StatusKurikulum
from app.models.kurikulum_version import KurikulumVersion
from app.models.program_studi import ProgramStudi


def _status(v: KurikulumVersion) -> str:
    return v.status.value if hasattr(v.status, "value") else str(v.status)


def pilih_kurikulum_aktif(prodi: ProgramStudi | None) -> tuple[KurikulumVersion | None, bool]:
    """(versi aktif, ditetapkan admin?) untuk objek prodi."""
    if prodi is None:
        return None, False
    if prodi.kurikulum_aktif is not None:
        return prodi.kurikulum_aktif, True
    published = [v for v in prodi.kurikulum_versions if _status(v) == StatusKurikulum.published.value]
    if not published:
        return None, False
    terbaru = max(published, key=lambda v: (v.published_at is not None, v.published_at or 0, v.id))
    return terbaru, False


def kurikulum_aktif(db: Session, prodi_id: int | None) -> tuple[KurikulumVersion | None, bool]:
    prodi = db.query(ProgramStudi).filter(ProgramStudi.id == prodi_id).first() if prodi_id else None
    return pilih_kurikulum_aktif(prodi)


def kurikulum_aktif_id(db: Session, prodi_id: int | None) -> int | None:
    versi, _ = kurikulum_aktif(db, prodi_id)
    return versi.id if versi else None


def ringkas_kurikulum_aktif(db: Session, prodi_id: int | None) -> dict | None:
    versi, ditetapkan = kurikulum_aktif(db, prodi_id)
    if not versi:
        return None
    return {"id": versi.id, "label": versi.version_label, "tahun": versi.tahun, "ditetapkan": ditetapkan}
