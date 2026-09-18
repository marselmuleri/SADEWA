"""
Pipeline RAG SADEWA.

Dua keluaran AI sesuai C300 Tabel 25:
1. generate_rps()             -> Draf RPS 16 pertemuan
2. generate_narasi_evaluasi() -> Laporan narasi evaluasi kurikulum

Catatan perubahan: fungsi pencarian tren industri dihapus mengikuti revisi
dosen. Fungsi tersebut juga tidak melakukan retrieval sungguhan, hanya meminta
LLM menebak dari pengetahuan internalnya, sehingga bertentangan dengan alasan
pemilihan RAG pada dokumen C100.
"""

import logging
from typing import Any, Dict, List

from . import prompts
from .config import settings
from .llm_client import chat, extract_json
from .retriever import retrieve_context
from .validators import validate_narasi, validate_rps

logger = logging.getLogger(__name__)


def generate_rps(
    mk_name: str,
    sks: int,
    semester: str,
    prodi: str,
    deskripsi: str,
) -> Dict[str, Any]:
    """
    Bangkitkan draf RPS. Mengembalikan dict berisi:
      - data                : JSON RPS hasil generasi
      - valid               : bool hasil validasi aturan OBE
      - pelanggaran_validasi: list peringatan bila ada
    """
    logger.info("Memulai RAG pipeline RPS untuk: %s", mk_name)

    query = f"RPS {mk_name} {prodi} CPL CPMK capaian pembelajaran OBE"
    context_kurikulum = retrieve_context(query)
    logger.info("Konteks diambil (%d karakter)", len(context_kurikulum))

    prompt = prompts.build_rps_prompt(
        mk_name=mk_name,
        sks=sks,
        semester=semester,
        prodi=prodi,
        deskripsi=deskripsi,
        context_kurikulum=context_kurikulum,
    )

    raw = chat(
        messages=[
            {"role": "system", "content": prompts.SYSTEM_RPS},
            {"role": "user", "content": prompt},
        ],
        max_tokens=settings.rps_max_tokens,
        temperature=settings.rps_temperature,
    )

    data = extract_json(raw)
    valid, errors = validate_rps(data)

    if not valid:
        logger.warning("RPS lolos parsing tetapi melanggar aturan: %s", errors)

    return {
        "data": data,
        "valid": valid,
        "pelanggaran_validasi": errors,
    }


def generate_narasi_evaluasi(
    mk_name: str,
    prodi: str,
    semester: str,
    tahun_ajaran: str,
    capaian: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Bangkitkan laporan narasi evaluasi kurikulum (endpoint SADEWA-21).

    Parameter `capaian` adalah hasil kalkulasi ketercapaian dari backend,
    berisi daftar dict seperti:
        {
            "kode": "CPL 3",
            "deskripsi": "Mampu merancang sistem...",
            "nilai_rata_rata": 68.4,
            "jumlah_mahasiswa": 40,
            "jumlah_tercapai": 22
        }

    Mengembalikan dict dengan bentuk yang sama seperti generate_rps().
    """
    logger.info("Memulai RAG pipeline narasi evaluasi untuk: %s", mk_name)

    query = (
        f"evaluasi ketercapaian CPL CPMK {mk_name} {prodi} "
        "laporan borang akreditasi rekomendasi perbaikan"
    )
    context_kurikulum = retrieve_context(query)
    logger.info("Konteks diambil (%d karakter)", len(context_kurikulum))

    prompt = prompts.build_narasi_prompt(
        mk_name=mk_name,
        prodi=prodi,
        semester=semester,
        tahun_ajaran=tahun_ajaran,
        capaian=capaian,
        context_kurikulum=context_kurikulum,
    )

    raw = chat(
        messages=[
            {"role": "system", "content": prompts.SYSTEM_NARASI},
            {"role": "user", "content": prompt},
        ],
        max_tokens=settings.narasi_max_tokens,
        temperature=settings.narasi_temperature,
    )

    data = extract_json(raw)
    valid, errors = validate_narasi(data)

    if not valid:
        logger.warning("Narasi lolos parsing tetapi tidak lengkap: %s", errors)

    return {
        "data": data,
        "valid": valid,
        "pelanggaran_validasi": errors,
    }
