"""
Validasi keluaran LLM.

Aturan seperti "16 pertemuan", "UTS di minggu 8", dan "total bobot 100"
sebelumnya hanya dititipkan pada teks prompt. Instruksi di prompt bersifat
persuasif, bukan jaminan: bila model meleset, data cacat tetap lolos ke backend
dan ikut terpakai pada kalkulasi ketercapaian CPL/CPMK. Modul ini memeriksa
ulang struktur JSON setelah parsing, sehingga pelanggaran aturan tertangkap di
sisi kita sendiri.
"""

from typing import Any, Dict, List, Tuple

from .config import settings

FIELD_WAJIB_RPS = ("kode_mk", "deskripsi_mk", "cpl", "cpmk", "pertemuan")
FIELD_WAJIB_PERTEMUAN = ("minggu", "cpmk", "sub_cpmk", "materi", "metode", "bobot")


def _as_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float("nan")


def validate_rps(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Periksa struktur RPS hasil generasi.

    Mengembalikan (valid, daftar_pelanggaran). Daftar kosong berarti lolos semua.
    """
    errors: List[str] = []

    for field in FIELD_WAJIB_RPS:
        if field not in data:
            errors.append(f"Field wajib '{field}' tidak ada.")

    for field in ("cpl", "cpmk"):
        nilai = data.get(field)
        if field in data and (not isinstance(nilai, list) or not nilai):
            errors.append(f"Field '{field}' harus berupa list dan tidak boleh kosong.")

    pertemuan = data.get("pertemuan")
    if not isinstance(pertemuan, list):
        errors.append("Field 'pertemuan' harus berupa list.")
        return False, errors

    # Jumlah pertemuan
    if len(pertemuan) != settings.jumlah_pertemuan:
        errors.append(
            f"Jumlah pertemuan {len(pertemuan)}, seharusnya {settings.jumlah_pertemuan}."
        )

    # Kelengkapan field tiap pertemuan
    for idx, item in enumerate(pertemuan, start=1):
        if not isinstance(item, dict):
            errors.append(f"Pertemuan ke-{idx} bukan objek.")
            continue
        for field in FIELD_WAJIB_PERTEMUAN:
            if field not in item:
                errors.append(f"Pertemuan ke-{idx} tidak punya field '{field}'.")

    # Nomor minggu harus 1..16 tanpa duplikat dan tanpa bolong
    minggu_list = [item.get("minggu") for item in pertemuan if isinstance(item, dict)]
    harapan = set(range(1, settings.jumlah_pertemuan + 1))
    aktual = {m for m in minggu_list if isinstance(m, int)}

    duplikat = sorted({m for m in minggu_list if minggu_list.count(m) > 1})
    if duplikat:
        errors.append(f"Nomor minggu duplikat: {duplikat}.")

    hilang = sorted(harapan - aktual)
    if hilang:
        errors.append(f"Nomor minggu tidak lengkap, hilang: {hilang}.")

    asing = sorted(m for m in aktual if m not in harapan)
    if asing:
        errors.append(f"Nomor minggu di luar rentang 1-{settings.jumlah_pertemuan}: {asing}.")

    # Total bobot
    bobot_total = sum(
        _as_float(item.get("bobot", 0)) for item in pertemuan if isinstance(item, dict)
    )
    if bobot_total != bobot_total:  # NaN check
        errors.append("Ada nilai bobot yang bukan angka.")
    elif abs(bobot_total - settings.bobot_total) > 0.01:
        errors.append(
            f"Total bobot {bobot_total:g}, seharusnya {settings.bobot_total}."
        )

    # Penempatan UTS dan UAS
    by_minggu = {
        item.get("minggu"): item for item in pertemuan if isinstance(item, dict)
    }

    uts = by_minggu.get(settings.minggu_uts)
    if uts and "UTS" not in str(uts.get("materi", "")).upper():
        errors.append(f"Minggu {settings.minggu_uts} seharusnya berisi UTS.")

    uas = by_minggu.get(settings.minggu_uas)
    if uas and "UAS" not in str(uas.get("materi", "")).upper():
        errors.append(f"Minggu {settings.minggu_uas} seharusnya berisi UAS.")

    # Referensi CPMK pada pertemuan harus terdaftar di daftar CPMK
    kode_cpmk = {
        str(c.get("kode", "")).strip()
        for c in data.get("cpmk", [])
        if isinstance(c, dict)
    }
    if kode_cpmk:
        for item in pertemuan:
            if not isinstance(item, dict):
                continue
            ref = str(item.get("cpmk", "")).strip()
            if ref and ref != "-" and ref not in kode_cpmk:
                errors.append(
                    f"Minggu {item.get('minggu')} merujuk CPMK '{ref}' "
                    "yang tidak ada di daftar cpmk."
                )

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
