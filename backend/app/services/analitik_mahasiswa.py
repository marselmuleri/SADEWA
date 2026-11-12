"""
Analitik OBE per mahasiswa.

Cakupan ditentukan oleh daftar mata kuliah (mk_ids):
  - Dosen   : mata kuliah yang diampu (opsional dipersempit ke satu MK).
  - Kaprodi : seluruh mata kuliah prodi (opsional dipersempit ke satu MK).
  - Dekan   : seluruh mata kuliah prodi terpilih di fakultasnya.

Semua angka (CPL, IK, CPMK, nilai akhir) hanya dihitung dari mata kuliah dalam cakupan,
sehingga Dosen tidak pernah melihat capaian dari mata kuliah yang tidak diampunya.
"""
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.cpl import CPL
from app.models.cpl_achievement import CPLAchievement
from app.models.cpmk import CPMK
from app.models.cpmk_achievement import CPMKAchievement
from app.models.hasil_evaluasi import HasilEvaluasi
from app.models.ik import IK
from app.models.ik_achievement import IKAchievement
from app.models.mahasiswa import Mahasiswa
from app.models.mata_kuliah import MataKuliah
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.services.analitik import bobot_ik_per_mk
from app.services.calculation.cpl_aggregate import gabung_capaian_cpl
from app.services.calculation.obe_formula import persen_ik
from app.services.portofolio_aturan import ambang_prodi


def _f(val) -> float | None:
    return None if val is None else round(float(val), 2)


def _mean(values) -> Decimal | None:
    values = list(values)
    return sum(values) / len(values) if values else None


def _cpl_rows(
    db: Session, mk_ids: list[int], mahasiswa_ids, *, prodi_id: int | None, include_legacy: bool,
    kurikulum_id: int | None = None,
):
    """
    Baris CPLAchievement dalam cakupan. Baris lama tanpa MK hanya untuk cakupan seluruh prodi.
    kurikulum_id: bila diisi, hanya CPL dari versi kurikulum tersebut (kurikulum aktif prodi).
    """
    if not mahasiswa_ids:
        return []
    q = db.query(CPLAchievement).filter(CPLAchievement.mahasiswa_id.in_(list(mahasiswa_ids)))
    if include_legacy and prodi_id:
        q = q.join(CPL, CPL.id == CPLAchievement.cpl_id).filter(
            CPL.program_studi_id == prodi_id,
            or_(CPLAchievement.mata_kuliah_id.in_(mk_ids or [-1]), CPLAchievement.mata_kuliah_id.is_(None)),
        )
        if kurikulum_id:
            q = q.filter(CPL.kurikulum_version_id == kurikulum_id)
    else:
        q = q.filter(CPLAchievement.mata_kuliah_id.in_(mk_ids or [-1]))
        if kurikulum_id:
            q = q.join(CPL, CPL.id == CPLAchievement.cpl_id).filter(CPL.kurikulum_version_id == kurikulum_id)
    return q.all()


def _threshold_cpl(db: Session, cpl_ids) -> dict[int, CPL]:
    return {c.id: c for c in db.query(CPL).filter(CPL.id.in_(list(cpl_ids))).all()} if cpl_ids else {}


