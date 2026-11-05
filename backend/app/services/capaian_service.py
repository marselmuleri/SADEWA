"""
Service untuk mengagregasi data ketercapaian CPMK dan CPL riil dari database.

Sesuai PRD SADEWA:
Angka ketercapaian dihitung secara deterministik dari database dan diteruskan
ke AI Service agar LLM tidak menebak atau mengarang angka.
Jika belum ada data nilai/kalkulasi, service mengembalikan list kosong sehingga
route handler dapat menolak request dengan HTTP 422.

Perubahan:
- Fix bug `func.cast(..., func.integer())` → pakai `case()` yang valid di PostgreSQL.
- Tambah agregasi CPL (`get_capaian_cpl_mata_kuliah`) agar AI menerima data CPL
  nyata, bukan tebak-tebakan mapping dari deskripsi CPMK.
- `get_capaian_mata_kuliah` sekarang mengembalikan CPL dulu, lalu CPMK —
  urutan ini sesuai dengan yang diharapkan prompt narasi AI.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.cpl import CPL
from app.models.cpl_achievement import CPLAchievement
from app.models.cpmk import CPMK
from app.models.cpmk_achievement import CPMKAchievement
from app.models.ik import IK
from app.models.mk_bentuk_penilaian import MKBentukPenilaian
from app.models.mk_bentuk_penilaian_ik_map import MKBentukPenilaianIKMap
from app.models.peserta_mata_kuliah import PesertaMataKuliah

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper: mahasiswa IDs dalam satu mata kuliah
# ---------------------------------------------------------------------------

def _mahasiswa_ids(db: Session, mata_kuliah_id: int) -> List[int]:
    rows = (
        db.query(PesertaMataKuliah.mahasiswa_id)
        .filter(PesertaMataKuliah.mata_kuliah_id == mata_kuliah_id)
        .all()
    )
    return [r.mahasiswa_id for r in rows]


# ---------------------------------------------------------------------------
# Helper: CPL IDs yang terkait dengan mata kuliah (lewat IK)
# ---------------------------------------------------------------------------

def _cpl_ids_for_mk(db: Session, mata_kuliah_id: int) -> List[int]:
    """Ambil CPL IDs yang terhubung ke mata kuliah lewat MKBentukPenilaian → IK → CPL."""
    mbp_ids = [
        mbp.id for mbp in
        db.query(MKBentukPenilaian.id)
        .filter(MKBentukPenilaian.mata_kuliah_id == mata_kuliah_id)
        .all()
    ]
    if not mbp_ids:
        return []

    ik_ids = [
        m.ik_id for m in
        db.query(MKBentukPenilaianIKMap.ik_id)
        .filter(MKBentukPenilaianIKMap.mk_bentuk_penilaian_id.in_(mbp_ids))
        .distinct()
        .all()
    ]
    if not ik_ids:
        return []

    cpl_ids = [
        ik.cpl_id for ik in
        db.query(IK.cpl_id)
        .filter(IK.id.in_(ik_ids), IK.cpl_id.isnot(None))
        .distinct()
        .all()
    ]
    return cpl_ids


# ---------------------------------------------------------------------------
# Agregasi CPL
# ---------------------------------------------------------------------------

def get_capaian_cpl_mata_kuliah(db: Session, mata_kuliah_id: int) -> List[Dict[str, Any]]:
    """
    Agregasi ketercapaian CPL riil per mata kuliah.

    Mengembalikan list of dict sesuai format CapaianItem AI Service:
    [
        {
            "kode": "CPL-1",
            "deskripsi": "...",
            "nilai_rata_rata": 72.5,
            "jumlah_mahasiswa": 35,
            "jumlah_tercapai": 28
        },
        ...
    ]
    """
    cpl_ids = _cpl_ids_for_mk(db, mata_kuliah_id)
    if not cpl_ids:
        return []

    mhs_ids = _mahasiswa_ids(db, mata_kuliah_id)
    if not mhs_ids:
        return []

    cpl_list = db.query(CPL).filter(CPL.id.in_(cpl_ids)).order_by(CPL.id).all()
    cpl_map = {c.id: c for c in cpl_list}

    # Ambil threshold per CPL (dari kolom threshold_capaian)
    rows = (
        db.query(
            CPLAchievement.cpl_id,
            func.avg(CPLAchievement.nilai).label("avg_nilai"),
            func.count(CPLAchievement.id).label("total_mhs"),
        )
        .filter(
            CPLAchievement.cpl_id.in_(cpl_ids),
            CPLAchievement.mahasiswa_id.in_(mhs_ids),
        )
        .group_by(CPLAchievement.cpl_id)
        .all()
    )

    if not rows:
        return []

    result = []
    for row in rows:
        cpl = cpl_map.get(row.cpl_id)
        if not cpl:
            continue
        threshold = float(cpl.threshold_capaian or 70.0)
        avg = round(float(row.avg_nilai or 0.0), 2)
        total = int(row.total_mhs or 0)

        # Hitung jumlah mahasiswa yang mencapai threshold secara eksplisit
        tercapai_rows = (
            db.query(func.count(CPLAchievement.id))
            .filter(
                CPLAchievement.cpl_id == row.cpl_id,
                CPLAchievement.mahasiswa_id.in_(mhs_ids),
                CPLAchievement.nilai >= threshold,
            )
            .scalar()
        )
        result.append({
            "kode": cpl.kode,
            "deskripsi": cpl.deskripsi or "",
            "nilai_rata_rata": avg,
            "jumlah_mahasiswa": total,
            "jumlah_tercapai": int(tercapai_rows or 0),
        })

    return result


# ---------------------------------------------------------------------------
# Agregasi CPMK (dengan bug cast diperbaiki)
# ---------------------------------------------------------------------------

def get_capaian_cpmk_mata_kuliah(db: Session, mata_kuliah_id: int) -> List[Dict[str, Any]]:
    """
    Agregasi ketercapaian CPMK riil per mata kuliah dari tabel cpmk_achievement.
    Bug lama: func.cast(..., func.integer()) → diganti case() yang valid di PostgreSQL.
    """
    cpmk_list = (
        db.query(CPMK)
        .filter(CPMK.mata_kuliah_id == mata_kuliah_id)
        .order_by(CPMK.id)
        .all()
    )
    if not cpmk_list:
        return []

    cpmk_ids = [c.id for c in cpmk_list]

    rows = (
        db.query(
            CPMKAchievement.cpmk_id,
            func.avg(CPMKAchievement.nilai).label("avg_nilai"),
            func.count(CPMKAchievement.id).label("total_mhs"),
            # FIX: ganti func.cast(..., func.integer()) → case() yang valid
            func.sum(
                case((CPMKAchievement.status_tercapai == 1, 1), else_=0)
            ).label("total_tercapai"),
        )
        .join(
            PesertaMataKuliah,
            PesertaMataKuliah.id == CPMKAchievement.peserta_mata_kuliah_id,
        )
        .filter(
            PesertaMataKuliah.mata_kuliah_id == mata_kuliah_id,
            CPMKAchievement.cpmk_id.in_(cpmk_ids),
        )
        .group_by(CPMKAchievement.cpmk_id)
        .all()
    )

    if not rows:
        return []

    stat_map = {
        row.cpmk_id: {
            "avg_nilai": float(row.avg_nilai or 0.0),
            "total_mhs": int(row.total_mhs or 0),
            "total_tercapai": int(row.total_tercapai or 0),
        }
        for row in rows
    }

    return [
        {
            "kode": cpmk.kode,
            "deskripsi": cpmk.deskripsi or "",
            "nilai_rata_rata": round(stat_map[cpmk.id]["avg_nilai"], 2),
            "jumlah_mahasiswa": stat_map[cpmk.id]["total_mhs"],
            "jumlah_tercapai": stat_map[cpmk.id]["total_tercapai"],
        }
        for cpmk in cpmk_list
        if cpmk.id in stat_map
    ]


# ---------------------------------------------------------------------------
# Fungsi utama yang dipanggil narasi.py — CPL dulu, lalu CPMK
# ---------------------------------------------------------------------------

def get_capaian_mata_kuliah(db: Session, mata_kuliah_id: int) -> List[Dict[str, Any]]:
    """
    Agregasi ketercapaian untuk dikirim ke AI Service.

    Urutan: CPL dulu (prioritas untuk analisis borang akreditasi), lalu CPMK
    sebagai detail pendukung. Jika salah satu kosong, hanya yang ada yang dikirim.
    Jika keduanya kosong, kembalikan [] sehingga narasi.py dapat menolak dengan 422.
    """
    cpl_data = get_capaian_cpl_mata_kuliah(db, mata_kuliah_id)
    cpmk_data = get_capaian_cpmk_mata_kuliah(db, mata_kuliah_id)

    combined = cpl_data + cpmk_data
    if combined:
        logger.info(
            "Capaian MK %d: %d CPL + %d CPMK dikirim ke AI.",
            mata_kuliah_id, len(cpl_data), len(cpmk_data),
        )
    return combined
