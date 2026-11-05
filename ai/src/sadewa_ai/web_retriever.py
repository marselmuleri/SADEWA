"""
Web Retriever — pencarian referensi RPS dari universitas lain.

Menggunakan DuckDuckGo (gratis, tanpa API key) untuk mencari RPS dari
universitas lain yang memiliki program studi serupa. Hasil pencarian
di-scrape kontennya menggunakan trafilatura, lalu disusun menjadi blok
konteks tambahan untuk prompt AI.

Referensi ini hanya digunakan secara internal di dalam prompt —
TIDAK ditampilkan ke pengguna di frontend.

Fitur:
- Cache sederhana in-memory per (mk_name, prodi) agar tidak search ulang
  bila mata kuliah yang sama digenerate lebih dari sekali dalam satu sesi.
- Fallback graceful: bila search atau scraping gagal (timeout, rate limit,
  halaman kosong), fungsi tetap mengembalikan string kosong tanpa error.
"""

import logging
import threading
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Cache in-memory: key = (mk_name_lower, prodi_lower), value = str konteks
_cache: Dict[tuple, str] = {}
_cache_lock = threading.Lock()

# Jumlah URL yang akan di-scrape per pencarian (lebih banyak = lebih lambat)
_MAX_URLS = 3

# Batas karakter konten per URL agar prompt tidak terlalu panjang
_MAX_CHARS_PER_URL = 1200

# Timeout HTTP scraping (detik)
_SCRAPE_TIMEOUT = 6


def _search_urls(query: str) -> list[str]:
    """Cari URL menggunakan DuckDuckGo. Kembalikan list URL hasil search."""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=_MAX_URLS + 2)
        urls = [r["href"] for r in results if r.get("href")]
        return urls[:_MAX_URLS]
    except Exception as exc:
        logger.warning("[web_retriever] DuckDuckGo search gagal: %s", exc)
        return []


def _scrape_url(url: str) -> str:
    """Ekstrak konten teks dari satu URL menggunakan trafilatura."""
    try:
        import trafilatura
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return ""
        text = trafilatura.extract(
            downloaded,
            include_tables=False,
            include_comments=False,
            no_fallback=False,
        )
        if not text:
            return ""
        # Potong agar tidak terlalu panjang
        return text[:_MAX_CHARS_PER_URL].strip()
    except Exception as exc:
        logger.warning("[web_retriever] Scraping gagal untuk %s: %s", url, exc)
        return ""


def _build_context_from_urls(urls: list[str], mk_name: str) -> str:
    """Scrape semua URL dan susun menjadi blok konteks."""
    parts = []
    for url in urls:
        content = _scrape_url(url)
        if len(content) < 150:
            # Konten terlalu pendek / tidak relevan, skip
            continue
        # Ambil nama domain sebagai label sumber (tidak ditampilkan ke user,
        # hanya untuk membantu AI membedakan sumber)
        try:
            from urllib.parse import urlparse
            domain = urlparse(url).netloc.replace("www.", "")
        except Exception:
            domain = "universitas lain"
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


def fetch_web_context(mk_name: str, prodi: str) -> str:
    """
    Ambil referensi RPS dari universitas lain via DuckDuckGo + web scraping.

    Parameter:
        mk_name : nama mata kuliah (contoh: "Pemrograman Web")
        prodi   : program studi (contoh: "Teknik Komputer")

    Mengembalikan:
        String blok konteks referensi web, atau string kosong bila
        pencarian/scraping gagal (graceful fallback).

    Hasil di-cache per (mk_name, prodi) untuk satu sesi server agar tidak
    melakukan request berulang untuk mata kuliah yang sama.
    """
    cache_key = (mk_name.lower().strip(), prodi.lower().strip())

    with _cache_lock:
        if cache_key in _cache:
            logger.info(
                "[web_retriever] Cache hit untuk '%s' - '%s'", mk_name, prodi
            )
            return _cache[cache_key]

    logger.info(
        "[web_retriever] Mencari referensi web untuk '%s' prodi '%s'...",
        mk_name, prodi,
    )

    # Query difokuskan ke domain .ac.id agar hasil lebih relevan
    query = (
        f"RPS \"{mk_name}\" \"{prodi}\" OBE CPL CPMK site:.ac.id"
    )
    urls = _search_urls(query)

    # Kalau hasil pertama kurang, coba query lebih luas (tanpa site: filter)
    if len(urls) < 2:
        query_broad = f"RPS {mk_name} {prodi} OBE capaian pembelajaran semester"
        urls += _search_urls(query_broad)
        # Deduplicate
        seen = set()
        urls = [u for u in urls if not (u in seen or seen.add(u))]
        urls = urls[:_MAX_URLS]

    if not urls:
        logger.warning("[web_retriever] Tidak ada URL ditemukan untuk '%s'", mk_name)
        with _cache_lock:
            _cache[cache_key] = ""
        return ""

    context = _build_context_from_urls(urls, mk_name)

    with _cache_lock:
        _cache[cache_key] = context

    if context:
        logger.info(
            "[web_retriever] Konteks web siap: %d karakter untuk '%s'",
            len(context), mk_name,
        )
    else:
        logger.warning(
            "[web_retriever] Semua URL gagal di-scrape untuk '%s'", mk_name
        )

    return context

