"""
Konfigurasi logging seragam untuk seluruh entry point (CLI, ingest, API).

Sebelumnya tiap skrip memanggil `logging.basicConfig(...)` sendiri-sendiri
dengan format yang bisa berbeda-beda. Dipusatkan di sini supaya format log
konsisten di mana pun modul ini dijalankan, dan supaya level log bisa diatur
lewat satu env var (LOG_LEVEL) tanpa mengubah kode.
"""

import logging
import os


def setup_logging(level: str | None = None) -> None:
    """
    Panggil sekali di awal proses (entry point CLI / lifespan FastAPI).

    Aman dipanggil berkali-kali — `force=True` mencegah handler duplikat
    kalau entry point lain sudah memanggilnya lebih dulu (mis. saat test
    mengimpor beberapa modul yang masing-masing punya entry point sendiri).
    """
    resolved_level = (level or os.getenv("LOG_LEVEL", "INFO")).upper()
    logging.basicConfig(
        level=resolved_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        force=True,
    )
