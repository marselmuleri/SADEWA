"""
Pengujian keluaran AI SADEWA untuk dokumen C500 (subbab 2.1).

Mengukur dua metrik plus catatan waktu:
  1. Kepatuhan format  : tingkat lolos validate_rps / validate_narasi
                         (dicatat lolos di percobaan pertama DAN lolos akhir
                         setelah retry otomatis, karena generate_rps mencoba
                         ulang maks. 2 kali bila validator gagal).
  2. Ketepatan angka   : angka di narasi yang cocok dengan data capaian dari
                         backend, plus kesesuaian status Tercapai/Belum Tercapai.
  3. Waktu generate    : durasi tiap generate (detik).

Memakai LLM Qwen ASLI (memakan kuota API). Jalankan dari folder ai/:
    python eval/uji_ai.py                      # semua (RPS + narasi)
    python eval/uji_ai.py --hanya narasi       # narasi saja
    python eval/uji_ai.py --kasus eval/kasus_uji.json --keluaran eval/hasil

Hasil (CSV + JSON mentah) ditulis ke folder keluaran, lalu jalankan grafik.py.
"""

import argparse
import csv
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from sadewa_ai import rag_chain  # noqa: E402
from sadewa_ai.config import settings  # noqa: E402
from sadewa_ai.retriever import count_chunks  # noqa: E402
from sadewa_ai import web_retriever  # noqa: E402

# --- Kategori kegagalan validator ------------------------------------------------

KATEGORI = [
    (r"^JSON/LLM error", "Galat LLM / parsing JSON"),
    (r"Total bobot|bobot penilaian yang bukan angka", "Total bobot ≠ 100%"),
    (r"Jumlah pertemuan|Nomor minggu", "Jumlah/urutan minggu salah"),
    (r"tepat satu komponen", "Komponen UTS/UAS tidak tepat"),
    (r"merujuk (CPMK )?'", "Kode CPMK tidak terdaftar"),
    (r"belum mencantumkan CPMK", "Penilaian tanpa CPMK"),
    (r"Field wajib|kosong|harus berupa|harus punya", "Field wajib hilang/kosong"),
]


def kategorikan(pesan: str) -> str:
    for pola, nama in KATEGORI:
        if re.search(pola, pesan):
            return nama
    return "Lainnya"


# --- Uji RPS ---------------------------------------------------------------------

