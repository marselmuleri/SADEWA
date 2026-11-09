"""
Data agregat Analitik OBE tingkat prodi (Kaprodi & Dekan).

Satu payload untuk fitur interaktif di halaman Analitik OBE: perbandingan angkatan,
heatmap, papan prioritas, kartu temuan, drill-down sampai CPMK, simulator threshold,
dan peta kurikulum. Tidak memuat nama/NIM mahasiswa; capaian per mahasiswa dikirim
sebagai daftar angka per (CPL, angkatan) supaya simulasi threshold bisa dihitung di browser.
"""
from collections import defaultdict
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.cpl import CPL
from app.models.cpl_achievement import CPLAchievement
from app.models.cpmk import CPMK
from app.models.cpmk_achievement import CPMKAchievement
from app.models.cpmk_ik_map import CPMKIKMap
from app.models.ik import IK
from app.models.ik_achievement import IKAchievement
from app.models.kurikulum_version import KurikulumVersion
from app.models.mahasiswa import Mahasiswa
from app.models.mata_kuliah import MataKuliah
from app.models.mk_bentuk_penilaian import MKBentukPenilaian
from app.models.mk_bentuk_penilaian_ik_map import MKBentukPenilaianIKMap
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.services.calculation.cpl_aggregate import gabung_capaian_cpl
from app.services.calculation.obe_formula import persen_ik
from app.services.portofolio_aturan import ambang_prodi

# Ambang CPMK tercapai mengikuti Aturan Penilaian prodi (bawaan 70).


def _f(val) -> float | None:
    return None if val is None else round(float(val), 2)


def _mean(values) -> Decimal | None:
    values = list(values)
    return sum(values) / len(values) if values else None


def bobot_pemetaan_per_mk(db: Session, mk_ids) -> dict[tuple[int, int], Decimal]:
    """Σ bobot pemetaan CPMK→IK per (mata_kuliah_id, ik_id): kontribusi rancangan MK ke IK."""
    hasil: dict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0"))
    if not mk_ids:
        return hasil
    rows = (
        db.query(CPMK.mata_kuliah_id, CPMKIKMap.ik_id, CPMKIKMap.bobot)
        .join(CPMK, CPMK.id == CPMKIKMap.cpmk_id)
        .filter(CPMK.mata_kuliah_id.in_(list(mk_ids)))
        .all()
    )
    for mk_id, ik_id, bobot in rows:
        hasil[(mk_id, ik_id)] += Decimal(str(bobot))
    return hasil


def bobot_ik_per_mk(db: Session, mk_ids) -> dict[tuple[int, int], Decimal]:
    """
    Poin IK maksimal per (mata_kuliah_id, ik_id) = jumlah kolom IK pada matriks bentuk
    penilaian × IK. Dipakai sebagai penyebut persen IK (poin IK berasal dari matriks ini),
    sehingga persen tidak pernah > 100. Untuk MK yang lolos validasi bobot, nilainya
    sama dengan Σ bobot pemetaan CPMK→IK.
    """
    hasil: dict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0"))
    if not mk_ids:
        return hasil
    rows = (
        db.query(MKBentukPenilaian.mata_kuliah_id, MKBentukPenilaianIKMap.ik_id, MKBentukPenilaianIKMap.bobot)
        .join(MKBentukPenilaian, MKBentukPenilaian.id == MKBentukPenilaianIKMap.mk_bentuk_penilaian_id)
        .filter(MKBentukPenilaian.mata_kuliah_id.in_(list(mk_ids)))
        .all()
    )
    for mk_id, ik_id, bobot in rows:
        hasil[(mk_id, ik_id)] += Decimal(str(bobot))
    return hasil


