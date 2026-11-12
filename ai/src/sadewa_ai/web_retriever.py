"""
Web Retriever — pencarian referensi RPS dari universitas lain.

Menggunakan paket ddgs (gabungan beberapa mesin pencari, cadangan DuckDuckGo;
gratis, tanpa API key) untuk mencari RPS dari universitas lain yang memiliki
program studi serupa. Halaman HTML dibaca dengan trafilatura, dokumen PDF dengan
pypdf, lalu disusun menjadi blok konteks tambahan untuk prompt AI.

Referensi ini hanya digunakan secara internal di dalam prompt —
TIDAK ditampilkan ke pengguna di frontend.

Fitur:
- Paralel: dua query pencarian dan pembacaan beberapa situs berjalan bersamaan.
- Batas waktu total (settings.web_budget_seconds): apa yang sudah terkumpul saat
  batas tercapai tetap dipakai, situs yang lambat ditinggal.
- Cache in-memory + cache file (settings.web_cache_days) per (mk_name, prodi),
  sehingga generate ulang mata kuliah yang sama tidak mencari ulang, walau
  server di-restart.
- Fallback graceful: bila search atau scraping gagal (timeout, rate limit,
  halaman kosong), fungsi tetap mengembalikan string kosong tanpa error.
"""

import io
import json
import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed, wait
from concurrent.futures import TimeoutError as FuturesTimeout
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

from .config import settings

logger = logging.getLogger(__name__)
# Log internal ddgs (mesin pencari yang gagal di dalam "auto") dan peringatan pypdf
# untuk PDF yang strukturnya agak rusak ("Ignoring wrong pointing object") hanya
# membingungkan di konsol; teks tetap terbaca.
logging.getLogger("ddgs").setLevel(logging.ERROR)
logging.getLogger("pypdf").setLevel(logging.ERROR)

# Cache in-memory: key = (mk_name_lower, prodi_lower), value = str konteks
_cache: Dict[tuple, str] = {}
_cache_lock = threading.Lock()

# Jumlah URL yang akan di-scrape per pencarian (lebih banyak = lebih lambat)
_MAX_URLS = 3

# Batas karakter konten per URL agar prompt tidak terlalu panjang
_MAX_CHARS_PER_URL = 1200

# Timeout per permintaan (detik). Batas waktu total ada di settings.web_budget_seconds.
_SEARCH_TIMEOUT = 5
_SCRAPE_TIMEOUT = 5

# Halaman PDF yang dibaca per dokumen (bagian awal RPS memuat CPL/CPMK dan deskripsi)
_MAX_PDF_PAGES = 3

_USER_AGENT = "Mozilla/5.0 (compatible; SADEWA-RPS-Reference/1.0)"

# Situs yang isinya terkunci login/paywall: lambat dan tidak menghasilkan teks.
_DOMAIN_DILEWATI = ("scribd.com", "studocu", "docplayer.info", "academia.edu")

# Mesin pencari di paket `ddgs` (penerus duckduckgo-search) yang dijalankan
# BERSAMAAN; hasil relevan pertama yang masuk langsung dipakai. Dari pengukuran,
# ketiganya menjawab dalam 1-3 detik tetapi tidak selalu berhasil, sedangkan
# "auto"/DuckDuckGo butuh 6-13 detik karena sering menolak koneksi.
_BACKENDS = ("bing", "yahoo", "google")

# Kata umum yang tidak membantu menilai relevansi judul/URL hasil pencarian.
_KATA_UMUM = {"dan", "and", "the", "of", "untuk", "dengan", "pada", "dasar", "pengantar"}


# --- Pencarian -----------------------------------------------------------------

def _ddgs_class():
    """Kelas DDGS dari paket `ddgs`; fallback ke `duckduckgo_search` versi lama."""
    try:
        from ddgs import DDGS
        return DDGS
    except ImportError:
        import warnings
        warnings.filterwarnings("ignore", message=".*renamed to `ddgs`.*")
        from duckduckgo_search import DDGS
        return DDGS


def _kata_kunci(mk_name: str) -> List[str]:
    kata = re.findall(r"[a-z0-9]+", mk_name.lower())
    return [k for k in kata if len(k) > 3 and k not in _KATA_UMUM]


def _relevan(hasil: dict, kata_kunci: List[str]) -> bool:
    """Hasil dianggap relevan bila judul/URL memuat salah satu kata kunci mata kuliah."""
    href = hasil.get("href", "")
    if any(d in urlparse(href).netloc for d in _DOMAIN_DILEWATI):
        return False
    if not kata_kunci:
        return True
    teks = f"{hasil.get('title', '')} {href}".lower()
    return any(k in teks for k in kata_kunci)


