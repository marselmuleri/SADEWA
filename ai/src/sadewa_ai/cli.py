"""
CLI kecil untuk uji coba manual dari terminal, tanpa perlu menulis skrip
sekali-pakai atau menaruh kode demo di dalam modul pipeline itu sendiri.

Contoh pakai (setelah `pip install -e .`):

    sadewa-ai health
    sadewa-ai demo-rps
    sadewa-ai demo-narasi
"""

import argparse
import json
import sys

from .logging_config import setup_logging
from .service import (
    generate_narasi_service,
    generate_rps_service,
    health_check,
)


def _cmd_health(_args: argparse.Namespace) -> None:
    print(json.dumps(health_check().model_dump(), indent=2, ensure_ascii=False))


def _cmd_demo_rps(_args: argparse.Namespace) -> None:
    hasil = generate_rps_service(
        mk_name="Jaringan Syaraf Tiruan",
        sks=2,
        semester="Ganjil",
        prodi="Teknik Komputer",
        deskripsi="Mata kuliah yang membahas konsep dan implementasi neural network modern",
    )
    print(json.dumps(hasil.model_dump(), indent=2, ensure_ascii=False))
    if not hasil.success:
        sys.exit(1)


def _cmd_demo_narasi(_args: argparse.Namespace) -> None:
    hasil = generate_narasi_service(
        mk_name="Jaringan Syaraf Tiruan",
        prodi="Teknik Komputer",
        semester="Ganjil",
        tahun_ajaran="2025/2026",
        capaian=[
            {
                "kode": "CPL 3",
                "deskripsi": "Mampu merancang dan menganalisis model neural network",
                "nilai_rata_rata": 68.4,
                "jumlah_mahasiswa": 40,
                "jumlah_tercapai": 22,
            },
            {
                "kode": "CPL 5",
                "deskripsi": "Mampu menerapkan perangkat lunak untuk analisis data",
                "nilai_rata_rata": 81.2,
                "jumlah_mahasiswa": 40,
                "jumlah_tercapai": 35,
            },
        ],
    )
    print(json.dumps(hasil.model_dump(), indent=2, ensure_ascii=False))
    if not hasil.success:
        sys.exit(1)


def main() -> None:
    setup_logging()

    parser = argparse.ArgumentParser(prog="sadewa-ai", description="CLI modul AI SADEWA")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("health", help="Cek status vectorstore & konfigurasi LLM").set_defaults(func=_cmd_health)
    sub.add_parser("demo-rps", help="Contoh pemanggilan generate_rps_service()").set_defaults(func=_cmd_demo_rps)
    sub.add_parser("demo-narasi", help="Contoh pemanggilan generate_narasi_service()").set_defaults(func=_cmd_demo_narasi)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
