"""
Export Portofolio mata kuliah ke Excel (mengikuti susunan sheet portofolio OBELISK).

Sheet: COVER, CPMK-CPL, RPS, KONTRAK, NILAI <jenis evaluasi>, FORM NILAI, CPMK,
PI-CPL, CPL, REMIDI, EVALUASI, PARAMETER.

Prinsip:
- Data mentah (nilai per bentuk penilaian × IK, capaian CPMK/IK/CPL) ditulis sebagai angka.
- Rekap (nilai per jenis, nilai akhir, huruf, status, skor rubrik, rata-rata, % tercapai,
  sebaran, "Memenuhi?") ditulis sebagai RUMUS, sehingga workbook tetap hidup bila
  dosen mengoreksi angka di Excel.
- Semua aturan (ambang, target, rubrik, skala huruf) berada di sheet PARAMETER dan
  dirujuk dari rumus, bukan ditanam di rumus.
- Setiap sheet per-mahasiswa memakai urutan baris yang sama (mulai BARIS_DATA).
"""
import io
import re
from collections import defaultdict
from dataclasses import dataclass, field

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.cpl import CPL
from app.models.cpmk import CPMK
from app.models.cpmk_ik_map import CPMKIKMap
from app.models.enums import UserRole
from app.models.ik import IK
from app.models.ik_achievement import IKAchievement
from app.models.mata_kuliah import MataKuliah
from app.models.mk_bentuk_penilaian import MKBentukPenilaian
from app.models.mk_bentuk_penilaian_ik_map import MKBentukPenilaianIKMap
from app.models.nilai_bentuk_penilaian import NilaiBentukPenilaian
from app.models.pengampu_mata_kuliah import PengampuMataKuliah
from app.models.portofolio import PortofolioInfo, RPPPertemuan
from app.models.rps import RPS
from app.services.skala_nilai import KelompokSkala, muat_kelompok, pilih_kelompok
from app.models.user import User
from app.services.portofolio import capaian_mata_kuliah, evaluasi_cpmk
from app.services.portofolio_aturan import AturanPortofolio, aturan_prodi

# --- Gaya ---------------------------------------------------------------------

FONT = "Arial"
NAVY = "1A3A6B"
F_BIASA = Font(name=FONT, size=10)
F_TEBAL = Font(name=FONT, size=10, bold=True)
F_JUDUL = Font(name=FONT, size=14, bold=True, color=NAVY)
F_SUBJUDUL = Font(name=FONT, size=11, bold=True, color=NAVY)
F_HEADER = Font(name=FONT, size=10, bold=True, color="FFFFFF")
F_INPUT = Font(name=FONT, size=10, color="0000FF")
F_CATATAN = Font(name=FONT, size=9, italic=True, color="64748B")
FILL_HEADER = PatternFill("solid", fgColor=NAVY)
FILL_SUB = PatternFill("solid", fgColor="E2E8F0")
FILL_ISIAN = PatternFill("solid", fgColor="FFF7D6")
TIPIS = Side(style="thin", color="CBD5E1")
BORDER = Border(left=TIPIS, right=TIPIS, top=TIPIS, bottom=TIPIS)
WRAP = Alignment(wrap_text=True, vertical="top")
TENGAH = Alignment(horizontal="center", vertical="center", wrap_text=True)

FMT_NILAI = "0.00"
FMT_PERSEN = "0.0%"

# Baris pertama data mahasiswa di semua sheet per-mahasiswa.
BARIS_HEADER = 7
BARIS_DATA = 10

# Sel parameter (sheet PARAMETER)
P_SHEET = "PARAMETER"
P_AMBANG = f"{P_SHEET}!$B$4"
P_TARGET_SKOR = f"{P_SHEET}!$B$5"
P_TARGET_PERSEN = f"{P_SHEET}!$B$6"
P_RUBRIK_BARIS = 9


def _q(nama: str) -> str:
    """Nama sheet dalam rumus selalu dikutip."""
    return "'" + nama.replace("'", "''") + "'"


def _kol(i: int) -> str:
    return get_column_letter(i)


def _set(ws: Worksheet, ref: str, value, font=F_BIASA, fmt=None, align=None, fill=None, border=False):
    c = ws[ref]
    c.value = value
    c.font = font
    if fmt:
        c.number_format = fmt
    if align:
        c.alignment = align
    if fill:
        c.fill = fill
    if border:
        c.border = BORDER
    return c


def _header(ws: Worksheet, row: int, col: int, text: str, width: float | None = None):
    c = ws.cell(row=row, column=col, value=text)
    c.font = F_HEADER
    c.fill = FILL_HEADER
    c.alignment = TENGAH
    c.border = BORDER
    if width:
        ws.column_dimensions[_kol(col)].width = width
    return c


def _sel(ws: Worksheet, row: int, col: int, value, fmt=None, font=F_BIASA, align=None, fill=None):
    c = ws.cell(row=row, column=col, value=value)
    c.font = font
    c.border = BORDER
    if fmt:
        c.number_format = fmt
    if align:
        c.alignment = align
    if fill:
        c.fill = fill
    return c


def _nama_sheet(nama: str, terpakai: set[str]) -> str:
    bersih = re.sub(r"[\[\]:*?/\\']", " ", nama).strip()[:31] or "Sheet"
    hasil, i = bersih, 2
    while hasil.upper() in terpakai:
        akhiran = f" {i}"
        hasil = bersih[: 31 - len(akhiran)] + akhiran
        i += 1
    terpakai.add(hasil.upper())
    return hasil


def _f(v) -> float | None:
    return None if v is None else float(v)


def _semester(mk: MataKuliah) -> str:
    return str(getattr(mk.semester, "value", mk.semester) or "")


# --- Pengumpulan data -----------------------------------------------------------

@dataclass
class Kolom:
    id: int
    kode: str
    deskripsi: str = ""


@dataclass
class SelMatriks:
    mbp_id: int
    bentuk: str
    ik_id: int
    ik_kode: str
    bobot: float


@dataclass
class JenisBlok:
    nama: str
    sel: list[SelMatriks] = field(default_factory=list)

    @property
    def bobot_total(self) -> float:
        return sum(s.bobot for s in self.sel)


@dataclass
class DataPortofolio:
    mk: MataKuliah
    aturan: AturanPortofolio
    prodi_nama: str
    fakultas_nama: str
    pengampu: list[User]
    koordinator: User | None
    kaprodi: User | None
    dekan: User | None
    cpmk: list[CPMK]
    cpmk_ik: dict[int, list[tuple[IK, float]]]
    cpl: list[CPL]
    ik: list[IK]
    jenis: list[JenisBlok]
    kelompok_skala: list[KelompokSkala]          # skala huruf per rentang angkatan
    capaian: dict
    nilai: dict[int, dict[tuple[int, int], float]]   # peserta_id -> (mbp_id, ik_id) -> nilai
    ik_persen: dict[int, dict[int, float]]           # mahasiswa_id -> ik_id -> persen
    rps_konten: dict | None
    rpp: list[RPPPertemuan]
    evaluasi: dict
    info: PortofolioInfo | None = None

    @property
    def deskripsi_mk(self) -> str | None:
        return (self.info.deskripsi if self.info else None) or (self.rps_konten or {}).get("deskripsi_mk") or None


