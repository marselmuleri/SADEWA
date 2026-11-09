"""
Portofolio mata kuliah: Upload RPS, Input RPP, Upload Lampiran, Lihat Nilai CP,
Lihat Grafik Capaian, dan Lihat Sebaran Nilai.

Hak akses:
- Dosen: hanya mata kuliah yang diampu; boleh mengunggah/mengisi (tulis).
- Kaprodi: semua mata kuliah di prodinya; lihat saja.
- Dekan: semua mata kuliah di fakultasnya; lihat saja.
- Admin Prodi & Super Admin: tidak punya akses.
"""
import uuid
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import AcademicScope, get_academic_scope
from app.models.enums import UserRole
from app.models.hasil_evaluasi import HasilEvaluasi
from app.models.mata_kuliah import MataKuliah
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.portofolio import PortofolioBerkas, RPPPertemuan
from app.models.program_studi import ProgramStudi
from app.models.user import User
from app.models.cpmk import CPMK
from app.models.portofolio import EvaluasiCPMK, PortofolioInfo
from app.schemas.portofolio import (
    BerkasResponse, EvaluasiUpdate, PortofolioInfoData, PortofolioMataKuliahItem, RPPItem, RPPResponse, RPPUpdate,
)
from app.services import ai_client
from app.services.portofolio import capaian_mata_kuliah, evaluasi_cpmk
from app.services.portofolio_aturan import aturan_prodi
from app.services.portofolio_export import export_portofolio

router = APIRouter()

PERAN_PORTOFOLIO = (UserRole.dosen, UserRole.kaprodi, UserRole.dekan)
JENIS_BERKAS = {
    "rps": {".pdf", ".doc", ".docx"},
    "lampiran": {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".jpg", ".jpeg", ".png", ".zip", ".txt", ".csv",
    },
}
CHUNK = 1024 * 1024


def _cek_peran(scope: AcademicScope) -> None:
    if scope.user.role not in PERAN_PORTOFOLIO:
        raise HTTPException(status_code=403, detail="Portofolio hanya untuk Dosen, Kaprodi, dan Dekan")


def _is_pengampu(db: Session, user: User, mk_id: int) -> bool:
    return db.query(PengampuMataKuliah).filter(
        PengampuMataKuliah.mata_kuliah_id == mk_id,
        PengampuMataKuliah.user_id == user.id,
    ).first() is not None


def _mk_baca(db: Session, scope: AcademicScope, mk_id: int) -> MataKuliah:
    _cek_peran(scope)
    mk = db.query(MataKuliah).filter(MataKuliah.id == mk_id).first()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")
    role = scope.user.role
    if role == UserRole.dosen and not _is_pengampu(db, scope.user, mk_id):
        raise HTTPException(status_code=403, detail="Anda bukan dosen pengampu mata kuliah ini")
    if role == UserRole.kaprodi and mk.program_studi_id != scope.program_studi_id:
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar prodi Anda")
    if role == UserRole.dekan and (not mk.program_studi or mk.program_studi.fakultas_id != scope.fakultas_id):
        raise HTTPException(status_code=403, detail="Mata kuliah ini di luar fakultas Anda")
    return mk


def _mk_tulis(db: Session, scope: AcademicScope, mk_id: int) -> MataKuliah:
    mk = _mk_baca(db, scope, mk_id)
    if scope.user.role != UserRole.dosen:
        raise HTTPException(status_code=403, detail="Hanya dosen pengampu yang dapat mengubah portofolio")
    return mk


def _upload_root() -> Path:
    return Path(settings.UPLOAD_DIR).resolve()


def _berkas_response(b: PortofolioBerkas) -> BerkasResponse:
    data = BerkasResponse.model_validate(b)
    data.uploader_nama = b.uploader.nama if b.uploader else None
    return data


# ---------------------------------------------------------------------------
# Daftar mata kuliah
# ---------------------------------------------------------------------------

