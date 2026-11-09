"""
Data Portofolio mata kuliah: nilai CP per mahasiswa, ringkasan capaian CPMK/CPL,
dan sebaran nilai akhir. Semua dihitung dari hasil kalkulasi OBE yang sudah tersimpan.
"""
import statistics

from sqlalchemy.orm import Session

from app.models.cpl import CPL
from app.models.cpl_achievement import CPLAchievement
from app.models.cpmk import CPMK
from app.models.cpmk_achievement import CPMKAchievement
from app.models.hasil_evaluasi import HasilEvaluasi
from app.models.mahasiswa import Mahasiswa
from app.models.mata_kuliah import MataKuliah
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.portofolio import EvaluasiCPMK
from app.services.portofolio_aturan import AturanPortofolio, ambang_prodi
from app.services.skala_nilai import muat_kelompok

URUTAN_HURUF_UMUM = ["A", "AB", "B", "BC", "C", "CD", "D", "DE", "E"]


def _f(val) -> float | None:
    return None if val is None else round(float(val), 2)


def _enum_val(val) -> str | None:
    if val is None:
        return None
    return str(getattr(val, "value", val))


def _ringkas(nilai: list[float], ambang: float) -> dict:
    if not nilai:
        return {"rata_rata": None, "jumlah_dinilai": 0, "jumlah_tercapai": 0, "persen_tercapai": None}
    tercapai = sum(1 for v in nilai if v >= ambang)
    return {
        "rata_rata": round(sum(nilai) / len(nilai), 2),
        "jumlah_dinilai": len(nilai),
        "jumlah_tercapai": tercapai,
        "persen_tercapai": round(tercapai / len(nilai) * 100, 2),
    }


def urutan_huruf_kurikulum(db: Session, kurikulum_version_id: int | None) -> list[str]:
    """Semua huruf dari seluruh kelompok skala angkatan, urut batas minimal tertinggi."""
    batas_tertinggi: dict[str, float] = {}
    for k in muat_kelompok(db, kurikulum_version_id):
        for huruf, batas in k.skala:
            batas_tertinggi[huruf] = max(batas_tertinggi.get(huruf, -1.0), float(batas))
    return sorted(batas_tertinggi, key=lambda h: -batas_tertinggi[h])


def _urutan_huruf(db: Session, mk: MataKuliah, huruf_terpakai: set[str]) -> list[str]:
    skala = urutan_huruf_kurikulum(db, mk.kurikulum_version_id)
    urutan = skala or list(URUTAN_HURUF_UMUM)
    sisa = sorted(h for h in huruf_terpakai if h not in urutan)
    if skala:
        return urutan + sisa
    # Tanpa skala nilai: tampilkan huruf standar yang dipakai saja, plus huruf lain.
    return [h for h in urutan if h in huruf_terpakai] + sisa


