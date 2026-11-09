"""
Penggabungan capaian CPL lintas mata kuliah.

Capaian CPL mahasiswa = rata-rata capaian CPL per mata kuliah, dibobot dengan
bobot IK yang mengacu ke CPL itu pada masing-masing mata kuliah (bobot_cp):

    capaian_cpl = Σ(persen_cpl_mk × bobot_cp_mk) / Σ bobot_cp_mk

Dibulatkan 2 desimal ROUND_HALF_UP. Baris lama tanpa mata kuliah (mata_kuliah_id
NULL) hanya dipakai jika belum ada satu pun baris per mata kuliah untuk pasangan
(mahasiswa, CPL) tersebut.
"""
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable

TWOPLACES = Decimal("0.01")


@dataclass
class CPLGabungan:
    mahasiswa_id: int
    cpl_id: int
    nilai: Decimal
    angkatan: int | None
    jumlah_mata_kuliah: int


def _dec(val) -> Decimal:
    return val if isinstance(val, Decimal) else Decimal(str(val))


def gabung_capaian_cpl(rows: Iterable) -> dict[tuple[int, int], CPLGabungan]:
    """rows: objek CPLAchievement. Hasil dikunci (mahasiswa_id, cpl_id)."""
    per_mk: dict[tuple[int, int], list] = {}
    legacy: dict[tuple[int, int], list] = {}
    for r in rows:
        key = (r.mahasiswa_id, r.cpl_id)
        if r.mata_kuliah_id is not None and r.bobot_cp is not None and _dec(r.bobot_cp) > 0:
            per_mk.setdefault(key, []).append(r)
        elif r.mata_kuliah_id is None:
            legacy.setdefault(key, []).append(r)

    hasil: dict[tuple[int, int], CPLGabungan] = {}
    for key in set(per_mk) | set(legacy):
        angkatan = next((r.angkatan for r in per_mk.get(key, []) + legacy.get(key, []) if r.angkatan is not None), None)
        items = per_mk.get(key)
        if items:
            total_bobot = sum(_dec(r.bobot_cp) for r in items)
            total = sum(_dec(r.nilai) * _dec(r.bobot_cp) for r in items)
            nilai = (total / total_bobot).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            jumlah_mk = len({r.mata_kuliah_id for r in items})
        else:
            lama = legacy[key]
            nilai = _dec(lama[-1].nilai).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            jumlah_mk = 0
        hasil[key] = CPLGabungan(key[0], key[1], nilai, angkatan, jumlah_mk)
    return hasil