def kumpulkan_data(db: Session, mk: MataKuliah) -> DataPortofolio:
    prodi = mk.program_studi
    aturan = aturan_prodi(db, mk.program_studi_id)

    pengampu_rows = (
        db.query(PengampuMataKuliah, User)
        .join(User, User.id == PengampuMataKuliah.user_id)
        .filter(PengampuMataKuliah.mata_kuliah_id == mk.id)
        .order_by(User.nama)
        .all()
    )
    pengampu = [u for _, u in pengampu_rows]
    koordinator = next(
        (u for p, u in pengampu_rows if str(p.is_koordinator).strip().lower() in ("1", "true")),
        pengampu[0] if pengampu else None,
    )
    kaprodi = (
        db.query(User)
        .filter(User.role == UserRole.kaprodi, User.program_studi_id == mk.program_studi_id, User.is_active.is_(True))
        .first()
    )
    dekan = None
    if prodi and prodi.fakultas_id:
        dekan = (
            db.query(User)
            .filter(User.role == UserRole.dekan, User.fakultas_id == prodi.fakultas_id, User.is_active.is_(True))
            .first()
        )

    cpmk = db.query(CPMK).filter(CPMK.mata_kuliah_id == mk.id).order_by(CPMK.kode).all()
    cpmk_ik: dict[int, list[tuple[IK, float]]] = defaultdict(list)
    ik_by_id: dict[int, IK] = {}
    if cpmk:
        for m, ik in (
            db.query(CPMKIKMap, IK)
            .join(IK, IK.id == CPMKIKMap.ik_id)
            .filter(CPMKIKMap.cpmk_id.in_([c.id for c in cpmk]))
            .order_by(IK.kode)
            .all()
        ):
            cpmk_ik[m.cpmk_id].append((ik, float(m.bobot)))
            ik_by_id[ik.id] = ik

    # Matriks bentuk penilaian × IK, dikelompokkan per jenis evaluasi
    blok: dict[int, JenisBlok] = {}
    urutan_jenis: dict[int, tuple] = {}
    mbp_list = (
        db.query(MKBentukPenilaian)
        .filter(MKBentukPenilaian.mata_kuliah_id == mk.id)
        .order_by(MKBentukPenilaian.id)
        .all()
    )
    matriks_mbp: dict[int, list[int]] = {}
    for mbp in mbp_list:
        bp = mbp.bentuk_penilaian
        je = bp.jenis_evaluasi if bp else None
        je_id = je.id if je else 0
        if je_id not in blok:
            blok[je_id] = JenisBlok(nama=je.nama if je else "Lainnya")
            urutan_jenis[je_id] = (je.urutan if je and je.urutan is not None else 999, blok[je_id].nama)
        maps = (
            db.query(MKBentukPenilaianIKMap, IK)
            .join(IK, IK.id == MKBentukPenilaianIKMap.ik_id)
            .filter(MKBentukPenilaianIKMap.mk_bentuk_penilaian_id == mbp.id)
            .order_by(IK.kode)
            .all()
        )
        matriks_mbp[mbp.id] = [ik.id for _, ik in maps]
        for m, ik in maps:
            ik_by_id[ik.id] = ik
            blok[je_id].sel.append(SelMatriks(
                mbp_id=mbp.id, bentuk=bp.nama if bp else f"Bentuk {mbp.id}",
                ik_id=ik.id, ik_kode=ik.kode, bobot=float(m.bobot),
            ))
    jenis = [blok[k] for k in sorted(blok, key=lambda k: urutan_jenis[k]) if blok[k].sel]

    ik_list = sorted(ik_by_id.values(), key=lambda i: i.kode)
    cpl_ids = {i.cpl_id for i in ik_list}
    cpl = db.query(CPL).filter(CPL.id.in_(cpl_ids)).order_by(CPL.kode).all() if cpl_ids else []

    kelompok_skala = muat_kelompok(db, mk.kurikulum_version_id)

    capaian = capaian_mata_kuliah(db, mk)
    peserta_ids = [m["peserta_id"] for m in capaian["mahasiswa"]]

    nilai: dict[int, dict[tuple[int, int], float]] = defaultdict(dict)
    if peserta_ids:
        for n in db.query(NilaiBentukPenilaian).filter(NilaiBentukPenilaian.peserta_mata_kuliah_id.in_(peserta_ids)):
            if n.ik_id is not None:
                nilai[n.peserta_mata_kuliah_id][(n.mk_bentuk_penilaian_id, n.ik_id)] = float(n.nilai)
            else:
                # Nilai lama tanpa IK berlaku untuk semua IK pada bentuk itu (sama seperti mesin kalkulasi).
                for ik_id in matriks_mbp.get(n.mk_bentuk_penilaian_id, []):
                    nilai[n.peserta_mata_kuliah_id][(n.mk_bentuk_penilaian_id, ik_id)] = float(n.nilai)

    bobot_ik: dict[int, float] = defaultdict(float)
    for j in jenis:
        for s in j.sel:
            bobot_ik[s.ik_id] += s.bobot
    ik_persen: dict[int, dict[int, float]] = defaultdict(dict)
    for a in db.query(IKAchievement).filter(IKAchievement.mata_kuliah_id == mk.id):
        if bobot_ik.get(a.ik_id):
            ik_persen[a.mahasiswa_id][a.ik_id] = round(float(a.nilai) / bobot_ik[a.ik_id] * 100, 2)

    rps = db.query(RPS).filter(RPS.mata_kuliah_id == mk.id).order_by(RPS.id.desc()).first()
    rps_konten = rps.konten if rps and isinstance(rps.konten, dict) else None
    rpp = (
        db.query(RPPPertemuan)
        .filter(RPPPertemuan.mata_kuliah_id == mk.id)
        .order_by(RPPPertemuan.pertemuan_ke)
        .all()
    )

    return DataPortofolio(
        mk=mk,
        aturan=aturan,
        prodi_nama=prodi.nama if prodi else "",
        fakultas_nama=prodi.fakultas.nama if prodi and prodi.fakultas else "",
        pengampu=pengampu,
        koordinator=koordinator,
        kaprodi=kaprodi,
        dekan=dekan,
        cpmk=cpmk,
        cpmk_ik=cpmk_ik,
        cpl=cpl,
        ik=ik_list,
        jenis=jenis,
        kelompok_skala=kelompok_skala,
        capaian=capaian,
        nilai=nilai,
        ik_persen=ik_persen,
        rps_konten=rps_konten,
        rpp=rpp,
        evaluasi=evaluasi_cpmk(db, mk, aturan, capaian),
        info=db.query(PortofolioInfo).filter(PortofolioInfo.mata_kuliah_id == mk.id).first(),
    )


# --- Bagian umum ----------------------------------------------------------------

def _identitas(ws: Worksheet, d: DataPortofolio, judul: str, lebar_label: float = 16):
    _set(ws, "A1", judul, F_JUDUL)
    baris = [
        ("Mata Kuliah", f"{d.mk.kode} - {d.mk.nama}"),
        ("Tahun Ajaran", d.mk.tahun_ajaran or ""),
        ("Semester", _semester(d.mk)),
        ("Program Studi", d.prodi_nama),
    ]
    for i, (label, nilai) in enumerate(baris, start=2):
        _set(ws, f"A{i}", label, F_TEBAL)
        _set(ws, f"B{i}", nilai)
    if ws.column_dimensions["A"].width < lebar_label:
        ws.column_dimensions["A"].width = lebar_label


def _nama_pengampu(d: DataPortofolio) -> str:
    return "; ".join(u.nama or u.email or "-" for u in d.pengampu)


# --- Sheet ------------------------------------------------------------------------