def daftar_mahasiswa(
    db: Session,
    *,
    mk_ids: list[int],
    prodi_id: int | None,
    prodi_penuh: bool,
    kurikulum_id: int | None = None,
    angkatan: int | None = None,
    search: str | None = None,
) -> dict:
    """
    Ringkasan capaian setiap mahasiswa dalam cakupan.
    prodi_penuh=True: semua mahasiswa aktif prodi (termasuk yang belum punya capaian).
    prodi_penuh=False: hanya peserta mata kuliah dalam cakupan.
    """
    if prodi_penuh:
        q = db.query(Mahasiswa).filter(Mahasiswa.is_active.is_(True), Mahasiswa.program_studi_id == prodi_id)
    else:
        q = (
            db.query(Mahasiswa)
            .join(PesertaMataKuliah, PesertaMataKuliah.mahasiswa_id == Mahasiswa.id)
            .filter(Mahasiswa.is_active.is_(True), PesertaMataKuliah.mata_kuliah_id.in_(mk_ids or [-1]))
            .distinct()
        )
    if angkatan:
        q = q.filter(Mahasiswa.angkatan == angkatan)
    if search:
        pola = f"%{search.strip()}%"
        q = q.filter(or_(Mahasiswa.nama.ilike(pola), Mahasiswa.nim.ilike(pola)))
    mahasiswa = q.order_by(Mahasiswa.nim).all()
    ids = [m.id for m in mahasiswa]

    # Mata kuliah yang diikuti dalam cakupan
    mk_per_mhs: dict[int, set[int]] = defaultdict(set)
    peserta_mhs: dict[int, int] = {}
    if ids:
        for p in db.query(PesertaMataKuliah).filter(
            PesertaMataKuliah.mahasiswa_id.in_(ids), PesertaMataKuliah.mata_kuliah_id.in_(mk_ids or [-1])
        ).all():
            mk_per_mhs[p.mahasiswa_id].add(p.mata_kuliah_id)
            peserta_mhs[p.id] = p.mahasiswa_id

    # CPL gabungan (lintas MK dalam cakupan)
    rows = _cpl_rows(db, mk_ids, ids, prodi_id=prodi_id, include_legacy=prodi_penuh, kurikulum_id=kurikulum_id)
    cpl_map = _threshold_cpl(db, {r.cpl_id for r in rows})
    cpl_per_mhs: dict[int, list[tuple[Decimal, Decimal]]] = defaultdict(list)
    for g in gabung_capaian_cpl(rows).values():
        cpl = cpl_map.get(g.cpl_id)
        th = Decimal(str(cpl.threshold_capaian or 70)) if cpl else Decimal("70")
        cpl_per_mhs[g.mahasiswa_id].append((g.nilai, th))

    # CPMK
    ambang = ambang_prodi(db, prodi_id)
    cpmk_per_mhs: dict[int, list[Decimal]] = defaultdict(list)
    if peserta_mhs:
        for peserta_id, nilai in db.query(CPMKAchievement.peserta_mata_kuliah_id, CPMKAchievement.nilai).filter(
            CPMKAchievement.peserta_mata_kuliah_id.in_(list(peserta_mhs))
        ).all():
            cpmk_per_mhs[peserta_mhs[peserta_id]].append(Decimal(str(nilai)))

    # Nilai akhir
    nilai_akhir: dict[int, list[Decimal]] = defaultdict(list)
    if peserta_mhs:
        for peserta_id, na in db.query(HasilEvaluasi.peserta_mata_kuliah_id, HasilEvaluasi.nilai_akhir).filter(
            HasilEvaluasi.peserta_mata_kuliah_id.in_(list(peserta_mhs))
        ).all():
            if na is not None:
                nilai_akhir[peserta_mhs[peserta_id]].append(Decimal(str(na)))

    hasil = []
    for m in mahasiswa:
        cpl = cpl_per_mhs.get(m.id, [])
        cpmk = cpmk_per_mhs.get(m.id, [])
        hasil.append({
            "mahasiswa_id": m.id,
            "nim": m.nim,
            "nama": m.nama,
            "angkatan": m.angkatan,
            "status_akademik": m.status_akademik,
            "jumlah_mk": len(mk_per_mhs.get(m.id, ())),
            "rata_rata_cpl": _f(_mean(n for n, _ in cpl)),
            "jumlah_cpl": len(cpl),
            "cpl_tercapai": sum(1 for n, th in cpl if n >= th),
            "rata_rata_cpmk": _f(_mean(cpmk)),
            "jumlah_cpmk": len(cpmk),
            "cpmk_tercapai": sum(1 for v in cpmk if v >= ambang),
            "rata_rata_nilai_akhir": _f(_mean(nilai_akhir.get(m.id, []))),
        })
    return {"ambang_cpmk": _f(ambang), "mahasiswa": hasil}