def _bangun_payload(
    db: Session,
    *,
    scope: str,
    prodi_id: int,
    cpls: list,
    mks: list,
    cpl_rows: list,
    semester: str | None,
    hanya_ik_terpetakan: bool,
) -> dict:
    """
    Payload Analitik OBE yang sama untuk dua cakupan:
      - scope "prodi": seluruh prodi (Kaprodi/Dekan); CPL = gabungan lintas MK.
      - scope "mata_kuliah": satu MK (Dosen pengampu); CPL = capaian di MK itu saja.
    """
    versi = {v.id: v.version_label for v in db.query(KurikulumVersion).filter(KurikulumVersion.program_studi_id == prodi_id).all()}
    ambang_cpmk = ambang_prodi(db, prodi_id)
    cpl_ids = [c.id for c in cpls]
    threshold = {c.id: Decimal(str(c.threshold_capaian or 70)) for c in cpls}
    mk_ids = [m.id for m in mks]

    cpmks = db.query(CPMK).filter(CPMK.mata_kuliah_id.in_(mk_ids)).order_by(CPMK.kode).all() if mk_ids else []
    bobot_map = bobot_pemetaan_per_mk(db, mk_ids)   # kontribusi rancangan (peta kurikulum)
    bobot_mk_ik = bobot_ik_per_mk(db, mk_ids)       # poin IK maksimal (penyebut persen IK)

    iks = db.query(IK).filter(IK.cpl_id.in_(cpl_ids)).order_by(IK.kode).all() if cpl_ids else []
    if hanya_ik_terpetakan:
        terpetakan = {ik_id for (_mk, ik_id) in bobot_map} | {ik_id for (_mk, ik_id) in bobot_mk_ik}
        iks = [i for i in iks if i.id in terpetakan]
    ik_cpl = {i.id: i.cpl_id for i in iks}

    # --- Capaian CPL per mahasiswa (berbobot bobot IK) per angkatan --------------------
    per_angkatan: dict[tuple[int, int | None], list[float]] = defaultdict(list)
    for g in gabung_capaian_cpl(cpl_rows).values():
        per_angkatan[(g.cpl_id, g.angkatan)].append(_f(g.nilai))
    capaian_cpl = [
        {"cpl_id": cpl_id, "angkatan": angkatan, "nilai": sorted(vals)}
        for (cpl_id, angkatan), vals in sorted(per_angkatan.items(), key=lambda kv: (kv[0][0], kv[0][1] or 0))
    ]

    # --- Peta kurikulum: kontribusi & capaian CPL per mata kuliah ---------------------
    peta: dict[tuple[int, int], dict] = {}
    for (mk_id, ik_id), bobot in bobot_map.items():
        cpl_id = ik_cpl.get(ik_id)
        if cpl_id is None:
            continue
        sel = peta.setdefault((cpl_id, mk_id), {"bobot_cp": Decimal("0"), "nilai": []})
        sel["bobot_cp"] += bobot
    for r in cpl_rows:
        if r.mata_kuliah_id is not None and (r.cpl_id, r.mata_kuliah_id) in peta:
            peta[(r.cpl_id, r.mata_kuliah_id)]["nilai"].append(Decimal(str(r.nilai)))
    capaian_cpl_mk = []
    for (cpl_id, mk_id), sel in peta.items():
        nilai = sel["nilai"]
        capaian_cpl_mk.append({
            "cpl_id": cpl_id,
            "mk_id": mk_id,
            "bobot_cp": _f(sel["bobot_cp"]),
            "rata_rata": _f(_mean(nilai)),
            "jumlah_mahasiswa": len(nilai),
            "persen_tercapai": _f(Decimal(sum(1 for n in nilai if n >= threshold[cpl_id])) / len(nilai) * 100) if nilai else None,
        })

    # --- Capaian IK (persen) per mata kuliah dan keseluruhan --------------------------
    ik_mk: dict[tuple[int, int], list[Decimal]] = defaultdict(list)
    if iks and mk_ids:
        q = db.query(IKAchievement).filter(
            IKAchievement.ik_id.in_([i.id for i in iks]),
            IKAchievement.mata_kuliah_id.in_(mk_ids),
        )
        if semester:
            q = q.filter(IKAchievement.semester == semester)
        for a in q.all():
            bobot = bobot_mk_ik.get((a.mata_kuliah_id, a.ik_id))
            if bobot and bobot > 0:
                ik_mk[(a.ik_id, a.mata_kuliah_id)].append(persen_ik(a.nilai, bobot))

    def _ik_stat(values, cpl_id):
        return {
            "rata_rata": _f(_mean(values)),
            "jumlah_mahasiswa": len(values),
            "persen_tercapai": _f(Decimal(sum(1 for v in values if v >= threshold[cpl_id])) / len(values) * 100) if values else None,
        }

    ik_out = []
    for ik in iks:
        semua = [v for (ik_id, _mk), vals in ik_mk.items() if ik_id == ik.id for v in vals]
        ik_out.append({
            "ik_id": ik.id, "kode": ik.kode, "deskripsi": ik.deskripsi, "cpl_id": ik.cpl_id,
            **_ik_stat(semua, ik.cpl_id),
            "per_mk": [
                {"mk_id": mk_id, "bobot": _f(bobot_mk_ik.get((mk_id, ik.id))), **_ik_stat(vals, ik.cpl_id)}
                for (ik_id, mk_id), vals in ik_mk.items() if ik_id == ik.id
            ],
        })

    # --- Capaian CPMK (keseluruhan + per angkatan) ------------------------------------
    cpmk_vals: dict[int, list[Decimal]] = defaultdict(list)
    cpmk_angkatan: dict[tuple[int, int | None], list[float]] = defaultdict(list)
    if cpmks:
        rows = (
            db.query(CPMKAchievement.cpmk_id, CPMKAchievement.nilai, Mahasiswa.angkatan)
            .join(PesertaMataKuliah, PesertaMataKuliah.id == CPMKAchievement.peserta_mata_kuliah_id)
            .join(Mahasiswa, Mahasiswa.id == PesertaMataKuliah.mahasiswa_id)
            .filter(CPMKAchievement.cpmk_id.in_([c.id for c in cpmks]))
            .all()
        )
        for cpmk_id, nilai, angkatan in rows:
            cpmk_vals[cpmk_id].append(Decimal(str(nilai)))
            cpmk_angkatan[(cpmk_id, angkatan)].append(_f(nilai))
    cpmk_out = []
    for c in cpmks:
        vals = cpmk_vals.get(c.id, [])
        cpmk_out.append({
            "cpmk_id": c.id, "kode": c.kode, "deskripsi": c.deskripsi, "mk_id": c.mata_kuliah_id,
            "bobot": _f(c.bobot),
            "ik": [{"ik_id": m.ik_id, "bobot": _f(m.bobot)} for m in c.cpmk_ik_map],
            "rata_rata": _f(_mean(vals)),
            "jumlah_mahasiswa": len(vals),
            "jumlah_tercapai": sum(1 for v in vals if v >= ambang_cpmk),
        })
    capaian_cpmk = [
        {"cpmk_id": cpmk_id, "angkatan": angkatan, "nilai": sorted(vals)}
        for (cpmk_id, angkatan), vals in sorted(cpmk_angkatan.items(), key=lambda kv: (kv[0][0], kv[0][1] or 0))
    ]

    return {
        "scope": scope,
        "program_studi_id": prodi_id,
        "semester": semester,
        "ambang_cpmk": _f(ambang_cpmk),
        "cpl": [
            {"cpl_id": c.id, "kode": c.kode, "deskripsi": c.deskripsi, "threshold": _f(threshold[c.id]),
             "kurikulum": versi.get(c.kurikulum_version_id)}
            for c in cpls
        ],
        "ik": ik_out,
        "mata_kuliah": [
            {"mk_id": m.id, "kode": m.kode, "nama": m.nama, "sks": m.sks,
             "semester": getattr(m.semester, "value", m.semester), "tahun_ajaran": m.tahun_ajaran}
            for m in mks
        ],
        "cpmk": cpmk_out,
        "capaian_cpl": capaian_cpl,
        "capaian_cpl_mk": capaian_cpl_mk,
        "capaian_cpmk": capaian_cpmk,
    }