def _search_urls(query: str, mk_name: str = "") -> List[str]:
    """Cari URL hasil pencarian yang relevan dengan mata kuliah. Kosong bila semua backend gagal."""
    try:
        DDGS = _ddgs_class()
    except ImportError as exc:
        logger.warning("[web_retriever] Paket pencarian web belum terpasang: %s", exc)
        return []

    kata_kunci = _kata_kunci(mk_name)

    def satu_backend(backend: str) -> List[str]:
        try:
            results = DDGS(timeout=_SEARCH_TIMEOUT).text(query, max_results=10, backend=backend)
        except TypeError:  # duckduckgo_search lama: tanpa argumen timeout / backend
            results = DDGS().text(query, max_results=10)
        return [r["href"] for r in results or [] if r.get("href") and _relevan(r, kata_kunci)]

    pool = ThreadPoolExecutor(max_workers=len(_BACKENDS), thread_name_prefix="web_cari")
    try:
        futures = {pool.submit(satu_backend, b): b for b in _BACKENDS}
        try:
            for f in as_completed(futures, timeout=_SEARCH_TIMEOUT + 2):
                try:
                    urls = f.result()
                except Exception as exc:
                    logger.info("[web_retriever] Backend %s gagal untuk %r: %s", futures[f], query, exc)
                    continue
                if urls:
                    return urls[:_MAX_URLS]
        except FuturesTimeout:
            pass
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    logger.info("[web_retriever] Pencarian tidak menemukan hasil relevan untuk %r", query)
    return []


# --- Membaca isi situs -----------------------------------------------------------