def analitik_mahasiswa(
    db: Session,
    mhs: Mahasiswa,
    *,
    mk_ids: list[int],
    prodi_id: int | None,
    prodi_penuh: bool,
    kurikulum_id: int | None = None,
) -> dict:
    """
    Detail capaian satu mahasiswa dalam cakupan, beserta pembanding:
      - CPL: rata-rata mahasiswa seangkatan dalam cakupan yang sama.
      - IK & CPMK: rata-rata peserta lain pada mata kuliah yang sama.
    """
    pesertas = (
        db.query(PesertaMataKuliah)
        .filter(PesertaMataKuliah.mahasiswa_id == mhs.id, PesertaMataKuliah.mata_kuliah_id.in_(mk_ids or [-1]))
        .all()
    )
    mk_diikuti = sorted({p.mata_kuliah_id for p in pesertas})
    mk_map = {m.id: m for m in db.query(MataKuliah).filter(MataKuliah.id.in_(mk_diikuti or [-1])).all()}
    ambang = ambang_prodi(db, prodi_id or mhs.program_studi_id)

    # --- Mata kuliah & nilai akhir ----------------------------------------------------
    hasil_map = {
        h.peserta_mata_kuliah_id: h
        for h in db.query(HasilEvaluasi).filter(HasilEvaluasi.peserta_mata_kuliah_id.in_([p.id for p in pesertas] or [-1])).all()
    }
    mata_kuliah = []
    for p in sorted(pesertas, key=lambda p: mk_map[p.mata_kuliah_id].kode if p.mata_kuliah_id in mk_map else ""):
        mk = mk_map.get(p.mata_kuliah_id)
        if not mk:
            continue
        h = hasil_map.get(p.id)
        mata_kuliah.append({
            "mk_id": mk.id, "kode": mk.kode, "nama": mk.nama, "sks": mk.sks,
            "semester": getattr(mk.semester, "value", mk.semester), "tahun_ajaran": mk.tahun_ajaran,
            "kelas": p.kelas,
            "nilai_akhir": _f(h.nilai_akhir) if h else None,
            "nilai_huruf": h.nilai_huruf if h else None,
            "status_outcome": getattr(h.status_outcome, "value", h.status_outcome) if h else None,
        })

    # --- CPL: nilai mahasiswa vs rata-rata seangkatan ---------------------------------
    rows_mhs = _cpl_rows(db, mk_diikuti, [mhs.id], prodi_id=prodi_id, include_legacy=prodi_penuh, kurikulum_id=kurikulum_id)
    gab_mhs = gabung_capaian_cpl(rows_mhs)
    cpl_ids = {g.cpl_id for g in gab_mhs.values()}
    cpl_map = _threshold_cpl(db, cpl_ids)

    pembanding_angkatan: dict[int, list[Decimal]] = defaultdict(list)
    if cpl_ids:
        kohort_q = db.query(Mahasiswa.id).filter(Mahasiswa.is_active.is_(True))
        if mhs.angkatan is not None:
            kohort_q = kohort_q.filter(Mahasiswa.angkatan == mhs.angkatan)
        if prodi_penuh:
            kohort_q = kohort_q.filter(Mahasiswa.program_studi_id == mhs.program_studi_id)
        else:
            kohort_q = kohort_q.join(PesertaMataKuliah, PesertaMataKuliah.mahasiswa_id == Mahasiswa.id).filter(
                PesertaMataKuliah.mata_kuliah_id.in_(mk_ids or [-1])
            ).distinct()
        kohort_ids = [r[0] for r in kohort_q.all()]
        rows_kohort = [
            r for r in _cpl_rows(db, mk_ids, kohort_ids, prodi_id=prodi_id, include_legacy=prodi_penuh, kurikulum_id=kurikulum_id)
            if r.cpl_id in cpl_ids
        ]
        for g in gabung_capaian_cpl(rows_kohort).values():
            pembanding_angkatan[g.cpl_id].append(g.nilai)

    per_mk_cpl: dict[int, list[dict]] = defaultdict(list)
    for r in rows_mhs:
        if r.mata_kuliah_id is not None:
            per_mk_cpl[r.cpl_id].append({"mk_id": r.mata_kuliah_id, "nilai": _f(r.nilai), "bobot_cp": _f(r.bobot_cp)})

    cpl_out = []
    for (_mid, cpl_id), g in sorted(gab_mhs.items(), key=lambda kv: cpl_map[kv[0][1]].kode if kv[0][1] in cpl_map else ""):
        cpl = cpl_map.get(cpl_id)
        th = Decimal(str(cpl.threshold_capaian or 70)) if cpl else Decimal("70")
        kohort = pembanding_angkatan.get(cpl_id, [])
        cpl_out.append({
            "cpl_id": cpl_id,
            "kode": cpl.kode if cpl else "-",
            "deskripsi": cpl.deskripsi if cpl else None,
            "threshold": _f(th),
            "nilai": _f(g.nilai),
            "tercapai": g.nilai >= th,
            "jumlah_mk": g.jumlah_mata_kuliah,
            "rata_rata_angkatan": _f(_mean(kohort)),
            "jumlah_angkatan": len(kohort),
            "peringkat_angkatan": (sum(1 for v in kohort if v > g.nilai) + 1) if kohort else None,
            "per_mk": sorted(per_mk_cpl.get(cpl_id, []), key=lambda x: x["mk_id"]),
        })

    # --- IK per mata kuliah (persen) vs rata-rata kelas -------------------------------
    bobot_mk_ik = bobot_ik_per_mk(db, mk_diikuti)
    ik_kelas: dict[tuple[int, int], list[Decimal]] = defaultdict(list)
    ik_mhs: dict[tuple[int, int], Decimal] = {}
    if mk_diikuti:
        for a in db.query(IKAchievement).filter(IKAchievement.mata_kuliah_id.in_(mk_diikuti)).all():
            bobot = bobot_mk_ik.get((a.mata_kuliah_id, a.ik_id))
            if not bobot or bobot <= 0:
                continue
            persen = persen_ik(a.nilai, bobot)
            ik_kelas[(a.ik_id, a.mata_kuliah_id)].append(persen)
            if a.mahasiswa_id == mhs.id:
                ik_mhs[(a.ik_id, a.mata_kuliah_id)] = persen
    ik_map = {i.id: i for i in db.query(IK).filter(IK.id.in_({k[0] for k in ik_mhs} or [-1])).all()}
    ik_cpl_map = _threshold_cpl(db, {i.cpl_id for i in ik_map.values()})
    ik_out = []
    for (ik_id, mk_id), persen in ik_mhs.items():
        ik = ik_map.get(ik_id)
        cpl = ik_cpl_map.get(ik.cpl_id) if ik else None
        th = Decimal(str(cpl.threshold_capaian or 70)) if cpl else Decimal("70")
        ik_out.append({
            "ik_id": ik_id, "kode": ik.kode if ik else "-", "deskripsi": ik.deskripsi if ik else None,
            "cpl_id": ik.cpl_id if ik else None, "cpl_kode": cpl.kode if cpl else None,
            "mk_id": mk_id, "threshold": _f(th),
            "nilai": _f(persen), "tercapai": persen >= th,
            "rata_rata_kelas": _f(_mean(ik_kelas[(ik_id, mk_id)])),
        })
    ik_out.sort(key=lambda x: (x["kode"], x["mk_id"]))

    # --- CPMK vs rata-rata kelas ------------------------------------------------------
    cpmk_out = []
    if pesertas:
        cpmks = db.query(CPMK).filter(CPMK.mata_kuliah_id.in_(mk_diikuti)).order_by(CPMK.kode).all()
        kelas: dict[int, list[Decimal]] = defaultdict(list)
        for cpmk_id, nilai in (
            db.query(CPMKAchievement.cpmk_id, CPMKAchievement.nilai)
            .filter(CPMKAchievement.cpmk_id.in_([c.id for c in cpmks] or [-1]))
            .all()
        ):
            kelas[cpmk_id].append(Decimal(str(nilai)))
        milik = {
            a.cpmk_id: Decimal(str(a.nilai))
            for a in db.query(CPMKAchievement).filter(
                CPMKAchievement.peserta_mata_kuliah_id.in_([p.id for p in pesertas])
            ).all()
        }
        for c in cpmks:
            if c.id not in milik:
                continue
            n = milik[c.id]
            cpmk_out.append({
                "cpmk_id": c.id, "kode": c.kode, "deskripsi": c.deskripsi, "mk_id": c.mata_kuliah_id,
                "nilai": _f(n), "tercapai": n >= ambang,
                "rata_rata_kelas": _f(_mean(kelas.get(c.id, []))),
                "ik": [m.ik_id for m in c.cpmk_ik_map],
            })

    return {
        "mahasiswa": {
            "mahasiswa_id": mhs.id, "nim": mhs.nim, "nama": mhs.nama, "angkatan": mhs.angkatan,
            "semester_aktif": mhs.semester_aktif, "status_akademik": mhs.status_akademik,
            "program_studi_id": mhs.program_studi_id,
        },
        "ambang_cpmk": _f(ambang),
        "mata_kuliah": mata_kuliah,
        "cpl": cpl_out,
        "ik": ik_out,
        "cpmk": cpmk_out,
    }
