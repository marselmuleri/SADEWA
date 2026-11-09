"""
Aturan penilaian per prodi (ambang, target Evaluasi CPMK, rubrik skala, GPM).

Sumber:
- tabel aturan_penilaian_prodi (diatur Admin Prodi / Kaprodi di menu Aturan Penilaian);
  bila belum diisi, dipakai nilai bawaan di bawah.
- rubrik skala 1-n diambil dari tabel Range Nilai CPL prodi; bila kosong, dipakai
  rubrik bawaan OBELISK (Pemula/Berkembang/Mahir/Teladan).
"""
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.aturan_penilaian import AturanPenilaianProdi
from app.models.range_nilai_cpl import RangeNilaiCPL

AMBANG_CPMK = 70.0          # nilai minimal CPMK tercapai & nilai akhir lulus (0-100)
TARGET_RERATA_SKALA = 2.6   # target rata-rata kelas pada skala rubrik
TARGET_PERSEN = 60.0        # target % mahasiswa yang nilainya >= ambang

RUBRIK_BAWAAN = [
    ("Pemula", 0.0),
    ("Berkembang", 60.0),
    ("Mahir", 70.0),
    ("Teladan", 80.0),
]


@dataclass
class TingkatRubrik:
    nama: str
    batas_bawah: float
    skor: int


@dataclass
class AturanPortofolio:
    ambang_cpmk: float = AMBANG_CPMK
    target_rerata_skala: float = TARGET_RERATA_SKALA
    target_persen: float = TARGET_PERSEN
    rubrik: list[TingkatRubrik] = field(default_factory=list)
    rubrik_bawaan: bool = True
    gpm_nama: str | None = None
    gpm_nip: str | None = None
    tersimpan: bool = False

    @property
    def skor_maks(self) -> int:
        return self.rubrik[-1].skor if self.rubrik else 0

    def skor(self, nilai: float | None) -> int | None:
        """Ubah nilai 0-100 menjadi skor rubrik (1..n)."""
        if nilai is None or not self.rubrik:
            return None
        hasil = self.rubrik[0].skor
        for t in self.rubrik:
            if nilai >= t.batas_bawah:
                hasil = t.skor
        return hasil

    def tingkat(self, nilai: float | None) -> str | None:
        s = self.skor(nilai)
        return None if s is None else self.rubrik[s - 1].nama


def _baris_aturan(db: Session, program_studi_id: int | None) -> AturanPenilaianProdi | None:
    if not program_studi_id:
        return None
    return db.query(AturanPenilaianProdi).filter(AturanPenilaianProdi.program_studi_id == program_studi_id).first()


def ambang_prodi(db: Session, program_studi_id: int | None) -> Decimal:
    """Ambang tercapai/lulus (0-100) prodi, untuk mesin kalkulasi & analitik."""
    baris = _baris_aturan(db, program_studi_id)
    return Decimal(str(baris.ambang)) if baris else Decimal(str(AMBANG_CPMK))


def aturan_prodi(db: Session, program_studi_id: int | None) -> AturanPortofolio:
    baris = _baris_aturan(db, program_studi_id)
    ranges = []
    if program_studi_id:
        ranges = (
            db.query(RangeNilaiCPL)
            .filter(RangeNilaiCPL.program_studi_id == program_studi_id)
            .order_by(RangeNilaiCPL.batas_bawah)
            .all()
        )
    sumber = [(r.nama, float(r.batas_bawah)) for r in ranges] or RUBRIK_BAWAAN
    rubrik = [TingkatRubrik(nama=n, batas_bawah=b, skor=i + 1) for i, (n, b) in enumerate(sumber)]
    # Tingkat terendah selalu mulai dari 0 agar setiap nilai punya skor.
    rubrik[0].batas_bawah = 0.0
    aturan = AturanPortofolio(rubrik=rubrik, rubrik_bawaan=not ranges)
    if baris:
        aturan.ambang_cpmk = float(baris.ambang)
        aturan.target_rerata_skala = float(baris.target_rerata_skala)
        aturan.target_persen = float(baris.target_persen)
        aturan.gpm_nama = baris.gpm_nama
        aturan.gpm_nip = baris.gpm_nip
        aturan.tersimpan = True
    return aturan