@router.get("/mata-kuliah", response_model=list[PortofolioMataKuliahItem])
def daftar_mata_kuliah(
    program_studi_id: int | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    _cek_peran(scope)
    user = scope.user
    query = db.query(MataKuliah)
    if user.role == UserRole.dosen:
        mk_ids = [p.mata_kuliah_id for p in db.query(PengampuMataKuliah).filter(PengampuMataKuliah.user_id == user.id)]
        query = query.filter(MataKuliah.id.in_(mk_ids))
    elif user.role == UserRole.kaprodi:
        query = query.filter(MataKuliah.program_studi_id == scope.program_studi_id)
    else:  # dekan
        query = query.join(ProgramStudi, ProgramStudi.id == MataKuliah.program_studi_id).filter(
            ProgramStudi.fakultas_id == scope.fakultas_id
        )
        if program_studi_id:
            query = query.filter(MataKuliah.program_studi_id == program_studi_id)

    mk_list = query.order_by(MataKuliah.kode).all()
    ids = [mk.id for mk in mk_list]
    if not ids:
        return []

    pengampu: dict[int, list[str]] = {}
    pengampu_saya: set[int] = set()
    for p, u in (
        db.query(PengampuMataKuliah, User)
        .join(User, User.id == PengampuMataKuliah.user_id)
        .filter(PengampuMataKuliah.mata_kuliah_id.in_(ids))
        .all()
    ):
        pengampu.setdefault(p.mata_kuliah_id, []).append(u.nama or u.email or "-")
        if u.id == user.id:
            pengampu_saya.add(p.mata_kuliah_id)

    def hitung(q):
        return dict(q.all())

    peserta = hitung(
        db.query(PesertaMataKuliah.mata_kuliah_id, func.count(PesertaMataKuliah.id))
        .filter(PesertaMataKuliah.mata_kuliah_id.in_(ids))
        .group_by(PesertaMataKuliah.mata_kuliah_id)
    )
    dinilai = hitung(
        db.query(PesertaMataKuliah.mata_kuliah_id, func.count(HasilEvaluasi.id))
        .join(HasilEvaluasi, HasilEvaluasi.peserta_mata_kuliah_id == PesertaMataKuliah.id)
        .filter(PesertaMataKuliah.mata_kuliah_id.in_(ids), HasilEvaluasi.nilai_akhir.isnot(None))
        .group_by(PesertaMataKuliah.mata_kuliah_id)
    )
    rpp = hitung(
        db.query(RPPPertemuan.mata_kuliah_id, func.count(RPPPertemuan.id))
        .filter(RPPPertemuan.mata_kuliah_id.in_(ids))
        .group_by(RPPPertemuan.mata_kuliah_id)
    )
    berkas: dict[tuple[int, str], int] = {
        (mk_id, jenis): n
        for mk_id, jenis, n in (
            db.query(PortofolioBerkas.mata_kuliah_id, PortofolioBerkas.jenis, func.count(PortofolioBerkas.id))
            .filter(PortofolioBerkas.mata_kuliah_id.in_(ids))
            .group_by(PortofolioBerkas.mata_kuliah_id, PortofolioBerkas.jenis)
            .all()
        )
    }

    return [
        PortofolioMataKuliahItem(
            id=mk.id,
            kode=mk.kode,
            nama=mk.nama,
            sks=mk.sks,
            semester=getattr(mk.semester, "value", mk.semester),
            tahun_ajaran=mk.tahun_ajaran,
            program_studi_id=mk.program_studi_id,
            program_studi_nama=mk.program_studi.nama if mk.program_studi else None,
            pengampu=pengampu.get(mk.id, []),
            jumlah_peserta=peserta.get(mk.id, 0),
            jumlah_dinilai=dinilai.get(mk.id, 0),
            jumlah_rps=berkas.get((mk.id, "rps"), 0),
            jumlah_lampiran=berkas.get((mk.id, "lampiran"), 0),
            jumlah_rpp=rpp.get(mk.id, 0),
            is_pengampu=mk.id in pengampu_saya,
        )
        for mk in mk_list
    ]


# ---------------------------------------------------------------------------
# Berkas (Upload RPS & Upload Lampiran)
# Route literal "/berkas/..." didefinisikan sebelum route "/{mata_kuliah_id}/...".
# ---------------------------------------------------------------------------

def _berkas_baca(db: Session, scope: AcademicScope, berkas_id: int) -> PortofolioBerkas:
    berkas = db.query(PortofolioBerkas).filter(PortofolioBerkas.id == berkas_id).first()
    if not berkas:
        raise HTTPException(status_code=404, detail="Berkas tidak ditemukan")
    _mk_baca(db, scope, berkas.mata_kuliah_id)
    return berkas


@router.get("/berkas/{berkas_id}/unduh")
def unduh_berkas(
    berkas_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    berkas = _berkas_baca(db, scope, berkas_id)
    root = _upload_root()
    path = (root / berkas.path_file).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="File berkas tidak ditemukan di server")
    return FileResponse(path, media_type=berkas.content_type or "application/octet-stream", filename=berkas.nama_file)


@router.delete("/berkas/{berkas_id}")
def hapus_berkas(
    berkas_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    berkas = _berkas_baca(db, scope, berkas_id)
    _mk_tulis(db, scope, berkas.mata_kuliah_id)
    root = _upload_root()
    path = (root / berkas.path_file).resolve()
    db.delete(berkas)
    db.commit()
    if root in path.parents and path.is_file():
        path.unlink(missing_ok=True)
    return {"message": "Berkas dihapus"}


@router.get("/{mata_kuliah_id}/berkas", response_model=list[BerkasResponse])
def daftar_berkas(
    mata_kuliah_id: int,
    jenis: str | None = None,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    _mk_baca(db, scope, mata_kuliah_id)
    query = db.query(PortofolioBerkas).filter(PortofolioBerkas.mata_kuliah_id == mata_kuliah_id)
    if jenis:
        query = query.filter(PortofolioBerkas.jenis == jenis)
    return [_berkas_response(b) for b in query.order_by(PortofolioBerkas.id.desc()).all()]


@router.post("/{mata_kuliah_id}/berkas", response_model=BerkasResponse)
async def unggah_berkas(
    mata_kuliah_id: int,
    jenis: str = Form(...),
    judul: str = Form(""),
    keterangan: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    _mk_tulis(db, scope, mata_kuliah_id)
    if jenis not in JENIS_BERKAS:
        raise HTTPException(status_code=400, detail="Jenis berkas harus 'rps' atau 'lampiran'")

    nama_asli = Path(file.filename or "").name.strip()
    ext = Path(nama_asli).suffix.lower()
    if not nama_asli or ext not in JENIS_BERKAS[jenis]:
        izin = ", ".join(sorted(JENIS_BERKAS[jenis]))
        raise HTTPException(status_code=400, detail=f"Format file tidak didukung. Gunakan: {izin}")

    folder = _upload_root() / "portofolio" / str(mata_kuliah_id)
    folder.mkdir(parents=True, exist_ok=True)
    tujuan = folder / f"{uuid.uuid4().hex}{ext}"
    batas = settings.UPLOAD_MAX_MB * 1024 * 1024
    ukuran = 0
    try:
        with tujuan.open("wb") as out:
            while chunk := await file.read(CHUNK):
                ukuran += len(chunk)
                if ukuran > batas:
                    raise HTTPException(status_code=413, detail=f"Ukuran file melebihi {settings.UPLOAD_MAX_MB} MB")
                out.write(chunk)
    except HTTPException:
        tujuan.unlink(missing_ok=True)
        raise
    if ukuran == 0:
        tujuan.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="File kosong")

    berkas = PortofolioBerkas(
        mata_kuliah_id=mata_kuliah_id,
        jenis=jenis,
        judul=(judul.strip() or nama_asli)[:255],
        keterangan=keterangan.strip() or None,
        nama_file=nama_asli[:255],
        path_file=tujuan.relative_to(_upload_root()).as_posix(),
        content_type=file.content_type,
        ukuran=ukuran,
        uploaded_by=scope.user.id,
    )
    db.add(berkas)
    db.commit()
    db.refresh(berkas)
    return _berkas_response(berkas)


# ---------------------------------------------------------------------------
# RPP (Input RPP per pertemuan)
# ---------------------------------------------------------------------------

def _rpp_response(rows: list[RPPPertemuan]) -> RPPResponse:
    return RPPResponse(
        pertemuan=[
            RPPItem(
                pertemuan_ke=r.pertemuan_ke, tanggal=r.tanggal, cpmk=r.cpmk, materi=r.materi,
                metode=r.metode, waktu=r.waktu, pengalaman_belajar=r.pengalaman_belajar,
                indikator_kriteria=r.indikator_kriteria, realisasi=r.realisasi, catatan=r.catatan,
            )
            for r in rows
        ],
        updated_at=max((r.updated_at for r in rows if r.updated_at), default=None),
    )


@router.get("/{mata_kuliah_id}/rpp", response_model=RPPResponse)
def lihat_rpp(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    _mk_baca(db, scope, mata_kuliah_id)
    rows = (
        db.query(RPPPertemuan)
        .filter(RPPPertemuan.mata_kuliah_id == mata_kuliah_id)
        .order_by(RPPPertemuan.pertemuan_ke)
        .all()
    )
    return _rpp_response(rows)


@router.put("/{mata_kuliah_id}/rpp", response_model=RPPResponse)
def simpan_rpp(
    mata_kuliah_id: int,
    payload: RPPUpdate,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """Ganti seluruh isi RPP mata kuliah dengan daftar pertemuan yang dikirim."""
    _mk_tulis(db, scope, mata_kuliah_id)
    nomor = [p.pertemuan_ke for p in payload.pertemuan]
    if len(nomor) != len(set(nomor)):
        raise HTTPException(status_code=400, detail="Nomor pertemuan tidak boleh ganda")

    db.query(RPPPertemuan).filter(RPPPertemuan.mata_kuliah_id == mata_kuliah_id).delete()
    db.flush()
    for p in sorted(payload.pertemuan, key=lambda x: x.pertemuan_ke):
        db.add(RPPPertemuan(mata_kuliah_id=mata_kuliah_id, updated_by=scope.user.id, **p.model_dump()))
    db.commit()
    rows = (
        db.query(RPPPertemuan)
        .filter(RPPPertemuan.mata_kuliah_id == mata_kuliah_id)
        .order_by(RPPPertemuan.pertemuan_ke)
        .all()
    )
    return _rpp_response(rows)


# ---------------------------------------------------------------------------
# Nilai CP, Grafik Capaian, Sebaran Nilai (satu payload)
# ---------------------------------------------------------------------------

@router.get("/{mata_kuliah_id}/capaian")
def lihat_capaian(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    mk = _mk_baca(db, scope, mata_kuliah_id)
    return capaian_mata_kuliah(db, mk)


# ---------------------------------------------------------------------------
# Evaluasi pemenuhan CPMK (analisis & rencana perbaikan, dengan saran AI)
# ---------------------------------------------------------------------------

@router.get("/{mata_kuliah_id}/evaluasi")
def lihat_evaluasi(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    mk = _mk_baca(db, scope, mata_kuliah_id)
    return evaluasi_cpmk(db, mk, aturan_prodi(db, mk.program_studi_id))


@router.put("/{mata_kuliah_id}/evaluasi")
def simpan_evaluasi(
    mata_kuliah_id: int,
    payload: EvaluasiUpdate,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    mk = _mk_tulis(db, scope, mata_kuliah_id)
    cpmk_ids = {c.id for c in db.query(CPMK.id).filter(CPMK.mata_kuliah_id == mk.id)}
    asing = [i.cpmk_id for i in payload.items if i.cpmk_id not in cpmk_ids]
    if asing:
        raise HTTPException(status_code=400, detail="Ada CPMK yang bukan milik mata kuliah ini")

    lama = {
        e.cpmk_id: e
        for e in db.query(EvaluasiCPMK).filter(EvaluasiCPMK.mata_kuliah_id == mk.id).all()
    }
    for item in payload.items:
        analisis = (item.analisis or "").strip() or None
        rencana = (item.rencana_perbaikan or "").strip() or None
        baris = lama.get(item.cpmk_id)
        if baris is None:
            baris = EvaluasiCPMK(mata_kuliah_id=mk.id, cpmk_id=item.cpmk_id)
            db.add(baris)
        baris.analisis = analisis
        baris.rencana_perbaikan = rencana
        baris.updated_by = scope.user.id
    db.commit()
    return evaluasi_cpmk(db, mk, aturan_prodi(db, mk.program_studi_id))


@router.post("/{mata_kuliah_id}/evaluasi/saran")
async def saran_evaluasi(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """
    Minta saran teks Analisis & Rencana Perbaikan per CPMK ke AI Service.
    Hasilnya TIDAK disimpan otomatis: dosen meninjau dan mengedit dulu, lalu menyimpan.
    """
    mk = _mk_tulis(db, scope, mata_kuliah_id)
    aturan = aturan_prodi(db, mk.program_studi_id)
    data = evaluasi_cpmk(db, mk, aturan)
    dinilai = [i for i in data["items"] if i["jumlah_dinilai"]]
    if not dinilai:
        raise HTTPException(
            status_code=422,
            detail="Belum ada nilai CPMK. Jalankan kalkulasi nilai terlebih dahulu sebelum meminta saran AI.",
        )

    hasil = await ai_client.generate_evaluasi_cpmk({
        "mk_name": mk.nama or mk.kode or "Mata Kuliah",
        "prodi": mk.program_studi.nama if mk.program_studi else "Program Studi",
        "semester": getattr(mk.semester, "value", mk.semester) or "Ganjil",
        "tahun_ajaran": mk.tahun_ajaran or "-",
        "ambang": aturan.ambang_cpmk,
        "target_persen": aturan.target_persen,
        "target_rerata_skala": aturan.target_rerata_skala,
        "skala_maks": aturan.skor_maks,
        "cpmk": [
            {
                "kode": i["kode"],
                "deskripsi": i["deskripsi"] or "",
                "rata_rata": i["rata_rata"],
                "rerata_skala": i["rerata_skala"],
                "persen_tercapai": i["persen_tercapai"],
                "jumlah_mahasiswa": i["jumlah_dinilai"],
                "jumlah_tercapai": i["jumlah_tercapai"],
                "memenuhi": bool(i["memenuhi"]),
            }
            for i in dinilai
        ],
    })
    saran = {
        str(e.get("kode", "")).strip(): e
        for e in ((hasil.get("data") or {}).get("evaluasi") or [])
        if isinstance(e, dict)
    }
    return {
        "items": [
            {
                "cpmk_id": i["cpmk_id"],
                "kode": i["kode"],
                "analisis": (saran.get(i["kode"]) or {}).get("analisis"),
                "rencana_perbaikan": (saran.get(i["kode"]) or {}).get("rencana_perbaikan"),
            }
            for i in dinilai
        ],
        "peringatan": hasil.get("warnings") or [],
    }


# ---------------------------------------------------------------------------
# Export Excel portofolio lengkap
# ---------------------------------------------------------------------------

@router.get("/{mata_kuliah_id}/export")
def export_excel(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    mk = _mk_baca(db, scope, mata_kuliah_id)
    isi, nama_file = export_portofolio(db, mk)
    ascii_nama = nama_file.encode("ascii", "ignore").decode() or "portofolio.xlsx"
    return Response(
        content=isi,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{ascii_nama}"; filename*=UTF-8\'\'{quote(nama_file)}',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ---------------------------------------------------------------------------
# Data Portofolio (isian cover & kontrak perkuliahan)
# ---------------------------------------------------------------------------

# Isian khas dokumen: tidak ikut disarankan dari semester sebelumnya.
FIELD_KHUSUS_DOKUMEN = {"no_dokumen", "revisi", "tanggal_terbit"}


def _info_semester_lalu(db: Session, mk: MataKuliah) -> tuple[PortofolioInfo, MataKuliah] | None:
    """Data portofolio terbaru dari mata kuliah berkode sama di prodi yang sama."""
    return (
        db.query(PortofolioInfo, MataKuliah)
        .join(MataKuliah, MataKuliah.id == PortofolioInfo.mata_kuliah_id)
        .filter(
            MataKuliah.kode == mk.kode,
            MataKuliah.program_studi_id == mk.program_studi_id,
            MataKuliah.id != mk.id,
        )
        .order_by(MataKuliah.tahun_ajaran.desc(), MataKuliah.id.desc())
        .first()
    )


@router.get("/{mata_kuliah_id}/info")
def lihat_info(
    mata_kuliah_id: int,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    """
    Isian Data Portofolio. Bila belum pernah diisi, `saran` berisi isian mata kuliah
    yang sama dari semester sebelumnya (tanpa nomor/revisi/tanggal dokumen) supaya
    dosen tinggal meninjau dan menyimpan.
    """
    mk = _mk_baca(db, scope, mata_kuliah_id)
    info = db.query(PortofolioInfo).filter(PortofolioInfo.mata_kuliah_id == mk.id).first()
    aturan = aturan_prodi(db, mk.program_studi_id)
    hasil = {
        "data": PortofolioInfoData.model_validate(info).model_dump(mode="json") if info else None,
        "updated_at": info.updated_at if info else None,
        "saran": None,
        "saran_sumber": None,
        "gpm_nama": aturan.gpm_nama,
        "gpm_nip": aturan.gpm_nip,
    }
    if info is None:
        lalu = _info_semester_lalu(db, mk)
        if lalu:
            sumber, mk_lalu = lalu
            saran = PortofolioInfoData.model_validate(sumber).model_dump(mode="json")
            for k in FIELD_KHUSUS_DOKUMEN:
                saran[k] = None
            hasil["saran"] = saran
            semester = getattr(mk_lalu.semester, "value", mk_lalu.semester) or ""
            hasil["saran_sumber"] = f"{mk_lalu.kode} {mk_lalu.tahun_ajaran or ''} {semester}".strip()
    return hasil


@router.put("/{mata_kuliah_id}/info")
def simpan_info(
    mata_kuliah_id: int,
    payload: PortofolioInfoData,
    db: Session = Depends(get_db),
    scope: AcademicScope = Depends(get_academic_scope),
):
    mk = _mk_tulis(db, scope, mata_kuliah_id)
    info = db.query(PortofolioInfo).filter(PortofolioInfo.mata_kuliah_id == mk.id).first()
    if info is None:
        info = PortofolioInfo(mata_kuliah_id=mk.id)
        db.add(info)
    for key, value in payload.model_dump().items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(info, key, value)
    info.updated_by = scope.user.id
    db.commit()
    return lihat_info(mata_kuliah_id, db, scope)
