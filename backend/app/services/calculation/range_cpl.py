from decimal import Decimal
from typing import Any, Iterable, Optional


def lookup_kategori_cpl(nilai: Decimal | float | None, ranges: Iterable[Any]) -> Optional[str]:
    """
    Lookup nama kategori ketercapaian CPL berdasarkan nilai capaian.
    
    Parameters
    ----------
    nilai : Decimal | float | None
        Nilai capaian CPL (0 - 100).
    ranges : Iterable[Any]
        Kumpulan objek range CPL yang memiliki atribut:
        - nama: str
        - batas_bawah: Decimal | float
        - batas_atas: Decimal | float
        
    Returns
    -------
    str | None
        Nama kategori (misal: "Sangat Baik", "Baik", "Cukup", "Kurang"),
        atau None jika tidak ditemukan rentang yang cocok.
    """
    if nilai is None or not ranges:
        return None

    val = Decimal(str(nilai))
    for r in ranges:
        bawah = Decimal(str(r.batas_bawah))
        atas = Decimal(str(r.batas_atas))
        if bawah <= val <= atas:
            return r.nama

    return None

