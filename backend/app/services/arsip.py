"""
Pembuatan arsip kurikulum (Data Master).

Snapshot disimpan sebagai JSON dengan referensi berupa KODE (bukan id), supaya
arsip tetap terbaca dan bisa dibandingkan walaupun data aslinya kemudian
dikoreksi atau dihapus.
"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.arsip_kurikulum import ArsipKurikulum
from app.models.cpl import CPL
from app.models.jenis_evaluasi import JenisEvaluasi
from app.models.kurikulum_version import KurikulumVersion
from app.models.mata_kuliah import MataKuliah
from app.models.mk_bentuk_penilaian import MKBentukPenilaian

JENIS_PUBLISH = "publish_kurikulum"
JENIS_SEMESTER = "tutup_semester"


def _num(val):
    if val is None:
        return None
    return f"{Decimal(str(val)).normalize():f}"


def _enum(val):
    return getattr(val, "value", val)


def _versi(v: KurikulumVersion) -> dict:
    return {
        "id": v.id,
        "versi": v.version_label,
        "deskripsi": v.deskripsi,
        "tahun": v.tahun,
        "published_at": v.published_at.isoformat() if v.published_at else None,
    }


def _cpmk_list(mk: MataKuliah) -> list[dict]:
    return [
        {
            "kode": c.kode,
            "deskripsi": c.deskripsi,
            "level_taksonomi": c.level_taksonomi,
            "bobot": _num(c.bobot),
            "pemetaan_ik": sorted(
                ({"ik_kode": m.ik.kode if m.ik else None, "bobot": _num(m.bobot)} for m in c.cpmk_ik_map),
                key=lambda x: x["ik_kode"] or "",
            ),
        }
        for c in sorted(mk.cpmk, key=lambda c: c.kode)
    ]


def _mk_dasar(mk: MataKuliah) -> dict:
    return {
        "kode": mk.kode,
        "nama": mk.nama,
        "sks": mk.sks,
        "semester": _enum(mk.semester),
        "tahun_ajaran": mk.tahun_ajaran,
        "cpmk": _cpmk_list(mk),
    }


def snapshot_kurikulum(db: Session, version: KurikulumVersion) -> dict:
    cpls = db.query(CPL).filter(CPL.kurikulum_version_id == version.id).order_by(CPL.kode).all()
    mks = db.query(MataKuliah).filter(MataKuliah.kurikulum_version_id == version.id).order_by(MataKuliah.kode).all()
    jenis = db.query(JenisEvaluasi).filter(JenisEvaluasi.program_studi_id == version.program_studi_id).order_by(JenisEvaluasi.urutan, JenisEvaluasi.nama).all()
    return {
        "kurikulum": _versi(version),
        "cpl": [
            {
                "kode": c.kode,
                "deskripsi": c.deskripsi,
                "threshold_capaian": _num(c.threshold_capaian),
                "ik": [{"kode": i.kode, "deskripsi": i.deskripsi} for i in sorted(c.ik, key=lambda i: (i.urutan or 0, i.kode))],
            }
            for c in cpls
        ],
        "mata_kuliah": [_mk_dasar(mk) for mk in mks],
        "jenis_evaluasi": [
            {"nama": j.nama, "bobot": _num(j.bobot), "bentuk_penilaian": sorted(b.nama for b in j.bentuk_penilaian)}
            for j in jenis
        ],
        "skala_nilai": [{"huruf": s.huruf, "batas_min": _num(s.batas_min)} for s in version.skala_nilai],
    }


def snapshot_semester(db: Session, prodi_id: int, semester: str, tahun_ajaran: str) -> dict:
    mks = (
        db.query(MataKuliah)
        .filter(
            MataKuliah.program_studi_id == prodi_id,
            MataKuliah.semester == semester,
            MataKuliah.tahun_ajaran == tahun_ajaran,
        )
        .order_by(MataKuliah.kode)
        .all()
    )
    hasil = []
    for mk in mks:
        item = _mk_dasar(mk)
        item["kurikulum"] = mk.kurikulum_version.version_label if mk.kurikulum_version else None
        item["pengampu"] = sorted(
            ({"nama": p.user.nama if p.user else None, "koordinator": str(p.is_koordinator) in ("1", "True", "true")} for p in mk.pengampu),
            key=lambda p: (not p["koordinator"], p["nama"] or ""),
        )
        mbps = db.query(MKBentukPenilaian).filter(
            MKBentukPenilaian.mata_kuliah_id == mk.id,
            (MKBentukPenilaian.semester == semester) | (MKBentukPenilaian.semester.is_(None)),
        ).all()
        item["bentuk_penilaian"] = sorted(
            (
                {
                    "nama": m.bentuk_penilaian.nama if m.bentuk_penilaian else None,
                    "jenis": m.bentuk_penilaian.jenis_evaluasi.nama if m.bentuk_penilaian and m.bentuk_penilaian.jenis_evaluasi else None,
                    "bobot": _num(m.bobot),
                    "matriks_ik": sorted(
                        ({"ik_kode": x.ik.kode if x.ik else None, "bobot": _num(x.bobot)} for x in m.ik_map),
                        key=lambda x: x["ik_kode"] or "",
                    ),
                }
                for m in mbps
            ),
            key=lambda b: b["nama"] or "",
        )
        hasil.append(item)
    return {"semester": semester, "tahun_ajaran": tahun_ajaran, "mata_kuliah": hasil}


def _ringkasan(data: dict) -> dict:
    mks = data.get("mata_kuliah", [])
    r = {
        "mata_kuliah": len(mks),
        "cpmk": sum(len(m.get("cpmk", [])) for m in mks),
    }
    if "cpl" in data:
        r["cpl"] = len(data["cpl"])
        r["ik"] = sum(len(c["ik"]) for c in data["cpl"])
    return r


def arsipkan_publish(db: Session, version: KurikulumVersion, user_id: int | None) -> ArsipKurikulum | None:
    """Arsip saat versi kurikulum PERTAMA KALI dipublish. Publish ulang tidak membuat arsip baru."""
    sudah = db.query(ArsipKurikulum).filter(
        ArsipKurikulum.jenis == JENIS_PUBLISH,
        ArsipKurikulum.kurikulum_version_id == version.id,
    ).first()
    if sudah:
        return None
    data = snapshot_kurikulum(db, version)
    arsip = ArsipKurikulum(
        program_studi_id=version.program_studi_id,
        jenis=JENIS_PUBLISH,
        kurikulum_version_id=version.id,
        judul=f"Kurikulum {version.version_label}" + (f" ({version.tahun})" if version.tahun else ""),
        ringkasan=_ringkasan(data),
        data=data,
        dibuat_oleh=user_id,
    )
    db.add(arsip)
    return arsip


def arsipkan_semester(db: Session, prodi_id: int, semester, tahun_ajaran: str, user_id: int | None) -> ArsipKurikulum:
    semester = _enum(semester)  # terima "Ganjil" maupun SemesterEnum.ganjil
    data = snapshot_semester(db, prodi_id, semester, tahun_ajaran)
    arsip = ArsipKurikulum(
        program_studi_id=prodi_id,
        jenis=JENIS_SEMESTER,
        semester=semester,
        tahun_ajaran=tahun_ajaran,
        judul=f"Semester {semester} {tahun_ajaran}",
        ringkasan=_ringkasan(data),
        data=data,
        dibuat_oleh=user_id,
    )
    db.add(arsip)
    return arsip
