"""
Skala nilai huruf per versi kurikulum, dikelompokkan menurut rentang angkatan.

Contoh: angkatan 2024 ke atas memakai A/AB/B/BC/C/D/E, angkatan 2023 ke bawah
memakai A/B/C/D/E. Kelompok tanpa rentang (angkatan_min & angkatan_max kosong)
adalah skala bawaan untuk angkatan yang tidak masuk kelompok mana pun.
"""
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.skala_nilai import SkalaNilai


@dataclass
class KelompokSkala:
    angkatan_min: int | None
    angkatan_max: int | None
    # (huruf, batas_min) urut batas_min menurun
    skala: list[tuple[str, Decimal]] = field(default_factory=list)

    @property
    def bawaan(self) -> bool:
        return self.angkatan_min is None and self.angkatan_max is None

    def cocok(self, angkatan: int | None) -> bool:
        if self.bawaan or angkatan is None:
            return False
        if self.angkatan_min is not None and angkatan < self.angkatan_min:
            return False
        if self.angkatan_max is not None and angkatan > self.angkatan_max:
            return False
        return True

    @property
    def label(self) -> str:
        if self.bawaan:
            return "Semua angkatan (bawaan)"
        if self.angkatan_min is None:
            return f"Angkatan {self.angkatan_max} dan sebelumnya"
        if self.angkatan_max is None:
            return f"Angkatan {self.angkatan_min} dan sesudahnya"
        if self.angkatan_min == self.angkatan_max:
            return f"Angkatan {self.angkatan_min}"
        return f"Angkatan {self.angkatan_min}–{self.angkatan_max}"


def muat_kelompok(db: Session, kurikulum_version_id: int | None) -> list[KelompokSkala]:
    """Kelompok skala sebuah kurikulum: kelompok khusus angkatan dulu, bawaan terakhir."""
    if not kurikulum_version_id:
        return []
    rows = (
        db.query(SkalaNilai)
        .filter(SkalaNilai.kurikulum_version_id == kurikulum_version_id)
        .order_by(SkalaNilai.batas_min.desc())
        .all()
    )
    kelompok: dict[tuple, KelompokSkala] = {}
    for r in rows:
        kunci = (r.angkatan_min, r.angkatan_max)
        if kunci not in kelompok:
            kelompok[kunci] = KelompokSkala(r.angkatan_min, r.angkatan_max)
        kelompok[kunci].skala.append((r.huruf, Decimal(str(r.batas_min))))
    return sorted(
        kelompok.values(),
        key=lambda k: (k.bawaan, -(k.angkatan_max or k.angkatan_min or 0)),
    )


def pilih_kelompok(kelompok: list[KelompokSkala], angkatan: int | None) -> KelompokSkala | None:
    """Kelompok yang rentangnya memuat angkatan; bila tidak ada, skala bawaan."""
    for k in kelompok:
        if k.cocok(angkatan):
            return k
    return next((k for k in kelompok if k.bawaan), None)


def skala_untuk_angkatan(kelompok: list[KelompokSkala], angkatan: int | None) -> list[tuple[str, Decimal]]:
    k = pilih_kelompok(kelompok, angkatan)
    return k.skala if k else []


def validasi_kelompok(kelompok: list[KelompokSkala]) -> list[str]:
    """Pesan kesalahan untuk daftar kelompok yang akan disimpan (kosong = valid)."""
    errors: list[str] = []
    if not kelompok:
        return ["Minimal harus ada satu kelompok skala"]
    if sum(1 for k in kelompok if k.bawaan) > 1:
        errors.append("Hanya boleh ada satu skala bawaan (tanpa rentang angkatan)")

    for k in kelompok:
        nama = k.label
        if k.angkatan_min is not None and k.angkatan_max is not None and k.angkatan_min > k.angkatan_max:
            errors.append(f"{nama}: angkatan awal lebih besar dari angkatan akhir")
        if not k.skala:
            errors.append(f"{nama}: skala tidak boleh kosong")
            continue
        batas = [b for _, b in k.skala]
        huruf = [h.strip().upper() for h, _ in k.skala]
        if not any(b == 0 for b in batas):
            errors.append(f"{nama}: wajib ada huruf dengan batas minimal 0")
        if len(batas) != len(set(batas)):
            errors.append(f"{nama}: batas minimal tidak boleh kembar")
        if len(huruf) != len(set(huruf)):
            errors.append(f"{nama}: huruf tidak boleh kembar")
        if any(not h for h in huruf):
            errors.append(f"{nama}: huruf tidak boleh kosong")
        if any(b < 0 or b > 100 for b in batas):
            errors.append(f"{nama}: batas minimal harus 0-100")

    khusus = [k for k in kelompok if not k.bawaan]
    for i, a in enumerate(khusus):
        for b in khusus[i + 1:]:
            a_lo, a_hi = a.angkatan_min or -10**6, a.angkatan_max or 10**6
            b_lo, b_hi = b.angkatan_min or -10**6, b.angkatan_max or 10**6
            if a_lo <= b_hi and b_lo <= a_hi:
                errors.append(f"Rentang angkatan tumpang tindih: {a.label} dan {b.label}")
    return errors
