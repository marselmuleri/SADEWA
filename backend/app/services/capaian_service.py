"""
Service untuk mengagregasi data ketercapaian CPMK dan CPL riil dari database.

Sesuai PRD SADEWA:
Angka ketercapaian dihitung secara deterministik dari database dan diteruskan
ke AI Service agar LLM tidak menebak atau mengarang angka.
Jika belum ada data nilai/kalkulasi, service mengembalikan list kosong sehingga
route handler dapat menolak request dengan HTTP 422.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.cpmk import CPMK
from app.models.cpmk_achievement import CPMKAchievement
from app.models.peserta_mata_kuliah import PesertaMataKuliah

logger = logging.getLogger(__name__)


def get_capaian_mata_kuliah(db: Session, mata_kuliah_id: int) -> List[Dict[str, Any]]:
    """
    Agregasi ketercapaian CPMK riil per mata kuliah dari tabel cpmk_achievement.

    Mengembalikan list of dict sesuai format CapaianItem yang diharapkan AI Service:
    [
        {
            "kode": "CPMK-1",
            "deskripsi": "...",
            "nilai_rata_rata": 78.5,
            "jumlah_mahasiswa": 35,
            "jumlah_tercapai": 30
        },
        ...
    ]
    Jika belum ada data penilaian/kalkulasi, mengembalikan list kosong ([]).
    """
    # Ambil semua CPMK milik mata kuliah ini
    cpmk_list = db.query(CPMK).filter(CPMK.mata_kuliah_id == mata_kuliah_id).order_by(CPMK.id).all()
    if not cpmk_list:
        return []

    cpmk_ids = [c.id for c in cpmk_list]

    # Query agregat nilai rata-rata, jumlah mahasiswa, dan jumlah tercapai dari CPMKAchievement
    rows = (
        db.query(
            CPMKAchievement.cpmk_id,
            func.avg(CPMKAchievement.nilai).label("avg_nilai"),
            func.count(CPMKAchievement.id).label("total_mhs"),
            func.sum(
                func.cast(CPMKAchievement.status_tercapai == 1, func.integer())
            ).label("total_tercapai"),
        )
        .join(PesertaMataKuliah, PesertaMataKuliah.id == CPMKAchievement.peserta_mata_kuliah_id)
        .filter(
            PesertaMataKuliah.mata_kuliah_id == mata_kuliah_id,
            CPMKAchievement.cpmk_id.in_(cpmk_ids),
        )
        .group_by(CPMKAchievement.cpmk_id)
        .all()
    )

    if not rows:
        return []

    # Map hasil agregat per CPMK ID
    stat_map = {}
    for row in rows:
        stat_map[row.cpmk_id] = {
            "avg_nilai": float(row.avg_nilai or 0.0),
            "total_mhs": int(row.total_mhs or 0),
            "total_tercapai": int(row.total_tercapai or 0),
        }

    capaian_items = []
    for cpmk in cpmk_list:
        if cpmk.id in stat_map:
            st = stat_map[cpmk.id]
            capaian_items.append({
                "kode": cpmk.kode,
                "deskripsi": cpmk.deskripsi or "",
                "nilai_rata_rata": round(st["avg_nilai"], 2),
                "jumlah_mahasiswa": st["total_mhs"],
                "jumlah_tercapai": st["total_tercapai"],
            })

    return capaian_items

