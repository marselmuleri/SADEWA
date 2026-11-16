"""
Pengujian keluaran AI SADEWA untuk dokumen C500 (subbab 2.1).

Objek utama penelitian: evaluasi CPMK (/api/v1/evaluasi-cpmk). Uji RPS dan narasi
tetap tersedia lewat --hanya rps|narasi|semua, tetapi di luar ruang lingkup skripsi.

Metrik evaluasi CPMK:
  1. Kepatuhan format  : lolos validate_evaluasi_cpmk di percobaan pertama DAN lolos
                         akhir (generate_evaluasi_cpmk mencoba ulang maks. 1 kali).
  2. Ketepatan angka   : angka di kolom analisis yang cocok dengan data CPMK backend.
  3. Ketepatan status  : status MEMENUHI/BELUM MEMENUHI yang dinyatakan teks analisis
                         dibandingkan status dari backend (heuristik + cek manual).
  4. Waktu generate    : durasi total, dipilah menjadi waktu retrieval (ChromaDB),
                         waktu LLM murni, dan sisanya.
  5. Token             : token masukan/keluaran per generate (untuk biaya).

Memakai LLM ASLI (memakan kuota API). Model dipilih lewat --profil; kunci API,
base URL, dan nama model dibaca dari ai/.env (lihat .env.example). Jalankan dari ai/:
    python eval/uji_ai.py --profil qwen                  # hasil ke eval/hasil/qwen
    python eval/uji_ai.py --profil llama                 # hasil ke eval/hasil/llama
    python eval/uji_ai.py --profil gpt                   # hasil ke eval/hasil/gpt
    python eval/uji_ai.py --profil gpt --model gpt-4.1   # timpa nama model
    python eval/uji_ai.py --profil qwen --jalur openrouter   # hasil ke eval/hasil/openrouter/qwen

Hasil (CSV + JSON mentah) ditulis ke folder keluaran, lalu jalankan grafik.py.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from dotenv import dotenv_values  # noqa: E402

from sadewa_ai import llm_client, rag_chain  # noqa: E402
from sadewa_ai.config import settings  # noqa: E402
from sadewa_ai.retriever import count_chunks, retrieve_documents  # noqa: E402
from sadewa_ai.schemas import EvaluasiCPMKRequest  # noqa: E402
from sadewa_ai import web_retriever  # noqa: E402

# --- Profil model yang dibandingkan --------------------------------------------
# Semua lewat API kompatibel OpenAI; yang berbeda hanya kunci, base URL, dan nama
# model. Parameter lain (prompt, top-k, temperature, retriever) tetap dari settings.
#   nama profil: (env kunci, env base URL, base URL bawaan, env model, kirim enable_thinking)
PROFIL: Dict[str, Tuple[str, str, Optional[str], str, bool]] = {
    "qwen": ("QWEN_API_KEY", "QWEN_BASE_URL", None, "QWEN_MODEL", True),
    "llama": ("LLAMA_API_KEY", "LLAMA_BASE_URL", None, "LLAMA_MODEL", False),
    "gpt": ("OPENAI_API_KEY", "OPENAI_BASE_URL", "https://api.openai.com/v1", "OPENAI_MODEL", False),
}


def terapkan_profil(nama: str, model: Optional[str] = None) -> Dict[str, Any]:
    """Arahkan klien LLM ke profil terpilih. Nilai env proses menimpa nilai ai/.env."""
    env_kunci, env_url, url_bawaan, env_model, kirim_thinking = PROFIL[nama]
    env = {**dotenv_values(ROOT / ".env"), **os.environ}
    kunci = env.get(env_kunci) or ""
    base_url = env.get(env_url) or url_bawaan
    nama_model = model or env.get(env_model) or ""
    kurang = [n for n, v in ((env_kunci, kunci), (env_url, base_url), (env_model, nama_model)) if not v]
    if kurang:
        sys.exit(f"Profil '{nama}' belum lengkap. Isi di ai/.env: {', '.join(kurang)}")
    if "/accounts//" in base_url:
        sys.exit(f"Base URL profil '{nama}' belum memuat Account ID Cloudflare. Isi CLOUDFLARE_ACCOUNT_ID di ai/.env.")

    # Field qwen_* dipakai llm_client sebagai konfigurasi LLM aktif.
    settings.qwen_api_key = kunci
    settings.qwen_base_url = base_url
    settings.qwen_model = nama_model
    settings.llm_kirim_enable_thinking = kirim_thinking
    # Model OpenAI generasi baru: mode berpikir dimatikan (reasoning_effort="none"),
    # setara enable_thinking=False pada Qwen, agar temperature diterima dan perbandingan
    # adil. Dapat ditimpa lewat OPENAI_REASONING_EFFORT di .env (kosongkan untuk model lama).
    if nama == "gpt":
        # Tanpa baris OPENAI_REASONING_EFFORT -> "none" (model reasoning generasi baru).
        # Baris kosong (OPENAI_REASONING_EFFORT=) -> tidak dikirim (model non-reasoning,
        # mis. GPT-4.1 mini di GitHub Models), dan batas token memakai max_tokens.
        settings.llm_reasoning_effort = (env["OPENAI_REASONING_EFFORT"] or "") if "OPENAI_REASONING_EFFORT" in env else "none"
        # Bawaan: max_completion_tokens bila reasoning aktif (API OpenAI). Penyedia lain
        # (mis. Cloudflare untuk GPT-OSS) memakai max_tokens -> OPENAI_PAKAI_MAX_COMPLETION_TOKENS=0.
        pilihan = (env.get("OPENAI_PAKAI_MAX_COMPLETION_TOKENS") or "").strip().lower()
        settings.llm_pakai_max_completion_tokens = (
            pilihan in ("1", "true", "ya") if pilihan else bool(settings.llm_reasoning_effort))
    else:
        settings.llm_reasoning_effort = ""
        settings.llm_pakai_max_completion_tokens = False
    settings.llm_extra_body = None
    settings.llm_kirim_temperature = True
    llm_client.reset_client()
    return {"profil": nama, "jalur": "langsung", "model": nama_model, "base_url": base_url,
            "kirim_enable_thinking": kirim_thinking,
            "reasoning_effort": settings.llm_reasoning_effort or None,
            "parameter_batas_token": "max_completion_tokens" if settings.llm_pakai_max_completion_tokens else "max_tokens"}


# --- Jalur OpenRouter -------------------------------------------------------------
# Ketiga model dipanggil lewat satu gateway agar endpoint, format permintaan, dan jalur
# jaringan sama. Per profil dibaca dari ai/.env:
#   OR_<PROFIL>_MODEL     : slug model OpenRouter, mis. qwen/qwen3.8-flash (wajib)
#   OR_<PROFIL>_PROVIDER  : provider yang dikunci, dipisah koma (disarankan, terutama Llama
#                           yang dilayani banyak provider dengan kuantisasi berbeda)
#   OR_<PROFIL>_REASONING : none/minimal/low/medium/high -> {"effort": ...} ("none" mematikan
#                           mode berpikir); "off" -> {"enabled": false}; "-" -> tidak dikirim;
#                           atau JSON mentah.
#   OR_<PROFIL>_KIRIM_TEMPERATURE : 1/0. Bawaan 0 untuk GPT (GPT-6 Luna di OpenRouter tidak
#                           mendukung temperature), 1 untuk lainnya.
OPENROUTER_URL = "https://openrouter.ai/api/v1"
# Bawaan setara jalur langsung: mode berpikir Qwen dan GPT dimatikan, Llama 4 bukan model reasoning.
REASONING_BAWAAN = {"qwen": "none", "gpt": "none", "llama": "-"}
KIRIM_TEMPERATURE_BAWAAN = {"qwen": True, "gpt": False, "llama": True}


def _objek_reasoning(nilai: str) -> Optional[Dict[str, Any]]:
    nilai = (nilai or "").strip()
    if not nilai or nilai == "-":
        return None
    if nilai.startswith("{"):
        return json.loads(nilai)
    if nilai.lower() == "off":
        return {"enabled": False}
    return {"effort": nilai.lower()}


def terapkan_profil_openrouter(nama: str, model: Optional[str] = None) -> Dict[str, Any]:
    """Arahkan klien LLM ke OpenRouter dengan provider dikunci dan reasoning eksplisit."""
    env = {**dotenv_values(ROOT / ".env"), **os.environ}
    awalan = f"OR_{nama.upper()}_"
    kunci = env.get("OPENROUTER_API_KEY") or ""
    nama_model = model or env.get(awalan + "MODEL") or ""
    kurang = [n for n, v in (("OPENROUTER_API_KEY", kunci), (awalan + "MODEL", nama_model)) if not v]
    if kurang:
        sys.exit(f"Profil '{nama}' (OpenRouter) belum lengkap. Isi di ai/.env: {', '.join(kurang)}")

    provider_dikunci = [x.strip() for x in (env.get(awalan + "PROVIDER") or "").split(",") if x.strip()]
    reasoning_mentah = env[awalan + "REASONING"] if awalan + "REASONING" in env else REASONING_BAWAAN[nama]
    reasoning = _objek_reasoning(reasoning_mentah or "-")

    # require_parameters: hanya provider yang mendukung semua parameter yang dikirim
    # (temperature, max_tokens, reasoning). Tanpa ini, parameter bisa diam-diam diabaikan.
    provider: Dict[str, Any] = {"require_parameters": True}
    if provider_dikunci:
        provider.update({"order": provider_dikunci, "allow_fallbacks": False})
    else:
        print(f"PERINGATAN: {awalan}PROVIDER kosong; OpenRouter bebas memilih provider. "
              "Kolom 'provider' di CSV tetap mencatat provider yang melayani.", flush=True)
    extra: Dict[str, Any] = {"provider": provider, "usage": {"include": True}}
    if reasoning is not None:
        extra["reasoning"] = reasoning

    settings.qwen_api_key = kunci
    settings.qwen_base_url = env.get("OPENROUTER_BASE_URL") or OPENROUTER_URL
    settings.qwen_model = nama_model
    settings.llm_kirim_enable_thinking = False   # parameter DashScope; OpenRouter memakai 'reasoning'
    settings.llm_reasoning_effort = ""           # idem, diganti objek 'reasoning'
    settings.llm_pakai_max_completion_tokens = False  # OpenRouter menormalkan max_tokens
    settings.llm_extra_body = extra
    mentah_t = (env.get(awalan + "KIRIM_TEMPERATURE") or "").strip().lower()
    settings.llm_kirim_temperature = (mentah_t in ("1", "true", "ya")) if mentah_t else KIRIM_TEMPERATURE_BAWAAN[nama]
    llm_client.reset_client()
    return {"profil": nama, "jalur": "openrouter", "kirim_temperature": settings.llm_kirim_temperature, "model": nama_model, "base_url": settings.qwen_base_url,
            "provider_dikunci": provider_dikunci or None, "reasoning": reasoning,
            "extra_body": extra, "parameter_batas_token": "max_tokens"}


# --- Pencatat waktu tahap dan token ---------------------------------------------

class Pencatat:
    """Kumpulkan waktu tahap pipeline (dari on_event) dan statistik LLM (dari usage listener)."""

    def __init__(self) -> None:
        self.mulai_tahap: Dict[str, float] = {}
        self.durasi_tahap: Dict[str, float] = {}
        self.detail_tahap: Dict[str, str] = {}
        self.ulang: List[List[str]] = []
        self.llm: List[Dict[str, Any]] = []
        self.ulang_kuota = 0

    def on_event(self, jenis: str, data: Dict[str, Any]) -> None:
        if jenis == "ulang":
            self.ulang.append(list(data.get("pelanggaran") or []))
        elif jenis == "tahap":
            tahap, status = data.get("id", ""), data.get("status")
            if status == "mulai":
                self.mulai_tahap[tahap] = time.perf_counter()
            elif status == "selesai" and tahap in self.mulai_tahap:
                lama = time.perf_counter() - self.mulai_tahap.pop(tahap)
                self.durasi_tahap[tahap] = self.durasi_tahap.get(tahap, 0.0) + lama
                self.detail_tahap[tahap] = data.get("detail") or ""

    def on_usage(self, catatan: Dict[str, Any]) -> None:
        self.llm.append(catatan)

    def ringkas(self, durasi_total: float) -> Dict[str, Any]:
        t_retrieval = self.durasi_tahap.get("konteks", 0.0)
        t_web = self.durasi_tahap.get("web", 0.0)
        t_llm = sum(c.get("durasi_detik") or 0.0 for c in self.llm)
        token_in = [c["prompt_tokens"] for c in self.llm if c.get("prompt_tokens") is not None]
        token_out = [c["completion_tokens"] for c in self.llm if c.get("completion_tokens") is not None]
        tok_r = [c["reasoning_tokens"] for c in self.llm if c.get("reasoning_tokens") is not None]
        biaya = [c["biaya_usd"] for c in self.llm if c.get("biaya_usd") is not None]
        return {
            "durasi_detik": round(durasi_total, 2),
            "durasi_retrieval_detik": round(t_retrieval, 3),
            "durasi_llm_detik": round(t_llm, 2),
            "durasi_lain_detik": round(max(durasi_total - t_retrieval - t_web - t_llm, 0.0), 2),
            "token_masuk": sum(token_in) if token_in else "",
            "token_keluar": sum(token_out) if token_out else "",
            "token_reasoning": sum(tok_r) if tok_r else "",
            "biaya_usd": round(sum(biaya), 8) if biaya else "",
            "provider": ";".join(sorted({c["provider"] for c in self.llm if c.get("provider")})),
        }


# Pengaturan kuota (diisi dari argumen baris perintah di main()).
JEDA_DETIK = 0.0            # jeda sebelum setiap generate (layanan gratis berbatas laju)
TUNGGU_KUOTA_DETIK = 60.0   # waktu tunggu sebelum mengulang generate yang kena 429
MAKS_ULANG_KUOTA = 5        # batas pengulangan karena 429 per keluaran


class KuotaHarianHabis(RuntimeError):
    """Jatah harian layanan gratis habis (mis. 10.000 neuron Cloudflare). Lanjutkan besok."""


_TANDA_KUOTA_HARIAN = ("daily free allocation", "free allocation", "neurons", "4006",
                       "per day", "daily limit", "requests per day", "rpd")


def kuota_harian_habis(exc: Exception) -> bool:
    """Heuristik pesan galat penyedia untuk jatah harian (bukan batas per menit)."""
    teks = str(exc).lower()
    return any(t in teks for t in _TANDA_KUOTA_HARIAN)


def jalankan(
    fungsi: Callable[..., Dict[str, Any]], kwargs: Dict[str, Any],
) -> Tuple[Pencatat, Optional[Dict[str, Any]], Optional[Exception], float]:
    """
    Jalankan satu generate dengan pencatat terpasang. Kembalikan (pencatat, hasil|None, galat, durasi).

    Galat 429 (kuota penyedia) adalah masalah infrastruktur, bukan kegagalan model: generate
    diulang dari awal dengan pencatat baru setelah menunggu, dan jumlah pengulangannya dicatat
    di `pencatat.ulang_kuota`. Waktu menunggu tidak ikut dihitung sebagai waktu penyusunan.
    """
    ulang_kuota = 0
    while True:
        if JEDA_DETIK:
            time.sleep(JEDA_DETIK)
        p = Pencatat()
        llm_client.set_usage_listener(p.on_usage)
        mulai = time.perf_counter()
        hasil: Optional[Dict[str, Any]] = None
        galat: Optional[Exception] = None
        try:
            hasil = fungsi(**kwargs, on_event=p.on_event)
        except Exception as exc:  # parsing JSON gagal, timeout, dsb.
            galat = exc
        finally:
            llm_client.set_usage_listener(None)
        durasi = time.perf_counter() - mulai
        if galat is not None and kuota_harian_habis(galat):
            # Menunggu tidak ada gunanya; hentikan uji dan simpan hasil sejauh ini.
            raise KuotaHarianHabis(str(galat)) from galat
        if isinstance(galat, llm_client.LLMRateLimitError) and ulang_kuota < MAKS_ULANG_KUOTA:
            ulang_kuota += 1
            print(f"  [kuota 429] tunggu {TUNGGU_KUOTA_DETIK:.0f} detik, ulang {ulang_kuota}/{MAKS_ULANG_KUOTA}",
                  flush=True)
            time.sleep(TUNGGU_KUOTA_DETIK)
            continue
        p.ulang_kuota = ulang_kuota
        return p, hasil, galat, durasi

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
            if web_dingin:  # ukur waktu web tanpa cache di setiap percobaan
                web_retriever.clear_cache(mk["mk_name"], mk["prodi"])

            p, hasil, exc, durasi = jalankan(rag_chain.generate_rps, mk)
            if hasil is not None:
                final_err, valid, data = hasil["pelanggaran_validasi"], hasil["valid"], hasil["data"]
            else:
                final_err, valid, data = [f"JSON/LLM error: {exc}"], False, None

            # Pelanggaran per percobaan: event 'ulang' membawa pelanggaran percobaan sebelumnya.
            per_percobaan = p.ulang + [final_err]
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
            waktu = p.ringkas(durasi)
            baris.append({
                "id": id_uji, "model": settings.qwen_model, "mk": mk["mk_name"], "ulangan": ke,
                "lolos_percobaan_1": int(not per_percobaan[0]),
                "lolos_akhir": int(valid),
                # Dihitung dari panggilan LLM yang benar-benar terjadi; galat di tengah
                # retry tetap terhitung (tidak hanya dari event 'ulang').
                "jumlah_percobaan_llm": len(p.llm) or len(per_percobaan),
                "jumlah_pelanggaran_akhir": len(final_err),
                "durasi_detik": waktu["durasi_detik"],
                "durasi_retrieval_detik": waktu["durasi_retrieval_detik"],
                "durasi_web_detik": round(p.durasi_tahap["web"], 2) if "web" in p.durasi_tahap else "",
                "durasi_llm_detik": waktu["durasi_llm_detik"],
                "durasi_lain_detik": waktu["durasi_lain_detik"],
                "token_masuk": waktu["token_masuk"],
                "token_keluar": waktu["token_keluar"],
                "token_reasoning": waktu["token_reasoning"],
                "biaya_usd": waktu["biaya_usd"],
                "provider": waktu["provider"],
                "ulang_kuota": p.ulang_kuota,
                "referensi_web": int("web" in p.detail_tahap and "Tidak tersedia" not in p.detail_tahap["web"]),
                "galat": type(exc).__name__ if exc else "",
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
    return periksa_angka_teks(_kumpulkan_teks(data), angka_sah(capaian))


def periksa_angka_teks(daftar_teks: List[Tuple[str, str]], sah: List[float]) -> List[dict]:
    """Cocokkan setiap angka pada (bagian, teks) dengan daftar angka sah."""
    hasil = []
    for bagian, teks in daftar_teks:
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
            p, hasil, exc, durasi = jalankan(rag_chain.generate_narasi_evaluasi, k)
            if hasil is not None:
                data, errs, valid = hasil["data"], hasil["pelanggaran_validasi"], hasil["valid"]
            else:
                data, errs, valid = None, [f"JSON/LLM error: {exc}"], False

            angka, st_benar, st_total = [], 0, 0
            if data is not None:
                (folder / "mentah" / f"{id_uji}.json").write_text(
                    json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
                angka = periksa_angka(data, k["capaian"])
                st_benar, st_total = periksa_status(data, k["capaian"])
            for a in angka:
                detail.append({"id": id_uji, "mk": k["mk_name"], **a})

            waktu = p.ringkas(durasi)
            baris.append({
                "id": id_uji, "model": settings.qwen_model, "mk": k["mk_name"], "ulangan": ke,
                "lolos_validator": int(valid),
                "pelanggaran": " | ".join(errs),
                "angka_total": len(angka),
                "angka_cocok": sum(a["cocok"] for a in angka),
                # status_total   : entri analisis yang kodenya ada di data (penyebut opsi a)
                # status_harapan : seluruh kode capaian di data masukan (penyebut opsi b,
                #                  capaian yang terlewat dihitung salah)
                "status_benar": st_benar, "status_total": st_total,
                "status_harapan": len({_norm_kode(c["kode"]) for c in k["capaian"]}),
                "durasi_detik": waktu["durasi_detik"],
                "durasi_retrieval_detik": waktu["durasi_retrieval_detik"],
                "durasi_llm_detik": waktu["durasi_llm_detik"],
                "durasi_lain_detik": waktu["durasi_lain_detik"],
                "token_masuk": waktu["token_masuk"],
                "token_keluar": waktu["token_keluar"],
                "token_reasoning": waktu["token_reasoning"],
                "biaya_usd": waktu["biaya_usd"],
                "provider": waktu["provider"],
                "ulang_kuota": p.ulang_kuota,
                "galat": type(exc).__name__ if exc else "",
            })
    return baris, detail


# --- Uji evaluasi CPMK (objek utama penelitian) -----------------------------------
# Endpoint /api/v1/evaluasi-cpmk: kolom "Analisis Pelaksanaan Pembelajaran" dan
# "Rencana Perbaikan Semester Depan" per CPMK pada sheet Evaluasi portofolio.

KATEGORI_EVALUASI = [
    (r"^JSON/LLM error", "Galat LLM / parsing JSON"),
    (r"^Tidak ada evaluasi untuk", "CPMK terlewat / kode berbeda"),
    (r"field '(analisis|rencana_perbaikan)' kosong", "Kolom analisis/rencana kosong"),
    (r"harus berupa list|bukan objek", "Struktur JSON salah"),
]


def kategorikan_evaluasi(pesan: str) -> str:
    for pola, nama in KATEGORI_EVALUASI:
        if re.search(pola, pesan):
            return nama
    return "Lainnya"


def angka_sah_cpmk(req: Dict[str, Any]) -> List[float]:
    """Angka yang boleh muncul di analisis: data backend dan turunan langsungnya."""
    ambang, target = float(req["ambang"]), float(req["target_persen"])
    cpmk = req["cpmk"]
    sah = {ambang, target, float(len(cpmk)), 100.0}
    for nama in ("target_rerata_skala", "skala_maks"):
        if req.get(nama) is not None:
            sah.add(float(req[nama]))
    if req.get("skala_maks"):
        sah.add(1.0)  # "skala 1-4"
    n_memenuhi = 0
    for c in cpmk:
        rata, persen = float(c["rata_rata"]), float(c["persen_tercapai"])
        jml, ok = int(c.get("jumlah_mahasiswa") or 0), int(c.get("jumlah_tercapai") or 0)
        sah |= {rata, abs(ambang - rata), persen, 100 - persen, abs(persen - target),
                float(jml), float(ok), float(jml - ok)}
        if jml:
            sah.add((jml - ok) / jml * 100)
        if c.get("rerata_skala") is not None:
            sah.add(float(c["rerata_skala"]))
            if req.get("target_rerata_skala") is not None:
                sah.add(abs(float(req["target_rerata_skala"]) - float(c["rerata_skala"])))
        n_memenuhi += bool(c.get("memenuhi"))
    sah |= {float(n_memenuhi), float(len(cpmk) - n_memenuhi)}
    return sorted(sah)


# Klasifikasi status yang dinyatakan teks analisis. Pola negatif diperiksa lebih dulu
# karena "belum memenuhi target" juga memuat "memenuhi target". Bersifat heuristik:
# baris "tidak_jelas" dan seluruh baris salah wajib diperiksa manual.
_POLA_BELUM = [
    r"\b(belum|tidak)\s+(sepenuhnya\s+)?(memenuhi|mencapai|tercapai|terpenuhi)\b",
    r"\bdi\s*bawah\s+target\b",
    r"\bkurang\s+dari\s+target\b",
]
_POLA_MEMENUHI = [
    r"\b(telah|sudah|berhasil)\s+(memenuhi|mencapai|melampaui)\b",
    r"\bmemenuhi\s+target\b",
    r"\bmelampaui\s+target\b",
    r"\bmencapai\s+target\b",
    r"\btarget\s+(telah\s+|sudah\s+)?(tercapai|terpenuhi)\b",
    r"\bdi\s*atas\s+target\b",
    r"\bmelebihi\s+target\b",
    # "target ambang 60,0% tercapai", "target ketercapaian ... terpenuhi". Versi negatif
    # ("target belum tercapai") sudah tertangkap _POLA_BELUM yang diperiksa lebih dulu.
    # Titik desimal ("60.0%") tidak dianggap akhir kalimat.
    r"\btarget\b(?:[^.;]|\.(?=\d)){0,40}?\b(tercapai|terpenuhi|terlampaui)\b",
]

# AMBANG (mis. nilai 70) berlaku per mahasiswa; TARGET (mis. 60% mahasiswa) berlaku per CPMK.
# Frasa "(belum|tidak) mencapai/memenuhi ambang" menyatakan keadaan sebagian mahasiswa,
# bukan status CPMK, sehingga dibuang sebelum klasifikasi. Contoh: "capaian ini memenuhi
# target, meskipun masih terdapat mahasiswa yang belum mencapai ambang".
_POLA_FRASA_MAHASISWA = [
    r"\b(belum|tidak)\s+(sepenuhnya\s+)?(mencapai|memenuhi)\s+(nilai\s+)?ambang\b",
]


def klasifikasi_status(teks: str) -> str:
    t = teks.lower()
    for pola in _POLA_FRASA_MAHASISWA:
        t = re.sub(pola, " ", t)
    if any(re.search(p, t) for p in _POLA_BELUM):
        return "belum"
    if any(re.search(p, t) for p in _POLA_MEMENUHI):
        return "memenuhi"
    return "tidak_jelas"


def periksa_status_cpmk(data: Dict[str, Any], req: Dict[str, Any]) -> List[dict]:
    """Satu baris per CPMK masukan: status data vs status yang dinyatakan analisis."""
    entri = {
        _norm_kode(e.get("kode", "")): e
        for e in (data.get("evaluasi") or []) if isinstance(e, dict)
    }
    baris = []
    for c in req["cpmk"]:
        harap = "memenuhi" if c.get("memenuhi") else "belum"
        e = entri.get(_norm_kode(c["kode"]))
        teks = str(e.get("analisis", "")) if e else ""
        dinyatakan = klasifikasi_status(teks) if e else "terlewat"
        baris.append({
            "kode": c["kode"], "status_data": harap, "status_teks": dinyatakan,
            "benar": int(dinyatakan == harap), "analisis": teks.replace("\n", " "),
        })
    return baris


def uji_evaluasi_cpmk(
    kasus: List[Dict[str, Any]], ulangan: int, folder: Path,
    selesai: Optional[set] = None,
) -> Tuple[List[dict], List[dict], List[dict], List[dict], bool]:
    """
    Jalankan uji evaluasi CPMK. `selesai` berisi pasangan (kode_kasus, ulangan) yang sudah ada
    hasilnya (mode --lanjut) dan dilewati. Elemen terakhir hasil = True bila uji berhenti
    karena jatah harian penyedia habis.
    """
    selesai = selesai or set()
    baris, pelanggaran, angka_detail, status_detail = [], [], [], []
    for no, k in enumerate(kasus, start=1):
        # Kode kasus menjadi kunci pasangan antarmodel pada analisis (bandingkan.py).
        kode_kasus = str(k.get("_kode_kasus") or f"K{no:02d}")
        # Lewatkan skema yang sama dengan endpoint agar nilai bawaan (ambang 70,
        # target 60%) persis seperti di sistem.
        req = EvaluasiCPMKRequest(**{f: v for f, v in k.items() if not f.startswith("_")}).model_dump()
        for ke in range(1, ulangan + 1):
            if (kode_kasus, ke) in selesai:
                continue
            print(f"[Evaluasi CPMK] {kode_kasus} {req['mk_name']} percobaan {ke}/{ulangan} ...", flush=True)
            # ID stabil per (kasus, ulangan) agar hasil dari beberapa hari dapat digabung.
            id_uji = f"evaluasi_{kode_kasus}_u{ke}"
            try:
                p, hasil, exc, durasi = jalankan(rag_chain.generate_evaluasi_cpmk, req)
            except KuotaHarianHabis as kh:
                print(f"\n[KUOTA HARIAN HABIS] {kh}\nHasil sejauh ini disimpan. Lanjutkan setelah "
                      "jatah direset dengan menambahkan --lanjut.", flush=True)
                return baris, pelanggaran, angka_detail, status_detail, True
            if hasil is not None:
                final_err, valid, data = hasil["pelanggaran_validasi"], hasil["valid"], hasil["data"]
            else:
                final_err, valid, data = [f"JSON/LLM error: {exc}"], False, None

            per_percobaan = p.ulang + [final_err]
            for idx, errs in enumerate(per_percobaan, start=1):
                for e in errs:
                    pelanggaran.append({
                        "id": id_uji, "kasus": kode_kasus, "mk": req["mk_name"], "ulangan": ke, "percobaan_llm": idx,
                        "kategori": kategorikan_evaluasi(e), "pesan": e,
                    })

            angka, status = [], []
            if data is not None:
                (folder / "mentah" / f"{id_uji}.json").write_text(
                    json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
                # Hanya kolom analisis: angka di rencana perbaikan adalah rencana tindakan
                # (mis. "tambah 2 sesi"), bukan data capaian.
                teks = [
                    (f"analisis[{e.get('kode', i)}]", str(e.get("analisis", "")))
                    for i, e in enumerate(data.get("evaluasi") or []) if isinstance(e, dict)
                ]
                angka = periksa_angka_teks(teks, angka_sah_cpmk(req))
                status = periksa_status_cpmk(data, req)
            angka_detail += [{"id": id_uji, "kasus": kode_kasus, "mk": req["mk_name"], **a} for a in angka]
            status_detail += [{"id": id_uji, "kasus": kode_kasus, "mk": req["mk_name"], **s} for s in status]

            waktu = p.ringkas(durasi)
            baris.append({
                "id": id_uji, "model": settings.qwen_model, "kasus": kode_kasus, "mk": req["mk_name"], "ulangan": ke,
                "jumlah_cpmk": len(req["cpmk"]),
                "lolos_percobaan_1": int(not per_percobaan[0]),
                "lolos_akhir": int(valid),
                "jumlah_percobaan_llm": len(p.llm) or len(per_percobaan),
                "jumlah_pelanggaran_akhir": len(final_err),
                "angka_total": len(angka),
                "angka_cocok": sum(a["cocok"] for a in angka),
                "status_benar": sum(s["benar"] for s in status),
                "status_tidak_jelas": sum(s["status_teks"] == "tidak_jelas" for s in status),
                "status_terlewat": sum(s["status_teks"] == "terlewat" for s in status),
                "status_harapan": len(req["cpmk"]),
                "durasi_detik": waktu["durasi_detik"],
                "durasi_retrieval_detik": waktu["durasi_retrieval_detik"],
                "durasi_llm_detik": waktu["durasi_llm_detik"],
                "durasi_lain_detik": waktu["durasi_lain_detik"],
                "token_masuk": waktu["token_masuk"],
                "token_keluar": waktu["token_keluar"],
                "token_reasoning": waktu["token_reasoning"],
                "biaya_usd": waktu["biaya_usd"],
                "provider": waktu["provider"],
                "ulang_kuota": p.ulang_kuota,
                "galat": type(exc).__name__ if exc else "",
            })
    return baris, pelanggaran, angka_detail, status_detail, False


# --- Utilitas -------------------------------------------------------------------

def _angka(v: str):
    """Kembalikan nilai CSV ke int/float bila memungkinkan."""
    for f in (int, float):
        try:
            return f(v)
        except (TypeError, ValueError):
            pass
    return v


def baca_csv(path: Path) -> List[dict]:
    if not path.exists() or path.stat().st_size == 0:
        return []
    with path.open(newline="", encoding="utf-8-sig") as f:
        return [{k: _angka(v) for k, v in r.items()} for r in csv.DictReader(f)]

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
    kasus_bawaan = ROOT / "eval" / "kasus_evaluasi.json"  # 20 kasus data simulasi (subbab 3.2.3)
    if not kasus_bawaan.exists():
        kasus_bawaan = ROOT / "eval" / "kasus_uji.json"
    ap.add_argument("--kasus", default=str(kasus_bawaan))
    ap.add_argument("--profil", choices=sorted(PROFIL), default="qwen",
                    help="model yang diuji (kunci/base URL/model dibaca dari ai/.env)")
    ap.add_argument("--model", help="timpa nama model dari .env, mis. versi snapshot tertentu")
    ap.add_argument("--jalur", choices=["langsung", "openrouter"], default="langsung",
                    help="langsung = API penyedia masing-masing; openrouter = ketiganya lewat OpenRouter")
    ap.add_argument("--keluaran", help="folder hasil (bawaan: eval/hasil/<profil>)")
    ap.add_argument("--hanya", choices=["evaluasi", "rps", "narasi", "semua"], default="evaluasi",
                    help="jenis uji (bawaan: evaluasi CPMK, objek penelitian; rps/narasi di luar ruang lingkup)")
    ap.add_argument("--web-dingin", action="store_true",
                    help="hapus cache referensi web sebelum tiap generate RPS (mengukur waktu web tanpa cache)")
    ap.add_argument("--jeda", type=float, default=0.0,
                    help="detik jeda sebelum setiap generate (mis. 5 untuk layanan gratis berbatas laju)")
    ap.add_argument("--tunggu-kuota", type=float, default=60.0,
                    help="detik menunggu sebelum mengulang generate yang kena 429")
    ap.add_argument("--maks-ulang-kuota", type=int, default=5)
    ap.add_argument("--maks-kasus", type=int, default=0,
                    help="hanya jalankan N kasus pertama (0 = semua); untuk uji coba kecil")
    ap.add_argument("--lanjut", action="store_true",
                    help="lanjutkan uji sebelumnya di folder yang sama: lewati keluaran yang sudah ada")
    ap.add_argument("--ulangan", type=int, default=0,
                    help="timpa percobaan_per_mk dari berkas kasus (0 = pakai berkas)")
    args = ap.parse_args()
    global JEDA_DETIK, TUNGGU_KUOTA_DETIK, MAKS_ULANG_KUOTA
    JEDA_DETIK, TUNGGU_KUOTA_DETIK, MAKS_ULANG_KUOTA = args.jeda, args.tunggu_kuota, args.maks_ulang_kuota

    kasus = json.loads(Path(args.kasus).read_text(encoding="utf-8"))
    ulangan = args.ulangan or int(kasus.get("percobaan_per_mk", 3))
    if args.maks_kasus:
        for bagian in ("evaluasi_cpmk", "rps", "narasi"):
            if isinstance(kasus.get(bagian), list):
                kasus[bagian] = kasus[bagian][: args.maks_kasus]
    if args.jalur == "openrouter":
        profil = terapkan_profil_openrouter(args.profil, args.model)
        folder_bawaan = ROOT / "eval" / "hasil" / "openrouter" / args.profil
    else:
        profil = terapkan_profil(args.profil, args.model)
        folder_bawaan = ROOT / "eval" / "hasil" / args.profil
    folder = Path(args.keluaran) if args.keluaran else folder_bawaan
    (folder / "mentah").mkdir(parents=True, exist_ok=True)
    print(f"Profil {profil['profil']}: model {profil['model']} @ {profil['base_url']}", flush=True)

    # Konfigurasi dicatat untuk bagian "skenario uji" di laporan (API key tidak ikut).
    konfigurasi = {
        "waktu_uji": datetime.now().isoformat(timespec="seconds"),
        **profil,
        "rps_max_tokens": settings.rps_max_tokens,
        "narasi_max_tokens": settings.narasi_max_tokens,
        "llm_timeout_seconds": settings.llm_timeout_seconds,
        "llm_max_retries_koneksi": settings.llm_max_retries,
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
        "jenis_uji": args.hanya,
        "berkas_kasus": Path(args.kasus).name,
        "jeda_detik": args.jeda,
        "tunggu_kuota_detik": args.tunggu_kuota,
        "maks_ulang_kuota": args.maks_ulang_kuota,
        "maks_retry_evaluasi_cpmk": 1,
        "jumlah_kasus_evaluasi_cpmk": len(kasus.get("evaluasi_cpmk", [])),
    }
    (folder / "konfigurasi.json").write_text(json.dumps(konfigurasi, ensure_ascii=False, indent=2), encoding="utf-8")

    # Pemanasan: muat model embedding + satu query sebelum diukur, agar waktu retrieval
    # kasus pertama tidak ikut menanggung waktu memuat model (±7 detik pada uji kering).
    retrieve_documents("pemanasan", k=1)

    if args.hanya in ("rps", "semua") and kasus.get("rps"):
        rps, pel = uji_rps(kasus["rps"], ulangan, folder, args.web_dingin)
        tulis_csv(folder / "rps.csv", rps)
        tulis_csv(folder / "rps_pelanggaran.csv", pel)
        n = len(rps)
        print(f"\nRPS: lolos percobaan-1 {sum(r['lolos_percobaan_1'] for r in rps)}/{n}, "
              f"lolos akhir {sum(r['lolos_akhir'] for r in rps)}/{n}")

    if args.hanya in ("narasi", "semua") and kasus.get("narasi"):
        nar, det = uji_narasi(kasus["narasi"], ulangan, folder)
        tulis_csv(folder / "narasi.csv", nar)
        tulis_csv(folder / "narasi_angka.csv", det)
        tot, ok = sum(r["angka_total"] for r in nar), sum(r["angka_cocok"] for r in nar)
        print(f"Narasi: lolos validator {sum(r['lolos_validator'] for r in nar)}/{len(nar)}, "
              f"angka cocok {ok}/{tot}")

    if args.hanya in ("evaluasi", "semua") and kasus.get("evaluasi_cpmk"):
        nama_berkas = ("evaluasi.csv", "evaluasi_pelanggaran.csv", "evaluasi_angka.csv", "evaluasi_status.csv")
        lama = [[] for _ in nama_berkas]
        selesai: set = set()
        if args.lanjut:
            lama = [baca_csv(folder / n) for n in nama_berkas]
            # Keluaran yang gagal karena kuota diulang; detailnya ikut dibuang.
            dibuang = {r["id"] for r in lama[0] if r.get("galat") in ("LLMRateLimitError", "KuotaHarianHabis")}
            lama = [[r for r in rows if r.get("id") not in dibuang] for rows in lama]
            selesai = {(str(r["kasus"]), int(r["ulangan"])) for r in lama[0]}
            print(f"Mode --lanjut: {len(selesai)} keluaran sudah ada, dilewati.", flush=True)
        ev, pel, det, st, berhenti = uji_evaluasi_cpmk(kasus["evaluasi_cpmk"], ulangan, folder, selesai)
        urut = lambda r: (str(r.get("kasus")), int(r.get("ulangan", 0)))  # noqa: E731
        ev, pel, det, st = (sorted(lama[i] + baru, key=urut) for i, baru in enumerate((ev, pel, det, st)))
        tulis_csv(folder / "evaluasi.csv", ev)
        tulis_csv(folder / "evaluasi_pelanggaran.csv", pel)
        tulis_csv(folder / "evaluasi_angka.csv", det)
        tulis_csv(folder / "evaluasi_status.csv", st)
        n = len(ev)
        print(f"\nEvaluasi CPMK: lolos percobaan-1 {sum(r['lolos_percobaan_1'] for r in ev)}/{n}, "
              f"lolos akhir {sum(r['lolos_akhir'] for r in ev)}/{n}, "
              f"angka cocok {sum(r['angka_cocok'] for r in ev)}/{sum(r['angka_total'] for r in ev)}, "
              f"status benar {sum(r['status_benar'] for r in ev)}/{sum(r['status_harapan'] for r in ev)}")
        total = len(kasus["evaluasi_cpmk"]) * ulangan
        if berhenti or n < total:
            print(f"BELUM LENGKAP: {n}/{total} keluaran. Jalankan lagi perintah yang sama dengan --lanjut "
                  "setelah jatah harian direset (Cloudflare: pukul 07.00 WIB).")
    elif args.hanya in ("evaluasi", "semua"):
        print("\nBagian 'evaluasi_cpmk' di kasus uji masih kosong; evaluasi CPMK dilewati.")

    print(f"\nHasil tersimpan di {folder}. Periksa manual baris cocok=0 di *_angka.csv dan baris "
          "benar=0 di evaluasi_status.csv, lalu jalankan grafik.py.")


if __name__ == "__main__":
    main()