def _sheet_parameter(wb: Workbook, d: DataPortofolio) -> dict:
    ws = wb.create_sheet(P_SHEET)
    a = d.aturan
    _set(ws, "A1", "PARAMETER PENILAIAN", F_JUDUL)
    _set(ws, "A2", "Aturan yang dipakai semua rumus di workbook ini. Angka biru dapat diubah; "
                   "seluruh rekap akan menyesuaikan.", F_CATATAN)
    _set(ws, "A4", "Ambang nilai CPMK/CPL (0-100)", F_TEBAL)
    _set(ws, "B4", a.ambang_cpmk, F_INPUT, FMT_NILAI, border=True)
    _set(ws, "A5", "Target rerata skor rubrik", F_TEBAL)
    _set(ws, "B5", a.target_rerata_skala, F_INPUT, FMT_NILAI, border=True)
    _set(ws, "A6", "Target % mahasiswa ≥ ambang", F_TEBAL)
    _set(ws, "B6", a.target_persen / 100, F_INPUT, FMT_PERSEN, border=True)
    _set(ws, "C4", "Mahasiswa REMIDI bila nilai akhir ≥ ambang tetapi ada CPMK < ambang; "
                   "TIDAK LULUS bila nilai akhir < ambang.", F_CATATAN)

    for i, h in enumerate(("Tingkat Rubrik", "Batas Bawah", "Skor"), start=1):
        _header(ws, P_RUBRIK_BARIS - 1, i, h)
    for i, t in enumerate(a.rubrik):
        r = P_RUBRIK_BARIS + i
        _sel(ws, r, 1, t.nama)
        _sel(ws, r, 2, t.batas_bawah, FMT_NILAI, F_INPUT)
        _sel(ws, r, 3, t.skor, None, F_INPUT)
    r_akhir_rubrik = P_RUBRIK_BARIS + len(a.rubrik) - 1

    # Skala huruf: satu tabel per kelompok angkatan (urut naik agar bisa dipakai LOOKUP).
    r = r_akhir_rubrik + 3
    skala_ref: dict[int, tuple[str, str]] = {}
    if not d.kelompok_skala:
        _set(ws, f"A{r - 1}", "Skala nilai huruf", F_SUBJUDUL)
        _set(ws, f"A{r}", "Skala nilai huruf kurikulum belum diatur di SADEWA.", F_CATATAN)
    for k in d.kelompok_skala:
        _set(ws, f"A{r - 1}", f"Skala nilai huruf — {k.label}", F_SUBJUDUL)
        _header(ws, r, 1, "Huruf")
        _header(ws, r, 2, "Batas Minimal")
        naik = list(reversed(k.skala))
        for i, (huruf, batas) in enumerate(naik, start=1):
            _sel(ws, r + i, 1, huruf, None, F_INPUT)
            _sel(ws, r + i, 2, float(batas), FMT_NILAI, F_INPUT)
        awal, akhir = r + 1, r + len(naik)
        skala_ref[id(k)] = (f"{P_SHEET}!$A${awal}:$A${akhir}", f"{P_SHEET}!$B${awal}:$B${akhir}")
        r = akhir + 3

    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 10
    return {
        "rubrik_batas": f"{P_SHEET}!$B${P_RUBRIK_BARIS}:$B${r_akhir_rubrik}",
        "rubrik_skor": f"{P_SHEET}!$C${P_RUBRIK_BARIS}:$C${r_akhir_rubrik}",
        # id(KelompokSkala) -> (rentang huruf, rentang batas)
        "skala": skala_ref,
    }


def _sheet_cover(wb: Workbook, d: DataPortofolio):
    ws = wb.active
    ws.title = "COVER"
    ws.column_dimensions["A"].width = 3
    ws.column_dimensions["B"].width = 26
    ws.column_dimensions["C"].width = 2
    ws.column_dimensions["D"].width = 40
    ws.column_dimensions["E"].width = 34
    _set(ws, "B3", settings.NAMA_INSTITUSI.upper(), F_JUDUL)
    _set(ws, "B4", (d.fakultas_nama or "").upper(), F_SUBJUDUL)
    _set(ws, "B6", "PORTOFOLIO MATA KULIAH", Font(name=FONT, size=16, bold=True, color=NAVY))
    baris = [
        ("Program Studi", d.prodi_nama),
        ("Kode/Nama Mata Kuliah", f"{d.mk.kode} - {d.mk.nama}"),
        ("Mata Kuliah Prasyarat", (d.info.prasyarat if d.info else None) or "-"),
        ("SKS", d.mk.sks),
        ("Semester", _semester(d.mk)),
        ("Tahun Ajaran", d.mk.tahun_ajaran or ""),
        ("Dosen Pengampu", _nama_pengampu(d)),
        ("Jumlah Peserta", d.capaian["jumlah_peserta"]),
    ]
    for i, (label, nilai) in enumerate(baris, start=8):
        _set(ws, f"B{i}", label, F_TEBAL)
        _set(ws, f"C{i}", ":")
        _set(ws, f"D{i}", nilai, align=Alignment(horizontal="left", wrap_text=True))

    def ttd(row: int, col: str, peran: str, nama: str | None, nip: str | None):
        _set(ws, f"{col}{row}", peran, F_TEBAL)
        _set(ws, f"{col}{row + 4}", nama or "", F_TEBAL, fill=None if nama else FILL_ISIAN)
        _set(ws, f"{col}{row + 5}", f"NIP. {nip}" if nip else "NIP. ", fill=None if nip else FILL_ISIAN)

    def dari(user: User | None) -> tuple[str | None, str | None]:
        return (user.nama, user.nip) if user else (None, None)

    _set(ws, "B17", "Diperiksa oleh,")
    ttd(18, "B", "Ketua GPM,", d.aturan.gpm_nama, d.aturan.gpm_nip)
    _set(ws, "E17", "Koordinator/Dosen Pengampu,")
    ttd(18, "E", "", *dari(d.koordinator))
    _set(ws, "B25", "Disahkan oleh,")
    ttd(26, "B", "Dekan", *dari(d.dekan))
    _set(ws, "E25", "Disetujui oleh,")
    ttd(26, "E", "Ketua Program Studi", *dari(d.kaprodi))

    info = d.info
    tanggal = info.tanggal_terbit.strftime("%d-%m-%Y") if info and info.tanggal_terbit else None
    dokumen = [
        ("No. Dokumen", info.no_dokumen if info else None),
        ("Revisi", info.revisi if info else None),
        ("Tanggal Terbit", tanggal),
    ]
    for i, (label, nilai) in enumerate(dokumen, start=34):
        _set(ws, f"B{i}", label, F_TEBAL)
        _set(ws, f"C{i}", ":")
        _set(ws, f"D{i}", nilai, fill=None if nilai else FILL_ISIAN)
    _set(ws, "B38", "Sel kuning belum diisi: lengkapi di SADEWA (Portofolio › Data Portofolio; "
                    "Ketua GPM di Aturan Penilaian) atau isi manual.", F_CATATAN)


def _sheet_cpmk_cpl(wb: Workbook, d: DataPortofolio):
    ws = wb.create_sheet("CPMK-CPL")
    _identitas(ws, d, "CAPAIAN PEMBELAJARAN MATA KULIAH & KORELASI CPL")
    r = BARIS_HEADER
    heads = [("No", 5), ("CPMK", 10), ("Deskripsi CPMK", 60), ("Level Taksonomi", 11),
             ("Bobot CPMK (%)", 11), ("Indikator Kinerja (PI) [bobot]", 30), ("CPL", 14)]
    for i, (h, w) in enumerate(heads, start=1):
        _header(ws, r, i, h, w)
    cpl_by_id = {c.id: c for c in d.cpl}
    for i, c in enumerate(d.cpmk, start=1):
        row = r + i
        maps = d.cpmk_ik.get(c.id, [])
        _sel(ws, row, 1, i, align=TENGAH)
        _sel(ws, row, 2, c.kode)
        _sel(ws, row, 3, c.deskripsi, align=WRAP)
        _sel(ws, row, 4, c.level_taksonomi or "", align=TENGAH)
        _sel(ws, row, 5, _f(c.bobot), FMT_NILAI)
        _sel(ws, row, 6, "\n".join(f"{ik.kode} [{b:g}]" for ik, b in maps), align=WRAP)
        _sel(ws, row, 7, "\n".join(sorted({cpl_by_id[ik.cpl_id].kode for ik, _ in maps if ik.cpl_id in cpl_by_id})), align=WRAP)
    if d.cpmk:
        row = r + len(d.cpmk) + 1
        _sel(ws, row, 4, "TOTAL", font=F_TEBAL)
        _sel(ws, row, 5, f"=SUM(E{r + 1}:E{row - 1})", FMT_NILAI, F_TEBAL)
    else:
        _set(ws, f"A{r + 1}", "Belum ada CPMK untuk mata kuliah ini.", F_CATATAN)

    # Matriks CPMK × CPL berisi kode IK
    r = r + len(d.cpmk) + 4
    _set(ws, f"A{r - 1}", "Matriks korelasi CPMK – CPL (isi sel: Indikator Kinerja)", F_SUBJUDUL)
    _header(ws, r, 2, "CPMK")
    for j, cpl in enumerate(d.cpl):
        _header(ws, r, 3 + j, cpl.kode)
    for i, c in enumerate(d.cpmk, start=1):
        _sel(ws, r + i, 2, c.kode)
        for j, cpl in enumerate(d.cpl):
            kode = [ik.kode for ik, _ in d.cpmk_ik.get(c.id, []) if ik.cpl_id == cpl.id]
            _sel(ws, r + i, 3 + j, ", ".join(kode), align=TENGAH)

    # Daftar CPL & IK
    r = r + len(d.cpmk) + 4
    _set(ws, f"A{r - 1}", "Capaian Pembelajaran Lulusan & Indikator Kinerja terkait", F_SUBJUDUL)
    _header(ws, r, 2, "Kode")
    _header(ws, r, 3, "Deskripsi")
    row = r
    for cpl in d.cpl:
        row += 1
        _sel(ws, row, 2, cpl.kode, font=F_TEBAL)
        _sel(ws, row, 3, cpl.deskripsi, align=WRAP, font=F_TEBAL)
        for ik in (i for i in d.ik if i.cpl_id == cpl.id):
            row += 1
            _sel(ws, row, 2, ik.kode)
            _sel(ws, row, 3, ik.deskripsi, align=WRAP)
    ws.freeze_panes = f"A{BARIS_HEADER + 1}"


