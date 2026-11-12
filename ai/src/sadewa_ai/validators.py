"""
Validasi keluaran LLM.

Aturan seperti "16 pertemuan", "UTS di minggu 8", dan "total bobot 100"
sebelumnya hanya dititipkan pada teks prompt. Instruksi di prompt bersifat
persuasif, bukan jaminan: bila model meleset, data cacat tetap lolos ke backend
dan ikut terpakai pada kalkulasi ketercapaian CPL/CPMK. Modul ini memeriksa
ulang struktur JSON setelah parsing, sehingga pelanggaran aturan tertangkap di
sisi kita sendiri.
"""

import re
from typing import Any, Dict, List, Tuple

from .config import settings

FIELD_WAJIB_RPS = ("kode_mk", "deskripsi_mk", "cpl", "cpmk", "penilaian", "pertemuan", "referensi")
FIELD_WAJIB_PERTEMUAN = (
    "kemampuan_akhir", "bahan_kajian_judul", "metode", "pengalaman_belajar", "target_cpmk", "kriteria_indikator",
)


def _as_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float("nan")


def _teks(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _daftar(value: Any) -> List[str]:
    """List string bersih. String tunggal dipecah per baris (LLM kadang tidak memakai array)."""
    if value is None:
        return []
    if isinstance(value, str):
        bagian = [b for b in re.split(r"\n+", value)]
    elif isinstance(value, (list, tuple)):
        bagian = [_teks(v) for v in value]
    else:
        bagian = [_teks(value)]
    return [re.sub(r"^\s*(?:[-•●*]|\d+[.)])\s+", "", b).strip() for b in bagian if b and b.strip()]


def kode_cpmk(value: Any) -> str:
    """'CPMK2.1', 'cpmk 2.1', '2.1' -> 'CPMK 2.1'."""
    s = _teks(value)
    if re.fullmatch(r"\d+(?:[.\-]\d+)*", s):
        return f"CPMK {s}"
    return re.sub(r"^cpmk\s*[-_]?\s*", "CPMK ", s, flags=re.IGNORECASE)


def kode_cpl(value: Any) -> str:
    s = _teks(value)
    if re.fullmatch(r"\d+", s):
        return f"CPL {s}"
    return re.sub(r"^cpl\s*[-_]?\s*", "CPL ", s, flags=re.IGNORECASE)


def _daftar_cpmk(value: Any) -> List[str]:
    """Target CPMK bisa berupa 'CPMK 2.1, 5.1' atau list; hasil: ['CPMK 2.1', 'CPMK 5.1']."""
    if isinstance(value, str):
        value = re.split(r"[,;\n]+", value)
    return [kode_cpmk(v) for v in _daftar(value) if _teks(v) and _teks(v) != "-"]


def rapikan_rps(data: Dict[str, Any], sks: int | None = None) -> Dict[str, Any]:
    """
    Rapikan JSON RPS hasil LLM ke bentuk baku (format 2) sebelum divalidasi:
    kode CPL/CPMK diseragamkan, field daftar dijadikan list, pertemuan diurutkan,
    minggu UTS/UAS dipaksa sesuai pengaturan, waktu dihitung dari SKS, dan bobot
    UTS/UAS pada tabel mingguan diambil dari Tabel Penilaian (pertemuan kuliah
    tidak berbobot). Bagian yang tidak bisa dipastikan dibiarkan untuk divalidasi.
    """
    if not isinstance(data, dict):
        return data
    data["format"] = 2

    data["cpl"] = [
        {
            "kode": kode_cpl(c.get("kode")),
            "deskripsi": _teks(c.get("deskripsi")),
            "label": _teks(c.get("label")).strip("() ").upper(),
        }
        for c in data.get("cpl") or [] if isinstance(c, dict)
    ]
    data["cpmk"] = [
        {"kode": kode_cpmk(c.get("kode")), "deskripsi": _teks(c.get("deskripsi"))}
        for c in data.get("cpmk") or [] if isinstance(c, dict)
    ]
    data["penilaian"] = [
        {
            "poin": _teks(p.get("poin")),
            "komponen": _teks(p.get("komponen")).rstrip(": "),
            "rincian": _daftar(p.get("rincian")),
            "bobot": p.get("bobot"),
            "cpmk": _daftar_cpmk(p.get("cpmk")),
        }
        for p in data.get("penilaian") or [] if isinstance(p, dict)
    ]
    data["referensi"] = _daftar(data.get("referensi"))

    def bobot_ujian(nama: str):
        for p in data["penilaian"]:
            if p["komponen"].upper() == nama:
                return p["bobot"]
        return None

    waktu = f"{sks} x 50 menit" if sks else ""
    pertemuan = []
    for p in data.get("pertemuan") or []:
        if not isinstance(p, dict):
            pertemuan.append(p)
            continue
        minggu = p.get("minggu")
        try:
            minggu = int(minggu)
        except (TypeError, ValueError):
            pass
        if minggu == settings.minggu_uts:
            pertemuan.append({"minggu": minggu, "jenis": "UTS", "bobot": bobot_ujian("UTS")})
            continue
        if minggu == settings.minggu_uas:
            pertemuan.append({"minggu": minggu, "jenis": "UAS", "bobot": bobot_ujian("UAS")})
            continue
        pertemuan.append({
            "minggu": minggu,
            "jenis": "kuliah",
            "kemampuan_akhir": _teks(p.get("kemampuan_akhir")),
            "bahan_kajian_judul": _teks(p.get("bahan_kajian_judul")).rstrip(": "),
            "bahan_kajian": _teks(p.get("bahan_kajian")),
            "metode": _teks(p.get("metode")),
            "waktu": waktu or _teks(p.get("waktu")),
            "pengalaman_belajar": _daftar(p.get("pengalaman_belajar")),
            "target_cpmk": _daftar_cpmk(p.get("target_cpmk")),
            "kriteria_indikator": _daftar(p.get("kriteria_indikator")),
            "bobot": None,
        })
    data["pertemuan"] = sorted(
        pertemuan, key=lambda x: x.get("minggu") if isinstance(x, dict) and isinstance(x.get("minggu"), int) else 999,
    )
    return data


def validate_rps(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Periksa struktur RPS (format 2: Kontrak Kuliah + RPS) setelah `rapikan_rps`.

    Mengembalikan (valid, daftar_pelanggaran). Daftar kosong berarti lolos semua.
    """
    errors: List[str] = []

    for field in FIELD_WAJIB_RPS:
        if field not in data:
            errors.append(f"Field wajib '{field}' tidak ada.")

    for field in ("cpl", "cpmk", "penilaian", "referensi"):
        nilai = data.get(field)
        if field in data and (not isinstance(nilai, list) or not nilai):
            errors.append(f"Field '{field}' harus berupa list dan tidak boleh kosong.")

    for c in data.get("cpl") or []:
        if isinstance(c, dict) and not (c.get("kode") and c.get("deskripsi") and c.get("label")):
            errors.append(f"CPL '{c.get('kode')}' harus punya kode, deskripsi, dan label.")
    for c in data.get("cpmk") or []:
        if isinstance(c, dict) and not (c.get("kode") and c.get("deskripsi")):
            errors.append(f"CPMK '{c.get('kode')}' harus punya kode dan deskripsi.")

    kode_terdaftar = {c.get("kode") for c in data.get("cpmk") or [] if isinstance(c, dict)}

    # Tabel penilaian (Kontrak Kuliah)
    penilaian = data.get("penilaian") or []
    bobot_total = sum(_as_float(p.get("bobot")) for p in penilaian if isinstance(p, dict))
    if penilaian:
        if bobot_total != bobot_total:  # NaN check
            errors.append("Ada bobot penilaian yang bukan angka.")
        elif abs(bobot_total - settings.bobot_total) > 0.01:
            errors.append(f"Total bobot penilaian {bobot_total:g}, seharusnya {settings.bobot_total}.")
        komponen = [str(p.get("komponen", "")).upper() for p in penilaian if isinstance(p, dict)]
        for ujian in ("UTS", "UAS"):
            if komponen.count(ujian) != 1:
                errors.append(f"Tabel penilaian harus punya tepat satu komponen '{ujian}'.")
        for p in penilaian:
            if not isinstance(p, dict):
                continue
            if not p.get("poin") or not p.get("komponen"):
                errors.append("Setiap baris penilaian harus punya 'poin' dan 'komponen'.")
            if not p.get("cpmk"):
                errors.append(f"Komponen penilaian '{p.get('komponen')}' belum mencantumkan CPMK yang dinilai.")
            for ref in p.get("cpmk") or []:
                if kode_terdaftar and ref not in kode_terdaftar:
                    errors.append(f"Komponen penilaian '{p.get('komponen')}' merujuk '{ref}' yang tidak ada di daftar cpmk.")

    pertemuan = data.get("pertemuan")
    if not isinstance(pertemuan, list):
        errors.append("Field 'pertemuan' harus berupa list.")
        return False, errors

    if len(pertemuan) != settings.jumlah_pertemuan:
        errors.append(f"Jumlah pertemuan {len(pertemuan)}, seharusnya {settings.jumlah_pertemuan}.")

    # Nomor minggu harus 1..16 tanpa duplikat dan tanpa bolong
    minggu_list = [item.get("minggu") for item in pertemuan if isinstance(item, dict)]
    harapan = set(range(1, settings.jumlah_pertemuan + 1))
    aktual = {m for m in minggu_list if isinstance(m, int)}
    duplikat = sorted({m for m in minggu_list if minggu_list.count(m) > 1}, key=str)
    if duplikat:
        errors.append(f"Nomor minggu duplikat: {duplikat}.")
    hilang = sorted(harapan - aktual)
    if hilang:
        errors.append(f"Nomor minggu tidak lengkap, hilang: {hilang}.")
    asing = sorted(m for m in aktual if m not in harapan)
    if asing:
        errors.append(f"Nomor minggu di luar rentang 1-{settings.jumlah_pertemuan}: {asing}.")

    for item in pertemuan:
        if not isinstance(item, dict):
            errors.append("Ada pertemuan yang bukan objek.")
            continue
        m = item.get("minggu")
        if item.get("jenis") in ("UTS", "UAS"):
            continue
        for field in FIELD_WAJIB_PERTEMUAN:
            if not item.get(field):
                errors.append(f"Pertemuan minggu {m}: field '{field}' kosong.")
        for ref in item.get("target_cpmk") or []:
            if kode_terdaftar and ref not in kode_terdaftar:
                errors.append(f"Minggu {m} merujuk CPMK '{ref}' yang tidak ada di daftar cpmk.")

    return len(errors) == 0, errors


FIELD_WAJIB_NARASI = (
    "ringkasan_capaian",
    "analisis_cpl",
    "faktor_penyebab",
    "rekomendasi_intervensi",
    "kesimpulan",
)


def validate_narasi(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Periksa struktur laporan narasi evaluasi."""
    errors: List[str] = []

    for field in FIELD_WAJIB_NARASI:
        if field not in data:
            errors.append(f"Field wajib '{field}' tidak ada.")

    for field in ("analisis_cpl", "faktor_penyebab", "rekomendasi_intervensi"):
        nilai = data.get(field)
        if field in data and (not isinstance(nilai, list) or not nilai):
            errors.append(f"Field '{field}' harus berupa list dan tidak boleh kosong.")

    for field in ("ringkasan_capaian", "kesimpulan"):
        nilai = data.get(field)
        if field in data and (not isinstance(nilai, str) or not nilai.strip()):
            errors.append(f"Field '{field}' harus berupa teks dan tidak boleh kosong.")

    return len(errors) == 0, errors


def validate_evaluasi_cpmk(data: Dict[str, Any], kode_wajib: List[str]) -> Tuple[bool, List[str]]:
    """Periksa saran evaluasi CPMK: setiap kode CPMK harus punya analisis dan rencana perbaikan."""
    errors: List[str] = []
    entri = data.get("evaluasi")
    if not isinstance(entri, list) or not entri:
        return False, ["Field 'evaluasi' harus berupa list dan tidak boleh kosong."]

    ada = set()
    for i, item in enumerate(entri):
        if not isinstance(item, dict):
            errors.append(f"Entri evaluasi ke-{i + 1} bukan objek.")
            continue
        kode = str(item.get("kode", "")).strip()
        ada.add(kode)
        for field in ("analisis", "rencana_perbaikan"):
            nilai = item.get(field)
            if not isinstance(nilai, str) or not nilai.strip():
                errors.append(f"{kode or f'Entri ke-{i + 1}'}: field '{field}' kosong.")

    for kode in kode_wajib:
        if kode not in ada:
            errors.append(f"Tidak ada evaluasi untuk {kode}.")

    return len(errors) == 0, errors