def capaian_mata_kuliah(db: Session, mk: MataKuliah) -> dict:
    peserta = (
        db.query(PesertaMataKuliah, Mahasiswa)
        .join(Mahasiswa, Mahasiswa.id == PesertaMataKuliah.mahasiswa_id)
        .filter(PesertaMataKuliah.mata_kuliah_id == mk.id)
        .order_by(Mahasiswa.nim)
        .all()
    )
    peserta_ids = [p.id for p, _ in peserta]
    mahasiswa_ids = [m.id for _, m in peserta]

    cpmk_list = db.query(CPMK).filter(CPMK.mata_kuliah_id == mk.id).order_by(CPMK.kode).all()
    ambang_cpmk = float(ambang_prodi(db, mk.program_studi_id))

    cpmk_ach: dict[int, dict[int, CPMKAchievement]] = {}
    if peserta_ids:
        for a in (
            db.query(CPMKAchievement)
            .filter(CPMKAchievement.peserta_mata_kuliah_id.in_(peserta_ids))
            .order_by(CPMKAchievement.id)
            .all()
        ):
            cpmk_ach.setdefault(a.peserta_mata_kuliah_id, {})[a.cpmk_id] = a

    cpl_ach: dict[int, dict[int, CPLAchievement]] = {}
    if mahasiswa_ids:
        for a in (
            db.query(CPLAchievement)
            .filter(
                CPLAchievement.mata_kuliah_id == mk.id,
                CPLAchievement.mahasiswa_id.in_(mahasiswa_ids),
            )
            .order_by(CPLAchievement.id)
            .all()
        ):
            cpl_ach.setdefault(a.mahasiswa_id, {})[a.cpl_id] = a

    cpl_ids = sorted({cid for per_mhs in cpl_ach.values() for cid in per_mhs})
    cpl_list = db.query(CPL).filter(CPL.id.in_(cpl_ids)).order_by(CPL.kode).all() if cpl_ids else []

    hasil = {}
    if peserta_ids:
        hasil = {
            h.peserta_mata_kuliah_id: h
            for h in db.query(HasilEvaluasi).filter(HasilEvaluasi.peserta_mata_kuliah_id.in_(peserta_ids)).all()
        }

    baris = []
    for p, m in peserta:
        h = hasil.get(p.id)
        baris.append({
            "peserta_id": p.id,
            "mahasiswa_id": m.id,
            "nim": m.nim,
            "nama": m.nama,
            "kelas": p.kelas,
            "angkatan": m.angkatan,
            "cpmk": {str(cid): _f(a.nilai) for cid, a in cpmk_ach.get(p.id, {}).items()},
            "cpl": {str(cid): _f(a.nilai) for cid, a in cpl_ach.get(m.id, {}).items()},
            "nilai_akhir": _f(h.nilai_akhir) if h else None,
            "nilai_huruf": h.nilai_huruf if h else None,
            "status_outcome": _enum_val(h.status_outcome) if h else None,
            "is_final": bool(h.is_final) if h else False,
        })

    ringkasan_cpmk = []
    for c in cpmk_list:
        nilai = [float(per[c.id].nilai) for per in cpmk_ach.values() if c.id in per]
        ringkasan_cpmk.append({
            "id": c.id, "kode": c.kode, "deskripsi": c.deskripsi, "bobot": _f(c.bobot),
            "ambang": ambang_cpmk, **_ringkas(nilai, ambang_cpmk),
        })

    ringkasan_cpl = []
    for c in cpl_list:
        ambang = float(c.threshold_capaian or 70)
        nilai = [float(per[c.id].nilai) for per in cpl_ach.values() if c.id in per]
        ringkasan_cpl.append({
            "id": c.id, "kode": c.kode, "deskripsi": c.deskripsi,
            "ambang": ambang, **_ringkas(nilai, ambang),
        })

    nilai_akhir = [r["nilai_akhir"] for r in baris if r["nilai_akhir"] is not None]
    huruf_count: dict[str, int] = {}
    for r in baris:
        if r["nilai_huruf"]:
            huruf_count[r["nilai_huruf"]] = huruf_count.get(r["nilai_huruf"], 0) + 1

    rentang = []
    for i in range(10):
        bawah, atas = i * 10, i * 10 + 10
        jumlah = sum(1 for v in nilai_akhir if (bawah <= v < atas) or (i == 9 and v == 100))
        rentang.append({"label": f"{bawah}–{atas}", "bawah": bawah, "atas": atas, "jumlah": jumlah})

    statistik = None
    if nilai_akhir:
        statistik = {
            "n": len(nilai_akhir),
            "rata_rata": round(statistics.fmean(nilai_akhir), 2),
            "median": round(statistics.median(nilai_akhir), 2),
            "minimum": min(nilai_akhir),
            "maksimum": max(nilai_akhir),
            "simpangan_baku": round(statistics.pstdev(nilai_akhir), 2),
            "jumlah_lulus": sum(1 for r in baris if r["status_outcome"] == "Tercapai"),
        }

    return {
        "mata_kuliah": {
            "id": mk.id, "kode": mk.kode, "nama": mk.nama, "sks": mk.sks,
            "semester": _enum_val(mk.semester), "tahun_ajaran": mk.tahun_ajaran,
        },
        "jumlah_peserta": len(peserta),
        "jumlah_dinilai": len(nilai_akhir),
        "cpmk": ringkasan_cpmk,
        "cpl": ringkasan_cpl,
        "mahasiswa": baris,
        "sebaran": {
            "huruf": [
                {"huruf": h, "jumlah": huruf_count.get(h, 0)}
                for h in _urutan_huruf(db, mk, set(huruf_count))
            ],
            "rentang": rentang,
            "statistik": statistik,
        },
    }


def evaluasi_cpmk(db: Session, mk: MataKuliah, aturan: AturanPortofolio, capaian: dict | None = None) -> dict:
    """
    Data sheet Evaluasi Pemenuhan CPMK: statistik tiap CPMK terhadap target prodi
    plus teks analisis & rencana perbaikan yang sudah disimpan dosen.
    """
    capaian = capaian or capaian_mata_kuliah(db, mk)
    tersimpan = {
        e.cpmk_id: e
        for e in db.query(EvaluasiCPMK).filter(EvaluasiCPMK.mata_kuliah_id == mk.id).all()
    }
    items = []
    for c in capaian["cpmk"]:
        nilai = [
            float(m["cpmk"][str(c["id"])])
            for m in capaian["mahasiswa"]
            if m["cpmk"].get(str(c["id"])) is not None
        ]
        n = len(nilai)
        tercapai = sum(1 for v in nilai if v >= aturan.ambang_cpmk)
        rata = round(sum(nilai) / n, 2) if n else None
        rerata_skala = round(sum(aturan.skor(v) for v in nilai) / n, 2) if n else None
        persen = round(tercapai / n * 100, 2) if n else None
        memenuhi = bool(
            n
            and persen >= aturan.target_persen
            and (rerata_skala is None or rerata_skala >= aturan.target_rerata_skala)
        )
        simpan = tersimpan.get(c["id"])
        items.append({
            "cpmk_id": c["id"],
            "kode": c["kode"],
            "deskripsi": c["deskripsi"],
            "jumlah_dinilai": n,
            "jumlah_tercapai": tercapai,
            "rata_rata": rata,
            "rerata_skala": rerata_skala,
            "persen_tercapai": persen,
            "memenuhi": memenuhi if n else None,
            "analisis": simpan.analisis if simpan else None,
            "rencana_perbaikan": simpan.rencana_perbaikan if simpan else None,
            "updated_at": simpan.updated_at if simpan else None,
        })
    return {
        "ambang_cpmk": aturan.ambang_cpmk,
        "target_rerata_skala": aturan.target_rerata_skala,
        "target_persen": aturan.target_persen,
        "skala_maks": aturan.skor_maks,
        "rubrik": [{"nama": t.nama, "batas_bawah": t.batas_bawah, "skor": t.skor} for t in aturan.rubrik],
        "items": items,
    }