def _sheet_rps(wb: Workbook, d: DataPortofolio):
    ws = wb.create_sheet("RPS")
    _identitas(ws, d, "RENCANA PEMBELAJARAN SEMESTER")
    _set(ws, "D2", "Dosen Pengampu", F_TEBAL)
    _set(ws, "E2", _nama_pengampu(d))
    _set(ws, "D3", "SKS", F_TEBAL)
    _set(ws, "E3", d.mk.sks)

    konten = d.rps_konten or {}
    pertemuan = {int(p.get("minggu") or 0): p for p in konten.get("pertemuan") or [] if isinstance(p, dict)}
    rpp = {p.pertemuan_ke: p for p in d.rpp}
    minggu = sorted(set(pertemuan) | set(rpp))
    r = BARIS_HEADER
    if d.deskripsi_mk:
        _set(ws, f"A{r - 1}", "Deskripsi: " + str(d.deskripsi_mk), F_BIASA, align=WRAP)
        ws.merge_cells(start_row=r - 1, start_column=1, end_row=r - 1, end_column=12)
        ws.row_dimensions[r - 1].height = 45
    heads = [("Minggu ke-", 8), ("CPMK", 10), ("Kemampuan Akhir / Sub-CPMK", 34), ("Bahan Kajian / Materi", 38),
             ("Metode Pembelajaran", 22), ("Waktu", 12), ("Pengalaman Belajar Mahasiswa", 30),
             ("Indikator & Kriteria Penilaian", 30), ("Bobot Penilaian (%)", 11), ("Tanggal (RPP)", 12),
             ("Realisasi (RPP)", 34), ("Catatan (RPP)", 22)]
    for i, (h, w) in enumerate(heads, start=1):
        _header(ws, r, i, h, w)
    for i, m in enumerate(minggu, start=1):
        row = r + i
        p = pertemuan.get(m, {})
        q = rpp.get(m)
        _sel(ws, row, 1, m, align=TENGAH)
        _sel(ws, row, 2, p.get("cpmk") or (q.cpmk if q else "") or "", align=TENGAH)
        _sel(ws, row, 3, p.get("sub_cpmk") or "", align=WRAP)
        _sel(ws, row, 4, p.get("materi") or (q.materi if q else "") or "", align=WRAP)
        _sel(ws, row, 5, p.get("metode") or (q.metode if q else "") or "", align=WRAP)
        _sel(ws, row, 6, (q.waktu if q else "") or "", align=TENGAH)
        _sel(ws, row, 7, (q.pengalaman_belajar if q else "") or "", align=WRAP)
        _sel(ws, row, 8, (q.indikator_kriteria if q else "") or "", align=WRAP)
        _sel(ws, row, 9, _f(p.get("bobot")) if p.get("bobot") is not None else None, FMT_NILAI)
        _sel(ws, row, 10, q.tanggal if q and q.tanggal else None, "dd/mm/yyyy")
        _sel(ws, row, 11, (q.realisasi if q else "") or "", align=WRAP)
        _sel(ws, row, 12, (q.catatan if q else "") or "", align=WRAP)
    if minggu:
        row = r + len(minggu) + 1
        _sel(ws, row, 8, "TOTAL", font=F_TEBAL)
        _sel(ws, row, 9, f"=SUM(I{r + 1}:I{row - 1})", FMT_NILAI, F_TEBAL)
    else:
        _set(ws, f"A{r + 1}", "Belum ada draf RPS (AI) maupun RPP untuk mata kuliah ini.", F_CATATAN)
    row = r + len(minggu) + 3
    _set(ws, f"A{row}", "Waktu, Pengalaman Belajar, Indikator & Kriteria, dan Realisasi diisi di Portofolio › Input RPP. "
                        "Dokumen RPS resmi (PDF/Word) dapat diunduh dari menu Portofolio › Upload RPS.", F_CATATAN)
    if d.info and d.info.referensi:
        _set(ws, f"A{row + 2}", "Daftar Pustaka", F_SUBJUDUL)
        _set(ws, f"A{row + 3}", d.info.referensi, align=WRAP)
        ws.merge_cells(start_row=row + 3, start_column=1, end_row=row + 3, end_column=8)
        ws.row_dimensions[row + 3].height = 60
    ws.freeze_panes = f"A{BARIS_HEADER + 1}"


def _kontribusi_cpmk_jenis(d: DataPortofolio) -> dict[int, dict[str, float]]:
    """Bobot (poin dari 100) yang disumbang setiap jenis evaluasi kepada setiap CPMK."""
    total_ik: dict[int, float] = defaultdict(float)
    for maps in d.cpmk_ik.values():
        for ik, b in maps:
            total_ik[ik.id] += b
    hasil: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for j in d.jenis:
        for s in j.sel:
            for c in d.cpmk:
                for ik, b in d.cpmk_ik.get(c.id, []):
                    if ik.id == s.ik_id and total_ik[ik.id]:
                        hasil[c.id][j.nama] += s.bobot * b / total_ik[ik.id]
    return hasil