def uji_rps(kasus: Dict[str, Any], ulangan: int, folder: Path, web_dingin: bool = False) -> Tuple[List[dict], List[dict]]:
    baris, pelanggaran = [], []
    for mk in kasus:
        for ke in range(1, ulangan + 1):
            print(f"[RPS] {mk['mk_name']} percobaan {ke}/{ulangan} ...", flush=True)
            ulang_events: List[List[str]] = []
            waktu_web: Dict[str, float] = {}
            if web_dingin:  # ukur waktu web tanpa cache di setiap percobaan
                web_retriever.clear_cache(mk["mk_name"], mk["prodi"])

            def on_event(jenis: str, data: Dict[str, Any]) -> None:
                if jenis == "ulang":
                    ulang_events.append(list(data.get("pelanggaran") or []))
                elif jenis == "tahap" and data.get("id") == "web":
                    waktu_web[data.get("status", "")] = time.perf_counter()
                    if data.get("status") == "selesai":
                        waktu_web["ada_referensi"] = float("Tidak tersedia" not in (data.get("detail") or ""))

            mulai = time.perf_counter()
            galat = ""
            try:
                hasil = rag_chain.generate_rps(**mk, on_event=on_event)
                final_err, valid = hasil["pelanggaran_validasi"], hasil["valid"]
                data = hasil["data"]
            except Exception as exc:  # parsing JSON gagal, timeout, dsb.
                final_err, valid, data = [f"JSON/LLM error: {exc}"], False, None
                galat = type(exc).__name__
            durasi = time.perf_counter() - mulai

            # Pelanggaran per percobaan: event 'ulang' membawa pelanggaran percobaan sebelumnya.
            per_percobaan = ulang_events + [final_err]
            for idx, errs in enumerate(per_percobaan, start=1):
                for e in errs:
                    pelanggaran.append({
                        "mk": mk["mk_name"], "ulangan": ke, "percobaan_llm": idx,
                        "kategori": kategorikan(e), "pesan": e,
                    })

            id_uji = f"rps_{len(baris) + 1:02d}"
            if data is not None:
                (folder / "mentah" / f"{id_uji}.json").write_text(
                    json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            baris.append({
                "id": id_uji, "mk": mk["mk_name"], "ulangan": ke,
                "lolos_percobaan_1": int(not per_percobaan[0]),
                "lolos_akhir": int(valid),
                "jumlah_percobaan_llm": len(per_percobaan),
                "jumlah_pelanggaran_akhir": len(final_err),
                "durasi_detik": round(durasi, 2),
                "durasi_web_detik": round(waktu_web["selesai"] - waktu_web["mulai"], 2) if "selesai" in waktu_web else "",
                "referensi_web": int(waktu_web.get("ada_referensi", 0)),
                "galat": galat,
            })
    return baris, pelanggaran


# --- Uji ketepatan angka narasi -----------------------------------------------------

# Angka yang memang bukan data capaian: kode CPL/CPMK, tahun ajaran, tahun, minggu/semester.
_POLA_KONTEKS = [
    r"\bCP(?:L|MK)\s*[-_]?\s*\d+(?:\.\d+)*",
    r"\b\d{4}\s*/\s*\d{4}\b",
    r"\b(?:19|20)\d{2}\b",
    r"\b(?:minggu|semester|pertemuan|sks)\s*(?:ke-?)?\s*\d+",
]
_POLA_ANGKA = re.compile(r"(?<![\w.,])\d+(?:[.,]\d+)?(?![\w])")


def _kumpulkan_teks(data: Dict[str, Any]) -> List[Tuple[str, str]]:
    """(bagian, teks) dari seluruh field narasi."""
    teks = []
    for f in ("ringkasan_capaian", "kesimpulan"):
        if isinstance(data.get(f), str):
            teks.append((f, data[f]))
    for i, a in enumerate(data.get("analisis_cpl") or []):
        if isinstance(a, dict):
            teks.append((f"analisis_cpl[{i}]", str(a.get("analisis", ""))))
    for i, s in enumerate(data.get("faktor_penyebab") or []):
        teks.append((f"faktor_penyebab[{i}]", str(s)))
    # rekomendasi_intervensi sengaja tidak diperiksa: angkanya rencana tindakan
    # (mis. "tambah 2 sesi"), bukan data capaian.
    return teks


def angka_sah(capaian: List[Dict[str, Any]]) -> List[float]:
    """Semua angka yang boleh muncul: data backend dan turunan langsungnya."""
    ambang = settings.ambang_tercapai
    sah = {ambang, float(len(capaian))}
    n_tercapai = 0
    for c in capaian:
        nilai = float(c["nilai_rata_rata"])
        sah |= {nilai, abs(ambang - nilai)}
        n_tercapai += nilai >= ambang
        jml, ok = c.get("jumlah_mahasiswa"), c.get("jumlah_tercapai")
        if jml is not None:
            sah.add(float(jml))
        if ok is not None:
            sah.add(float(ok))
        if jml and ok is not None:
            sah |= {jml - ok, ok / jml * 100, (jml - ok) / jml * 100}
    sah |= {float(n_tercapai), float(len(capaian) - n_tercapai)}
    if capaian:
        sah.add(sum(float(c["nilai_rata_rata"]) for c in capaian) / len(capaian))
    return sorted(sah)


def cocok(x: float, sah: List[float]) -> bool:
    """Cocok bila sama (toleransi 0,05) atau hasil pembulatan wajar ke bilangan bulat / 1 desimal."""
    for v in sah:
        if abs(x - v) <= 0.05:
            return True
        if float(x).is_integer() and abs(x - v) < 0.5:
            return True
    return False


def periksa_angka(data: Dict[str, Any], capaian: List[Dict[str, Any]]) -> List[dict]:
    sah = angka_sah(capaian)
    hasil = []
    for bagian, teks in _kumpulkan_teks(data):
        bersih = teks
        for pola in _POLA_KONTEKS:
            bersih = re.sub(pola, " ", bersih, flags=re.IGNORECASE)
        for m in _POLA_ANGKA.finditer(bersih):
            x = float(m.group().replace(",", "."))
            awal = max(0, m.start() - 40)
            hasil.append({
                "bagian": bagian, "angka": m.group(), "cocok": int(cocok(x, sah)),
                "konteks": bersih[awal:m.end() + 40].replace("\n", " ").strip(),
            })
    return hasil


def _norm_kode(k: str) -> str:
    return re.sub(r"\s+", "", str(k)).upper()


def periksa_status(data: Dict[str, Any], capaian: List[Dict[str, Any]]) -> Tuple[int, int]:
    """(status benar, status diperiksa). Aturan prompt: Belum Tercapai bila nilai < ambang."""
    peta = {_norm_kode(c["kode"]): float(c["nilai_rata_rata"]) for c in capaian}
    benar = total = 0
    for a in data.get("analisis_cpl") or []:
        if not isinstance(a, dict) or _norm_kode(a.get("kode", "")) not in peta:
            continue
        harap = "Tercapai" if peta[_norm_kode(a["kode"])] >= settings.ambang_tercapai else "Belum Tercapai"
        total += 1
        benar += a.get("status") == harap
    return benar, total


def uji_narasi(kasus: List[Dict[str, Any]], ulangan: int, folder: Path) -> Tuple[List[dict], List[dict]]:
    baris, detail = [], []
    for k in kasus:
        for ke in range(1, ulangan + 1):
            print(f"[Narasi] {k['mk_name']} percobaan {ke}/{ulangan} ...", flush=True)
            id_uji = f"narasi_{len(baris) + 1:02d}"
            mulai = time.perf_counter()
            try:
                hasil = rag_chain.generate_narasi_evaluasi(**k)
                data, errs, valid, galat = hasil["data"], hasil["pelanggaran_validasi"], hasil["valid"], ""
            except Exception as exc:
                data, errs, valid, galat = None, [f"JSON/LLM error: {exc}"], False, type(exc).__name__
            durasi = time.perf_counter() - mulai

            angka, st_benar, st_total = [], 0, 0
            if data is not None:
                (folder / "mentah" / f"{id_uji}.json").write_text(
                    json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
                angka = periksa_angka(data, k["capaian"])
                st_benar, st_total = periksa_status(data, k["capaian"])
            for a in angka:
                detail.append({"id": id_uji, "mk": k["mk_name"], **a})

            baris.append({
                "id": id_uji, "mk": k["mk_name"], "ulangan": ke,
                "lolos_validator": int(valid),
                "pelanggaran": " | ".join(errs),
                "angka_total": len(angka),
                "angka_cocok": sum(a["cocok"] for a in angka),
                "status_benar": st_benar, "status_total": st_total,
                "durasi_detik": round(durasi, 2),
                "galat": galat,
            })
    return baris, detail


# --- Utilitas -------------------------------------------------------------------

def tulis_csv(path: Path, baris: List[dict]) -> None:
    if not baris:
        return
    with path.open("w", newline="", encoding="utf-8-sig") as f:  # utf-8-sig agar rapi dibuka di Excel
        w = csv.DictWriter(f, fieldnames=list(baris[0].keys()))
        w.writeheader()
        w.writerows(baris)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # konsol Windows (cp1252) tidak bisa mencetak simbol seperti ≠
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--kasus", default=str(ROOT / "eval" / "kasus_uji.json"))
    ap.add_argument("--keluaran", default=str(ROOT / "eval" / "hasil"))
    ap.add_argument("--hanya", choices=["rps", "narasi"], help="jalankan satu jenis uji saja")
    ap.add_argument("--web-dingin", action="store_true",
                    help="hapus cache referensi web sebelum tiap generate RPS (mengukur waktu web tanpa cache)")
    args = ap.parse_args()

    kasus = json.loads(Path(args.kasus).read_text(encoding="utf-8"))
    ulangan = int(kasus.get("percobaan_per_mk", 3))
    folder = Path(args.keluaran)
    (folder / "mentah").mkdir(parents=True, exist_ok=True)

    # Konfigurasi dicatat untuk bagian "skenario uji" di laporan (API key tidak ikut).
    konfigurasi = {
        "waktu_uji": datetime.now().isoformat(timespec="seconds"),
        "model": settings.qwen_model,
        "rps_temperature": settings.rps_temperature,
        "narasi_temperature": settings.narasi_temperature,
        "top_k_chunks": settings.top_k_chunks,
        "embedding_model": settings.embedding_model,
        "jumlah_chunk_vectorstore": count_chunks(),
        "maks_retry_rps": rag_chain._MAX_RETRIES_RPS,
        "web_budget_seconds": settings.web_budget_seconds,
        "web_cache_days": settings.web_cache_days,
        "web_dingin": args.web_dingin,
        "ambang_tercapai": settings.ambang_tercapai,
        "percobaan_per_mk": ulangan,
        "jumlah_mk_rps": len(kasus.get("rps", [])),
        "jumlah_kasus_narasi": len(kasus.get("narasi", [])),
    }
    (folder / "konfigurasi.json").write_text(json.dumps(konfigurasi, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.hanya in (None, "rps") and kasus.get("rps"):
        rps, pel = uji_rps(kasus["rps"], ulangan, folder, args.web_dingin)
        tulis_csv(folder / "rps.csv", rps)
        tulis_csv(folder / "rps_pelanggaran.csv", pel)
        n = len(rps)
        print(f"\nRPS: lolos percobaan-1 {sum(r['lolos_percobaan_1'] for r in rps)}/{n}, "
              f"lolos akhir {sum(r['lolos_akhir'] for r in rps)}/{n}")

    if args.hanya in (None, "narasi") and kasus.get("narasi"):
        nar, det = uji_narasi(kasus["narasi"], ulangan, folder)
        tulis_csv(folder / "narasi.csv", nar)
        tulis_csv(folder / "narasi_angka.csv", det)
        tot, ok = sum(r["angka_total"] for r in nar), sum(r["angka_cocok"] for r in nar)
        print(f"Narasi: lolos validator {sum(r['lolos_validator'] for r in nar)}/{len(nar)}, "
              f"angka cocok {ok}/{tot}")

    print(f"\nHasil tersimpan di {folder}. Periksa manual baris cocok=0 di narasi_angka.csv, lalu jalankan grafik.py.")


if __name__ == "__main__":
    main()