def analitik_prodi(db: Session, prodi_id: int, semester: str | None = None) -> dict:
    """
    Seluruh prodi. Capaian CPL = gabungan berbobot lintas mata kuliah.
    Hanya CPL dari versi kurikulum yang dipakai mata kuliah (bukan versi lama tanpa MK
    atau draf revisi), supaya tidak muncul sebagai "CPL tanpa mata kuliah pendukung".
    """
    mk_query = db.query(MataKuliah).filter(MataKuliah.program_studi_id == prodi_id)
    if semester:
        mk_query = mk_query.filter(MataKuliah.semester == semester)
    mks = mk_query.order_by(MataKuliah.kode).all()
    versi_dipakai = {m.kurikulum_version_id for m in mks}
    cpls = (
        db.query(CPL)
        .filter(CPL.program_studi_id == prodi_id, CPL.kurikulum_version_id.in_(versi_dipakai))
        .order_by(CPL.kode)
        .all()
        if versi_dipakai else []
    )

    cpl_rows = []
    if cpls:
        q = db.query(CPLAchievement).filter(CPLAchievement.cpl_id.in_([c.id for c in cpls]))
        if semester:
            q = q.filter(CPLAchievement.semester == semester)
        cpl_rows = q.all()
    return _bangun_payload(
        db, scope="prodi", prodi_id=prodi_id, cpls=cpls, mks=mks, cpl_rows=cpl_rows,
        semester=semester, hanya_ik_terpetakan=False,
    )


def analitik_mata_kuliah(db: Session, mk: MataKuliah) -> dict:
    """
    Satu mata kuliah. Hanya CPL/IK yang diukur MK ini, dan capaian CPL yang dihitung
    di MK ini saja (bukan gabungan dengan MK lain).
    """
    ik_ids = {ik_id for (_mk, ik_id) in bobot_pemetaan_per_mk(db, [mk.id])} | {ik_id for (_mk, ik_id) in bobot_ik_per_mk(db, [mk.id])}
    cpl_ids = {i.cpl_id for i in db.query(IK).filter(IK.id.in_(ik_ids)).all()} if ik_ids else set()
    cpls = db.query(CPL).filter(CPL.id.in_(cpl_ids)).order_by(CPL.kode).all() if cpl_ids else []
    cpl_rows = (
        db.query(CPLAchievement)
        .filter(CPLAchievement.mata_kuliah_id == mk.id, CPLAchievement.cpl_id.in_(cpl_ids))
        .all()
        if cpl_ids else []
    )
    return _bangun_payload(
        db, scope="mata_kuliah", prodi_id=mk.program_studi_id, cpls=cpls, mks=[mk], cpl_rows=cpl_rows,
        semester=None, hanya_ik_terpetakan=True,
    )