def _sheet_kontrak(wb: Workbook, d: DataPortofolio):
    ws = wb.create_sheet("KONTRAK")
    _identitas(ws, d, "KONTRAK PERKULIAHAN")
    _set(ws, "D2", "Dosen Pengampu", F_TEBAL)
    _set(ws, "E2", _nama_pengampu(d))
    ws.column_dimensions["B"].width = 22
    r = BARIS_HEADER
    info = d.info
    isian = [
        ("1. Manfaat Perkuliahan", info.manfaat if info else None),
        ("2. Deskripsi Perkuliahan", d.deskripsi_mk),
        ("3. Strategi Perkuliahan", info.strategi if info else None),
        ("4. Tata Tertib", info.tata_tertib if info else None),
        ("Waktu & Tempat Kuliah", info.waktu_tempat if info else None),
        ("Bahan Bacaan / Referensi", info.referensi if info else None),
    ]
    for label, nilai in isian:
        _set(ws, f"A{r}", label, F_TEBAL)
        c = _set(ws, f"B{r}", nilai, align=WRAP, fill=None if nilai else FILL_ISIAN)
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=8)
        ws.row_dimensions[r].height = min(160, 15 * (1 + len(nilai) // 110 + nilai.count("\n"))) if nilai else 30
        c.border = BORDER
        r += 1

    # Matriks bobot CPMK × jenis evaluasi
    r += 2
    _set(ws, f"A{r - 1}", "5. Penilaian & Kriteria — kontribusi setiap jenis evaluasi terhadap CPMK (porsi nilai akhir)",
         F_SUBJUDUL)
    kontrib = _kontribusi_cpmk_jenis(d)
    _header(ws, r, 1, "CPMK")
    for j, je in enumerate(d.jenis):
        _header(ws, r, 2 + j, je.nama, 14)
    kol_total = 2 + len(d.jenis)
    _header(ws, r, kol_total, "TOTAL", 12)
    for i, c in enumerate(d.cpmk, start=1):
        row = r + i
        _sel(ws, row, 1, c.kode)
        for j, je in enumerate(d.jenis):
            v = kontrib.get(c.id, {}).get(je.nama)
            _sel(ws, row, 2 + j, round(v / 100, 6) if v else None, FMT_PERSEN)
        _sel(ws, row, kol_total, f"=SUM({_kol(2)}{row}:{_kol(kol_total - 1)}{row})", FMT_PERSEN, F_TEBAL)
    row_total = r + len(d.cpmk) + 1
    _sel(ws, row_total, 1, "TOTAL", font=F_TEBAL)
    for j in range(len(d.jenis) + 1):
        col = _kol(2 + j)
        _sel(ws, row_total, 2 + j, f"=SUM({col}{r + 1}:{col}{row_total - 1})", FMT_PERSEN, F_TEBAL)

    # Rincian bentuk penilaian
    r = row_total + 3
    _set(ws, f"A{r - 1}", "Rincian bentuk penilaian", F_SUBJUDUL)
    for i, h in enumerate(("Jenis Evaluasi", "Bentuk Penilaian", "Indikator Kinerja", "Bobot (poin)"), start=1):
        _header(ws, r, i, h)
    row = r
    for je in d.jenis:
        for s in je.sel:
            row += 1
            _sel(ws, row, 1, je.nama)
            _sel(ws, row, 2, s.bentuk)
            _sel(ws, row, 3, s.ik_kode)
            _sel(ws, row, 4, s.bobot, FMT_NILAI)
    if row > r:
        _sel(ws, row + 1, 3, "TOTAL", font=F_TEBAL)
        _sel(ws, row + 1, 4, f"=SUM(D{r + 1}:D{row})", FMT_NILAI, F_TEBAL)

    # Skala nilai huruf: satu tabel per kelompok angkatan, berdampingan
    r = row + 4
    _set(ws, f"A{r - 2}", "6. Konversi nilai angka ke huruf", F_SUBJUDUL)
    if not d.kelompok_skala:
        _set(ws, f"A{r}", "Skala nilai huruf belum diatur.", F_CATATAN)
    tinggi = 1
    for g, k in enumerate(d.kelompok_skala):
        col = 1 + g * 3
        _set(ws, f"{_kol(col)}{r - 1}", k.label, F_TEBAL)
        _header(ws, r, col, "Rentang Nilai Angka")
        _header(ws, r, col + 1, "Huruf")
        for i, (huruf, batas) in enumerate(k.skala, start=1):
            b = float(batas)
            atas = float(k.skala[i - 2][1]) - 0.01 if i > 1 else None
            rentang = f"≥ {b:g}" if atas is None else f"{b:g} – {atas:g}"
            _sel(ws, r + i, col, rentang)
            _sel(ws, r + i, col + 1, huruf, align=TENGAH)
        tinggi = max(tinggi, len(k.skala))
    ambang = d.aturan.ambang_cpmk
    _set(ws, f"A{r + tinggi + 1}", f"Ambang ketercapaian CPMK dan kelulusan nilai akhir: {ambang:g}.", F_CATATAN)

    # Jadwal
    r = r + tinggi + 4
    _set(ws, f"A{r - 1}", "7. Jadwal Perkuliahan", F_SUBJUDUL)
    _header(ws, r, 1, "Minggu ke-")
    _header(ws, r, 2, "Pokok Bahasan")
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=8)
    pertemuan = sorted(
        ((int(p.get("minggu") or 0), p.get("materi") or "") for p in (d.rps_konten or {}).get("pertemuan") or []
         if isinstance(p, dict)),
        key=lambda x: x[0],
    ) or [(p.pertemuan_ke, p.materi or "") for p in d.rpp]
    for i, (m, materi) in enumerate(pertemuan, start=1):
        _sel(ws, r + i, 1, m, align=TENGAH)
        c = _sel(ws, r + i, 2, materi, align=WRAP)
        ws.merge_cells(start_row=r + i, start_column=2, end_row=r + i, end_column=8)
        c.border = BORDER
    _set(ws, f"A{r + len(pertemuan) + 2}", "Sel kuning belum diisi: lengkapi di SADEWA (Portofolio › Data Portofolio) "
                                            "atau isi manual.", F_CATATAN)


def _sheet_nilai_jenis(wb: Workbook, d: DataPortofolio, je: JenisBlok, nama_sheet: str) -> str:
    """Satu sheet per jenis evaluasi. Mengembalikan alamat kolom nilai jenis (huruf kolom)."""
    ws = wb.create_sheet(nama_sheet)
    _identitas(ws, d, f"NILAI {je.nama.upper()}")
    for i, (h, w) in enumerate((("No", 5), ("NIM", 16), ("Nama Mahasiswa", 32)), start=1):
        _header(ws, BARIS_HEADER, i, h, w)
        ws.merge_cells(start_row=BARIS_HEADER, start_column=i, end_row=BARIS_HEADER + 1, end_column=i)
    _set(ws, f"C{BARIS_HEADER + 2}", "Bobot (poin) →", F_TEBAL, align=Alignment(horizontal="right"))

    col = 4
    awal_bentuk = col
    bentuk_aktif = None
    for s in je.sel:
        if s.mbp_id != bentuk_aktif:
            if bentuk_aktif is not None and col - 1 > awal_bentuk:
                ws.merge_cells(start_row=BARIS_HEADER, start_column=awal_bentuk, end_row=BARIS_HEADER, end_column=col - 1)
            _header(ws, BARIS_HEADER, col, s.bentuk)
            awal_bentuk, bentuk_aktif = col, s.mbp_id
        _header(ws, BARIS_HEADER + 1, col, s.ik_kode, 11)
        _sel(ws, BARIS_HEADER + 2, col, s.bobot, FMT_NILAI, F_TEBAL, TENGAH, FILL_SUB)
        col += 1
    if col - 1 > awal_bentuk:
        ws.merge_cells(start_row=BARIS_HEADER, start_column=awal_bentuk, end_row=BARIS_HEADER, end_column=col - 1)

    kol_nilai = col
    a, b = _kol(4), _kol(col - 1)
    _header(ws, BARIS_HEADER, kol_nilai, f"Nilai {je.nama} (0-100)", 14)
    ws.merge_cells(start_row=BARIS_HEADER, start_column=kol_nilai, end_row=BARIS_HEADER + 2, end_column=kol_nilai)

    for i, m in enumerate(d.capaian["mahasiswa"]):
        row = BARIS_DATA + i
        _sel(ws, row, 1, i + 1, align=TENGAH)
        _sel(ws, row, 2, m["nim"])
        _sel(ws, row, 3, m["nama"])
        nilai_mhs = d.nilai.get(m["peserta_id"], {})
        for k, s in enumerate(je.sel):
            _sel(ws, row, 4 + k, nilai_mhs.get((s.mbp_id, s.ik_id)), FMT_NILAI)
        _sel(
            ws, row, kol_nilai,
            f'=IF(COUNT({a}{row}:{b}{row})=0,"",'
            f"SUMPRODUCT({a}{row}:{b}{row},{a}${BARIS_HEADER + 2}:{b}${BARIS_HEADER + 2})"
            f"/SUM({a}${BARIS_HEADER + 2}:{b}${BARIS_HEADER + 2}))",
            FMT_NILAI, F_TEBAL,
        )
    _set(ws, "E2", "Nilai mentah 0-100 per bentuk penilaian × Indikator Kinerja. Nilai jenis = rata-rata "
                   "berbobot poin matriks.", F_CATATAN)
    ws.freeze_panes = ws.cell(row=BARIS_DATA, column=4)
    return _kol(kol_nilai)


def _sheet_form_nilai(wb: Workbook, d: DataPortofolio, ref_jenis: list[tuple[JenisBlok, str, str]], p: dict) -> dict:
    """Rekap nilai per mahasiswa. ref_jenis: (jenis, nama sheet, kolom nilai jenis di sheet itu)."""
    ws = wb.create_sheet("FORM NILAI")
    _identitas(ws, d, "FORM NILAI")
    heads = [("No", 5), ("NIM", 16), ("Nama Mahasiswa", 32), ("Kelas", 7), ("Angkatan", 9)]
    for i, (h, w) in enumerate(heads, start=1):
        _header(ws, BARIS_HEADER, i, h, w)
        ws.merge_cells(start_row=BARIS_HEADER, start_column=i, end_row=BARIS_HEADER + 1, end_column=i)
    _set(ws, f"E{BARIS_HEADER + 2}", "Bobot (%) →", F_TEBAL, align=Alignment(horizontal="right"))
    if len(d.kelompok_skala) > 1:
        _set(ws, "E2", "Huruf memakai skala sesuai angkatan mahasiswa (lihat sheet PARAMETER).", F_CATATAN)

    col = 6
    kol_jenis = []
    for je, sheet, kol in ref_jenis:
        _header(ws, BARIS_HEADER, col, f"Nilai {je.nama} (0-100)", 13)
        ws.merge_cells(start_row=BARIS_HEADER, start_column=col, end_row=BARIS_HEADER + 1, end_column=col)
        # Bobot jenis = jumlah poin matriks pada sheet jenisnya (tetap tersambung).
        n_sel = len(je.sel)
        _sel(ws, BARIS_HEADER + 2, col,
             f"=SUM({_q(sheet)}!$D${BARIS_HEADER + 2}:${_kol(3 + n_sel)}${BARIS_HEADER + 2})",
             FMT_NILAI, F_TEBAL, TENGAH, FILL_SUB)
        kol_jenis.append((col, sheet, kol))
        col += 1
    j_awal, j_akhir = (_kol(kol_jenis[0][0]), _kol(kol_jenis[-1][0])) if kol_jenis else (None, None)

    k_akhir, k_huruf, k_status = col, col + 1, col + 2
    for k, (h, w) in zip((k_akhir, k_huruf, k_status), (("Nilai Akhir (0-100)", 12), ("Huruf", 8), ("Status", 14))):
        _header(ws, BARIS_HEADER, k, h, w)
        ws.merge_cells(start_row=BARIS_HEADER, start_column=k, end_row=BARIS_HEADER + 1, end_column=k)
    k_cpmk0 = k_status + 1
    if d.cpmk:
        _header(ws, BARIS_HEADER, k_cpmk0, "Capaian CPMK (0-100)")
        if len(d.cpmk) > 1:
            ws.merge_cells(start_row=BARIS_HEADER, start_column=k_cpmk0, end_row=BARIS_HEADER,
                           end_column=k_cpmk0 + len(d.cpmk) - 1)
    for j, c in enumerate(d.cpmk):
        h = _header(ws, BARIS_HEADER + 1, k_cpmk0 + j, c.kode, 10)
        h.comment = Comment(c.deskripsi[:500], "SADEWA")
    c_awal, c_akhir = _kol(k_cpmk0), _kol(k_cpmk0 + max(len(d.cpmk), 1) - 1)

    for i, m in enumerate(d.capaian["mahasiswa"]):
        row = BARIS_DATA + i
        _sel(ws, row, 1, i + 1, align=TENGAH)
        _sel(ws, row, 2, m["nim"])
        _sel(ws, row, 3, m["nama"])
        _sel(ws, row, 4, m["kelas"], align=TENGAH)
        _sel(ws, row, 5, m.get("angkatan"), align=TENGAH)
        for c_idx, sheet, kol in kol_jenis:
            _sel(ws, row, c_idx, f"={_q(sheet)}!{kol}{row}", FMT_NILAI)
        akhir = _kol(k_akhir)
        if kol_jenis:
            _sel(ws, row, k_akhir,
                 f'=IF(COUNT({j_awal}{row}:{j_akhir}{row})=0,"",'
                 f"ROUND(SUMPRODUCT({j_awal}{row}:{j_akhir}{row},{j_awal}${BARIS_HEADER + 2}:{j_akhir}${BARIS_HEADER + 2})/100,2))",
                 FMT_NILAI, F_TEBAL)
        else:
            _sel(ws, row, k_akhir, m["nilai_akhir"], FMT_NILAI, F_TEBAL)
        kelompok = pilih_kelompok(d.kelompok_skala, m.get("angkatan"))
        ref = p["skala"].get(id(kelompok)) if kelompok else None
        if ref:
            rng_huruf, rng_batas = ref
            _sel(ws, row, k_huruf,
                 f'=IF({akhir}{row}="","",IFERROR(LOOKUP({akhir}{row},{rng_batas},{rng_huruf}),""))',
                 align=TENGAH, font=F_TEBAL)
        else:
            _sel(ws, row, k_huruf, m["nilai_huruf"], align=TENGAH, font=F_TEBAL)
        cek_cpmk = f'COUNTIF({c_awal}{row}:{c_akhir}{row},"<"&{P_AMBANG})>0' if d.cpmk else "FALSE"
        _sel(ws, row, k_status,
             f'=IF({akhir}{row}="","",IF({akhir}{row}<{P_AMBANG},"TIDAK LULUS",'
             f'IF({cek_cpmk},"REMIDI CPMK","LULUS")))',
             align=TENGAH)
        for j, c in enumerate(d.cpmk):
            _sel(ws, row, k_cpmk0 + j, m["cpmk"].get(str(c.id)), FMT_NILAI)

    # Sebaran nilai huruf (kanan tabel)
    n = len(d.capaian["mahasiswa"])
    r_akhir = BARIS_DATA + max(n, 1) - 1
    k0 = k_cpmk0 + max(len(d.cpmk), 1) + 1
    huruf_rng = f"${_kol(k_huruf)}${BARIS_DATA}:${_kol(k_huruf)}${r_akhir}"
    status_rng = f"${_kol(k_status)}${BARIS_DATA}:${_kol(k_status)}${r_akhir}"
    _set(ws, f"{_kol(k0)}{BARIS_HEADER - 1}", "Sebaran Nilai", F_SUBJUDUL)
    _header(ws, BARIS_HEADER, k0, "Huruf", 9)
    _header(ws, BARIS_HEADER, k0 + 1, "Jumlah", 9)
    _header(ws, BARIS_HEADER, k0 + 2, "Persen", 9)
    batas_tertinggi: dict[str, float] = {}
    for k in d.kelompok_skala:
        for h, b in k.skala:
            batas_tertinggi[h] = max(batas_tertinggi.get(h, -1.0), float(b))
    huruf_urut = sorted(batas_tertinggi, key=lambda h: -batas_tertinggi[h]) or sorted(
        {m["nilai_huruf"] for m in d.capaian["mahasiswa"] if m["nilai_huruf"]}
    )
    for i, h in enumerate(huruf_urut, start=1):
        row = BARIS_HEADER + i
        _sel(ws, row, k0, h, align=TENGAH)
        _sel(ws, row, k0 + 1, f'=COUNTIF({huruf_rng},{_kol(k0)}{row})')
        _sel(ws, row, k0 + 2,
             f'=IFERROR({_kol(k0 + 1)}{row}/COUNTIF({huruf_rng},"?*"),"")', FMT_PERSEN)
    r_status = BARIS_HEADER + len(huruf_urut) + 2
    for i, s in enumerate(("LULUS", "REMIDI CPMK", "TIDAK LULUS")):
        _sel(ws, r_status + i, k0, s)
        _sel(ws, r_status + i, k0 + 1, f'=COUNTIF({status_rng},"{s}")')
    _sel(ws, r_status + 3, k0, "Rata-rata", font=F_TEBAL)
    _sel(ws, r_status + 3, k0 + 1,
         f'=IFERROR(AVERAGE(${_kol(k_akhir)}${BARIS_DATA}:${_kol(k_akhir)}${r_akhir}),"")', FMT_NILAI, F_TEBAL)
    ws.column_dimensions[_kol(k0)].width = 13

    if huruf_urut:
        chart = BarChart()
        chart.title = "Sebaran Nilai Huruf"
        chart.y_axis.title = "Mahasiswa"
        chart.legend = None
        chart.add_data(Reference(ws, min_col=k0 + 1, min_row=BARIS_HEADER, max_row=BARIS_HEADER + len(huruf_urut)),
                       titles_from_data=True)
        chart.set_categories(Reference(ws, min_col=k0, min_row=BARIS_HEADER + 1,
                                       max_row=BARIS_HEADER + len(huruf_urut)))
        chart.height, chart.width = 7, 12
        ws.add_chart(chart, f"{_kol(k0)}{r_status + 6}")

    ws.freeze_panes = ws.cell(row=BARIS_DATA, column=5)
    return {"kol_cpmk": {c.id: _kol(k_cpmk0 + j) for j, c in enumerate(d.cpmk)},
            "kol_akhir": _kol(k_akhir), "kol_status": _kol(k_status)}


def _sheet_capaian(
    wb: Workbook, d: DataPortofolio, p: dict, nama: str, judul: str,
    kolom: list[Kolom], nilai_sel, label_kolom: str,
) -> dict[int, tuple[str, str]]:
    """
    Sheet capaian per mahasiswa (nilai 0-100 + skor rubrik) dan ringkasan per kolom
    dengan grafik. nilai_sel(row, mhs, kolom) -> angka atau rumus.
    Mengembalikan {kolom.id: (alamat rerata skor, alamat % tercapai)} untuk sheet EVALUASI.
    """
    ws = wb.create_sheet(nama)
    _identitas(ws, d, judul)
    mahasiswa = d.capaian["mahasiswa"]
    n, k = len(mahasiswa), len(kolom)
    for i, (h, w) in enumerate((("No", 5), ("NIM", 16), ("Nama Mahasiswa", 32)), start=1):
        _header(ws, BARIS_HEADER, i, h, w)
        ws.merge_cells(start_row=BARIS_HEADER, start_column=i, end_row=BARIS_HEADER + 2, end_column=i)
    if not kolom:
        _set(ws, f"A{BARIS_DATA}", f"Belum ada {label_kolom} yang terukur pada mata kuliah ini.", F_CATATAN)
        return {}

    k_nilai0, k_skor0 = 4, 4 + k + 1
    _header(ws, BARIS_HEADER, k_nilai0, "Nilai (0-100)")
    _header(ws, BARIS_HEADER, k_skor0, f"Skor Rubrik (1-{d.aturan.skor_maks})")
    if k > 1:
        ws.merge_cells(start_row=BARIS_HEADER, start_column=k_nilai0, end_row=BARIS_HEADER, end_column=k_nilai0 + k - 1)
        ws.merge_cells(start_row=BARIS_HEADER, start_column=k_skor0, end_row=BARIS_HEADER, end_column=k_skor0 + k - 1)
    for j, kol in enumerate(kolom):
        for base in (k_nilai0, k_skor0):
            h = _header(ws, BARIS_HEADER + 1, base + j, kol.kode, 10)
            ws.merge_cells(start_row=BARIS_HEADER + 1, start_column=base + j, end_row=BARIS_HEADER + 2,
                           end_column=base + j)
            if kol.deskripsi:
                h.comment = Comment(kol.deskripsi[:500], "SADEWA")
    ws.column_dimensions[_kol(k_skor0 - 1)].width = 3

    for i, m in enumerate(mahasiswa):
        row = BARIS_DATA + i
        _sel(ws, row, 1, i + 1, align=TENGAH)
        _sel(ws, row, 2, m["nim"])
        _sel(ws, row, 3, m["nama"])
        for j, kol in enumerate(kolom):
            _sel(ws, row, k_nilai0 + j, nilai_sel(row, m, kol), FMT_NILAI)
            ref = f"{_kol(k_nilai0 + j)}{row}"
            _sel(ws, row, k_skor0 + j,
                 f'=IF({ref}="","",LOOKUP({ref},{p["rubrik_batas"]},{p["rubrik_skor"]}))', align=TENGAH)

    # Ringkasan per kolom
    r_akhir = BARIS_DATA + max(n, 1) - 1
    s0 = k_skor0 + k + 1
    tingkat = d.aturan.rubrik
    judul_ring = ["Kode", "Rata-rata Nilai", "Rerata Skor", "% ≥ Ambang", "Memenuhi?"] + [t.nama for t in tingkat]
    _set(ws, f"{_kol(s0)}{BARIS_HEADER - 1}", f"Ringkasan per {label_kolom}", F_SUBJUDUL)
    for i, h in enumerate(judul_ring):
        _header(ws, BARIS_HEADER, s0 + i, h, 12)
    alamat: dict[int, tuple[str, str]] = {}
    for j, kol in enumerate(kolom):
        row = BARIS_HEADER + 1 + j
        nil = f"${_kol(k_nilai0 + j)}${BARIS_DATA}:${_kol(k_nilai0 + j)}${r_akhir}"
        skr = f"${_kol(k_skor0 + j)}${BARIS_DATA}:${_kol(k_skor0 + j)}${r_akhir}"
        rerata, persen = f"{_kol(s0 + 2)}{row}", f"{_kol(s0 + 3)}{row}"
        _sel(ws, row, s0, kol.kode, font=F_TEBAL)
        _sel(ws, row, s0 + 1, f'=IFERROR(AVERAGE({nil}),"")', FMT_NILAI)
        _sel(ws, row, s0 + 2, f'=IFERROR(AVERAGE({skr}),"")', FMT_NILAI)
        _sel(ws, row, s0 + 3, f'=IFERROR(COUNTIF({nil},">="&{P_AMBANG})/COUNT({nil}),"")', FMT_PERSEN)
        _sel(ws, row, s0 + 4,
             f'=IF({rerata}="","",IF(AND({rerata}>={P_TARGET_SKOR},{persen}>={P_TARGET_PERSEN}),"YA","TIDAK"))',
             align=TENGAH)
        for t_idx, t in enumerate(tingkat):
            _sel(ws, row, s0 + 5 + t_idx, f"=COUNTIF({skr},{t.skor})", align=TENGAH)
        alamat[kol.id] = (f"{_q(nama)}!{rerata}", f"{_q(nama)}!{persen}")

    r_kat_awal, r_kat_akhir = BARIS_HEADER + 1, BARIS_HEADER + k
    kategori = Reference(ws, min_col=s0, min_row=r_kat_awal, max_row=r_kat_akhir)

    g1 = BarChart()
    g1.title = f"Rerata Skor {label_kolom} (target {d.aturan.target_rerata_skala:g})"
    g1.y_axis.title = "Skor"
    g1.y_axis.scaling.min = 0
    g1.y_axis.scaling.max = d.aturan.skor_maks or None
    g1.legend = None
    g1.add_data(Reference(ws, min_col=s0 + 2, min_row=BARIS_HEADER, max_row=r_kat_akhir), titles_from_data=True)
    g1.set_categories(kategori)
    g1.dataLabels = DataLabelList()
    g1.dataLabels.showVal = True
    g1.height, g1.width = 8, max(12, 2.2 * k)
    ws.add_chart(g1, f"{_kol(s0)}{r_kat_akhir + 3}")

    g2 = BarChart()
    g2.type = "col"
    g2.grouping = "stacked"
    g2.overlap = 100
    g2.title = f"Sebaran Tingkat Capaian per {label_kolom}"
    g2.y_axis.title = "Mahasiswa"
    g2.add_data(Reference(ws, min_col=s0 + 5, max_col=s0 + 4 + len(tingkat), min_row=BARIS_HEADER,
                          max_row=r_kat_akhir), titles_from_data=True)
    g2.set_categories(kategori)
    g2.height, g2.width = 8, max(12, 2.2 * k)
    ws.add_chart(g2, f"{_kol(s0)}{r_kat_akhir + 21}")

    ws.freeze_panes = ws.cell(row=BARIS_DATA, column=4)
    return alamat


def _sheet_remidi(wb: Workbook, d: DataPortofolio):
    ws = wb.create_sheet("REMIDI")
    _identitas(ws, d, "DAFTAR MAHASISWA REMIDI CPMK")
    ambang = d.aturan.ambang_cpmk
    _set(ws, "D2", f"Nilai akhir ≥ {ambang:g} tetapi ada CPMK < {ambang:g} (dihitung saat export).", F_CATATAN)
    heads = [("No", 5), ("NIM", 16), ("Nama Mahasiswa", 36), ("Kelas", 7), ("Nilai Akhir", 11),
             ("CPMK yang harus diremidi", 40)]
    for i, (h, w) in enumerate(heads, start=1):
        _header(ws, BARIS_HEADER, i, h, w)
    kode = {str(c.id): c.kode for c in d.cpmk}
    row = BARIS_HEADER
    for m in d.capaian["mahasiswa"]:
        if m["nilai_akhir"] is None or m["nilai_akhir"] < ambang:
            continue
        kurang = [kode[cid] for cid, v in m["cpmk"].items() if v is not None and v < ambang and cid in kode]
        if not kurang:
            continue
        row += 1
        _sel(ws, row, 1, row - BARIS_HEADER, align=TENGAH)
        _sel(ws, row, 2, m["nim"])
        _sel(ws, row, 3, m["nama"])
        _sel(ws, row, 4, m["kelas"], align=TENGAH)
        _sel(ws, row, 5, m["nilai_akhir"], FMT_NILAI)
        _sel(ws, row, 6, ", ".join(sorted(kurang)))
    if row == BARIS_HEADER:
        _set(ws, f"A{row + 1}", "Tidak ada mahasiswa yang perlu remidi CPMK.", F_CATATAN)


def _sheet_evaluasi(wb: Workbook, d: DataPortofolio, alamat_cpmk: dict[int, tuple[str, str]]):
    ws = wb.create_sheet("EVALUASI")
    _identitas(ws, d, "EVALUASI PEMENUHAN CPMK")
    r = BARIS_HEADER
    _set(ws, f"C{r - 1}", "Target (minimal)", F_TEBAL, align=Alignment(horizontal="right"))
    _set(ws, f"D{r - 1}", f"={P_TARGET_SKOR}", F_TEBAL, FMT_NILAI, border=True)
    _set(ws, f"E{r - 1}", f"={P_TARGET_PERSEN}", F_TEBAL, FMT_PERSEN, border=True)
    heads = [("No", 5), ("CPMK", 10), ("Deskripsi CPMK", 40), ("Rerata Skor", 11), ("% ≥ Ambang", 11),
             ("Memenuhi?", 11), ("Analisis Pelaksanaan Pembelajaran", 60), ("Rencana Perbaikan Semester Depan", 50)]
    for i, (h, w) in enumerate(heads, start=1):
        _header(ws, r, i, h, w)
    teks = {i["cpmk_id"]: i for i in d.evaluasi["items"]}
    for i, c in enumerate(d.cpmk, start=1):
        row = r + i
        rerata, persen = alamat_cpmk.get(c.id, (None, None))
        e = teks.get(c.id, {})
        _sel(ws, row, 1, i, align=TENGAH)
        _sel(ws, row, 2, c.kode, font=F_TEBAL)
        _sel(ws, row, 3, c.deskripsi, align=WRAP)
        _sel(ws, row, 4, f'=IF({rerata}="","",{rerata})' if rerata else None, FMT_NILAI)
        _sel(ws, row, 5, f'=IF({persen}="","",{persen})' if persen else None, FMT_PERSEN)
        _sel(ws, row, 6, f'=IF(D{row}="","",IF(AND(D{row}>=D${r - 1},E{row}>=E${r - 1}),"YA","TIDAK"))',
             align=TENGAH, font=F_TEBAL)
        _sel(ws, row, 7, e.get("analisis") or None, align=WRAP, fill=None if e.get("analisis") else FILL_ISIAN)
        _sel(ws, row, 8, e.get("rencana_perbaikan") or None, align=WRAP,
             fill=None if e.get("rencana_perbaikan") else FILL_ISIAN)
        ws.row_dimensions[row].height = 90
    _set(ws, f"A{r + len(d.cpmk) + 2}",
         "Teks analisis & rencana perbaikan diisi dosen di SADEWA (menu Portofolio › Evaluasi, dapat dibantu saran AI). "
         "Sel kuning belum diisi.", F_CATATAN)
    ws.freeze_panes = f"A{r + 1}"


# --- Entry point ------------------------------------------------------------------

def buat_workbook(db: Session, mk: MataKuliah) -> Workbook:
    d = kumpulkan_data(db, mk)
    wb = Workbook()
    _sheet_cover(wb, d)
    _sheet_cpmk_cpl(wb, d)
    _sheet_rps(wb, d)
    _sheet_kontrak(wb, d)

    terpakai = {"COVER", "CPMK-CPL", "RPS", "KONTRAK", "FORM NILAI", "CPMK", "PI-CPL", "CPL", "REMIDI",
                "EVALUASI", P_SHEET}
    ref_jenis = []
    for je in d.jenis:
        sheet = _nama_sheet(f"NILAI {je.nama.upper()}", terpakai)
        ref_jenis.append((je, sheet, _sheet_nilai_jenis(wb, d, je, sheet)))

    p = _sheet_parameter(wb, d)  # dibuat sekarang agar alamat rentangnya diketahui; dipindah ke akhir
    form = _sheet_form_nilai(wb, d, ref_jenis, p)

    alamat_cpmk = _sheet_capaian(
        wb, d, p, "CPMK", "CAPAIAN CPMK PER MAHASISWA",
        [Kolom(c.id, c.kode, c.deskripsi) for c in d.cpmk],
        lambda row, m, kol: f'=IF(\'FORM NILAI\'!{form["kol_cpmk"][kol.id]}{row}="","",'
                            f'\'FORM NILAI\'!{form["kol_cpmk"][kol.id]}{row})',
        "CPMK",
    )
    _sheet_capaian(
        wb, d, p, "PI-CPL", "CAPAIAN INDIKATOR KINERJA (PI) PER MAHASISWA",
        [Kolom(i.id, i.kode, i.deskripsi) for i in d.ik],
        lambda row, m, kol: d.ik_persen.get(m["mahasiswa_id"], {}).get(kol.id),
        "PI",
    )
    _sheet_capaian(
        wb, d, p, "CPL", "CAPAIAN CPL PER MAHASISWA (KONTRIBUSI MATA KULIAH INI)",
        [Kolom(c.id, c.kode, c.deskripsi) for c in d.cpl],
        lambda row, m, kol: m["cpl"].get(str(kol.id)),
        "CPL",
    )
    _sheet_remidi(wb, d)
    _sheet_evaluasi(wb, d, alamat_cpmk)

    wb.move_sheet(P_SHEET, offset=len(wb.sheetnames) - 1 - wb.sheetnames.index(P_SHEET))
    for ws in wb.worksheets:
        ws.sheet_view.zoomScale = 90
        ws.page_setup.orientation = "landscape"
        ws.page_setup.fitToWidth = 1
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToHeight = 0
    wb.calculation.fullCalcOnLoad = True
    wb.active = 0
    return wb


def export_portofolio(db: Session, mk: MataKuliah) -> tuple[bytes, str]:
    wb = buat_workbook(db, mk)
    buf = io.BytesIO()
    wb.save(buf)
    nama = re.sub(r'[\\/:*?"<>|]+', " ", f"Portofolio {mk.kode} {mk.nama} {mk.tahun_ajaran or ''} {_semester(mk)}")
    return buf.getvalue(), re.sub(r"\s+", " ", nama).strip() + ".xlsx"