def _teks_pdf(isi: bytes) -> str:
    """Ambil teks beberapa halaman awal PDF (banyak RPS universitas diunggah sebagai PDF)."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(isi))
    bagian: List[str] = []
    for halaman in reader.pages[:_MAX_PDF_PAGES]:
        bagian.append(halaman.extract_text() or "")
        if sum(len(b) for b in bagian) >= _MAX_CHARS_PER_URL:
            break
    return re.sub(r"[ \t]+", " ", "\n".join(bagian))


def _scrape_url(url: str) -> str:
    """Ekstrak konten teks dari satu URL: PDF lewat pypdf, halaman HTML lewat trafilatura."""
    try:
        import requests

        resp = requests.get(url, timeout=_SCRAPE_TIMEOUT, headers={"User-Agent": _USER_AGENT})
        resp.raise_for_status()
        jenis = resp.headers.get("content-type", "").lower()
        if "pdf" in jenis or url.lower().split("?")[0].endswith(".pdf"):
            text = _teks_pdf(resp.content)
        else:
            import trafilatura

            text = trafilatura.extract(
                resp.text,
                include_tables=False,
                include_comments=False,
                no_fallback=False,
            )
        if not text:
            return ""
        # Potong agar tidak terlalu panjang
        return text[:_MAX_CHARS_PER_URL].strip()
    except Exception as exc:
        logger.info("[web_retriever] Scraping gagal untuk %s: %s", url, exc)
        return ""


def _build_context(hasil: List[Tuple[str, str]], mk_name: str) -> str:
    """Susun blok konteks dari pasangan (url, isi) yang sudah dibaca."""
    parts = []
    for url, content in hasil:
        if len(content) < 150:
            # Konten terlalu pendek / tidak relevan, skip
            continue
        # Nama domain sebagai label sumber (tidak ditampilkan ke user,
        # hanya untuk membantu AI membedakan sumber)
        domain = urlparse(url).netloc.replace("www.", "") or "universitas lain"
        parts.append(f"[Referensi dari {domain}]\n{content}")
        logger.info("[web_retriever] Scraped %d chars dari %s", len(content), domain)

    if not parts:
        return ""

    header = (
        f"=== REFERENSI RPS {mk_name.upper()} DARI UNIVERSITAS LAIN ===\n"
        "Gunakan sebagai referensi perbandingan materi dan struktur saja.\n"
        "Prioritas utama tetap dokumen kurikulum resmi di atas.\n\n"
    )
    return header + "\n\n---\n\n".join(parts)


# --- Cache file ------------------------------------------------------------------

def _kunci_file(cache_key: tuple) -> str:
    return "||".join(cache_key)


def _baca_cache_file(cache_key: tuple) -> Optional[str]:
    if settings.web_cache_days <= 0:
        return None
    try:
        data = json.loads(Path(settings.web_cache_path).read_text(encoding="utf-8"))
        entri = data.get(_kunci_file(cache_key))
        if entri and time.time() - entri["waktu"] < settings.web_cache_days * 86400:
            return entri["konteks"]
    except (OSError, ValueError, KeyError, TypeError):
        pass
    return None


def _tulis_cache_file(cache_key: tuple, konteks: str) -> None:
    if settings.web_cache_days <= 0 or not konteks:
        return  # hasil kosong tidak disimpan: bisa jadi hanya gangguan jaringan sesaat
    path = Path(settings.web_cache_path)
    try:
        with _cache_lock:
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                data = {}
            data[_kunci_file(cache_key)] = {"waktu": time.time(), "konteks": konteks}
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            tmp.replace(path)
    except OSError as exc:
        logger.info("[web_retriever] Cache file tidak bisa ditulis: %s", exc)


def clear_cache(mk_name: Optional[str] = None, prodi: Optional[str] = None, file: bool = True) -> None:
    """Hapus cache (semua, atau satu mata kuliah). Dipakai skrip uji untuk mengukur waktu tanpa cache."""
    key = (mk_name.lower().strip(), prodi.lower().strip()) if mk_name and prodi else None
    with _cache_lock:
        if key:
            _cache.pop(key, None)
        else:
            _cache.clear()
        if not file:
            return
        path = Path(settings.web_cache_path)
        try:
            if key is None:
                path.unlink(missing_ok=True)
            else:
                data = json.loads(path.read_text(encoding="utf-8"))
                if data.pop(_kunci_file(key), None) is not None:
                    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        except (OSError, ValueError):
            pass


# --- Fungsi utama ------------------------------------------------------------------

def fetch_web_context(mk_name: str, prodi: str) -> str:
    """
    Ambil referensi RPS dari universitas lain via pencarian web + scraping.

    Parameter:
        mk_name : nama mata kuliah (contoh: "Pemrograman Web")
        prodi   : program studi (contoh: "Teknik Komputer")

    Mengembalikan:
        String blok konteks referensi web, atau string kosong bila
        pencarian/scraping gagal atau melewati batas waktu (graceful fallback).
    """
    cache_key = (mk_name.lower().strip(), prodi.lower().strip())

    with _cache_lock:
        if cache_key in _cache:
            logger.info("[web_retriever] Cache hit untuk '%s' - '%s'", mk_name, prodi)
            return _cache[cache_key]

    dari_file = _baca_cache_file(cache_key)
    if dari_file is not None:
        logger.info("[web_retriever] Cache file hit untuk '%s' - '%s'", mk_name, prodi)
        with _cache_lock:
            _cache[cache_key] = dari_file
        return dari_file

    logger.info("[web_retriever] Mencari referensi web untuk '%s' prodi '%s'...", mk_name, prodi)
    batas = time.monotonic() + settings.web_budget_seconds

    def sisa() -> float:
        return max(0.0, batas - time.monotonic())

    # Query dibuat pendek. Query panjang berisi kutipan + istilah OBE/CPL/CPMK
    # hampir selalu kosong. Prodi tidak disertakan karena justru menyempitkan
    # hasil; relevansi dijaga oleh filter kata kunci nama MK.
    queries = (f"RPS {mk_name} site:ac.id", f"rencana pembelajaran semester {mk_name}")

    # Pool tidak dipakai dengan `with`: keluar dari `with` menunggu semua thread,
    # padahal tujuan batas waktu justru tidak menunggu situs yang lambat.
    pool = ThreadPoolExecutor(max_workers=len(queries) + _MAX_URLS, thread_name_prefix="web_rps")
    try:
        cari = [pool.submit(_search_urls, q, mk_name) for q in queries]
        wait(cari, timeout=sisa())
        urls: List[str] = []
        for f in cari:  # urutan query tetap: hasil site:ac.id diutamakan
            if f.done() and not f.exception():
                urls += [u for u in f.result() if u not in urls]
        urls = urls[:_MAX_URLS]

        if not urls:
            logger.warning("[web_retriever] Tidak ada URL ditemukan untuk '%s'", mk_name)
            with _cache_lock:
                _cache[cache_key] = ""
            return ""

        baca = [(u, pool.submit(_scrape_url, u)) for u in urls]
        wait([f for _, f in baca], timeout=sisa())
        hasil = [(u, f.result()) for u, f in baca if f.done() and not f.exception()]
        ditinggal = len(baca) - len(hasil)
        if ditinggal:
            logger.info("[web_retriever] %d situs ditinggal karena melewati batas waktu", ditinggal)
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    context = _build_context(hasil, mk_name)

    with _cache_lock:
        _cache[cache_key] = context
    _tulis_cache_file(cache_key, context)

    if context:
        logger.info("[web_retriever] Konteks web siap: %d karakter untuk '%s'", len(context), mk_name)
    else:
        logger.warning("[web_retriever] Semua URL gagal di-scrape untuk '%s'", mk_name)

    return context
