"""
Pembaca isi RPS (kolom `rps.konten`) yang memahami dua format:

  - format 2 (baru, mengikuti dokumen Kontrak Kuliah + RPS resmi): pertemuan berisi
    kemampuan_akhir, bahan_kajian_judul/bahan_kajian, pengalaman_belajar (list),
    target_cpmk (list), kriteria_indikator (list), jenis UTS/UAS.
  - format lama: pertemuan berisi cpmk, sub_cpmk, materi, metode, bobot.

Fitur lain (export portofolio) cukup memakai `baris_pertemuan` agar tidak perlu
tahu format mana yang tersimpan.
"""
from typing import Any

UJIAN = {"UTS": "UJIAN TENGAH SEMESTER", "UAS": "UJIAN AKHIR SEMESTER"}


def _gabung(value: Any, pemisah: str = "\n") -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return pemisah.join(str(v).strip() for v in value if str(v).strip())
    return str(value).strip()


def target_cpmk_teks(kode: list[str] | str | None) -> str:
    """['CPMK 2.1', 'CPMK 5.1'] -> 'CPMK 2.1, 5.1' (gaya kolom Target CPMK)."""
    if not kode:
        return ""
    if isinstance(kode, str):
        return kode
    angka = [str(k).replace("CPMK", "").strip() for k in kode]
    return "CPMK " + ", ".join(a for a in angka if a)


def baris_pertemuan(p: dict) -> dict:
    """Satu pertemuan dalam bentuk datar yang seragam untuk kedua format."""
    jenis = p.get("jenis")
    if jenis in UJIAN:
        return {
            "minggu": p.get("minggu"), "jenis": jenis, "cpmk": "", "kemampuan_akhir": "",
            "materi": UJIAN[jenis], "metode": "", "waktu": "", "pengalaman_belajar": "",
            "kriteria_indikator": "", "bobot": p.get("bobot"),
        }
    if "kemampuan_akhir" in p or "bahan_kajian" in p or "bahan_kajian_judul" in p:
        judul, isi = (p.get("bahan_kajian_judul") or "").strip(), (p.get("bahan_kajian") or "").strip()
        return {
            "minggu": p.get("minggu"), "jenis": "kuliah",
            "cpmk": target_cpmk_teks(p.get("target_cpmk")),
            "kemampuan_akhir": p.get("kemampuan_akhir") or "",
            "materi": f"{judul}: {isi}" if judul and isi else (judul or isi),
            "metode": p.get("metode") or "",
            "waktu": p.get("waktu") or "",
            "pengalaman_belajar": _gabung(p.get("pengalaman_belajar")),
            "kriteria_indikator": _gabung(p.get("kriteria_indikator")),
            "bobot": p.get("bobot"),
        }
    # Format lama
    materi = str(p.get("materi") or "")
    jenis_lama = "UTS" if materi.strip().upper() in ("UTS", "UJIAN TENGAH SEMESTER") else (
        "UAS" if materi.strip().upper() in ("UAS", "UJIAN AKHIR SEMESTER") else "kuliah"
    )
    return {
        "minggu": p.get("minggu"), "jenis": jenis_lama,
        "cpmk": "" if p.get("cpmk") == "-" else (p.get("cpmk") or ""),
        "kemampuan_akhir": p.get("sub_cpmk") or "",
        "materi": materi, "metode": p.get("metode") or "", "waktu": p.get("waktu") or "",
        "pengalaman_belajar": "", "kriteria_indikator": "", "bobot": p.get("bobot"),
    }


def daftar_pertemuan(konten: dict | None) -> list[dict]:
    if not isinstance(konten, dict):
        return []
    return [baris_pertemuan(p) for p in konten.get("pertemuan") or [] if isinstance(p, dict)]
