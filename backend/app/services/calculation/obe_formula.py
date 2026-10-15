"""
Modul Rumus Kalkulasi OBE (Formula SIMAK-NG).

Aturan Pembulatan & Presisi:
----------------------------
1. Seluruh operasi menggunakan tipe Decimal, tidak menggunakan float.
2. Poin per sel:
   poin_sel = bobot_sel * nilai / 100
   dibulatkan 2 desimal dengan ROUND_HALF_UP.
3. Poin per IK:
   poin_ik = jumlah poin_sel lintas bentuk penilaian untuk IK tersebut (2 desimal).
4. Poin per CPL:
   poin_cpl = jumlah poin_ik dari semua IK milik CPL tersebut pada mata kuliah ini
   (menggunakan poin_ik yang SUDAH dibulatkan, 2 desimal).
5. Persen ketercapaian CPL:
   bobot_cp = jumlah bobot IK (pada mapping CPMK) milik CPL tersebut pada mata kuliah ini.
   persen_cpl = (poin_cpl / bobot_cp * 100), dibulatkan 2 desimal ROUND_HALF_UP.
   Jika bobot_cp == 0, persen_cpl = Decimal("0.00") (tanpa ZeroDivisionError).
6. Nilai akhir mahasiswa:
   nilai_akhir = akumulasi seluruh poin sel yang BELUM dibulatkan (raw),
   lalu setelah dijumlahkan seluruhnya baru dibulatkan 2 desimal ROUND_HALF_UP.
   (Catatan: nilai_akhir dapat berbeda 0.01 dari penjumlahan poin_cpl yang sudah dibulatkan).
7. Penentuan huruf (pilih_huruf):
   Memilih huruf dengan batas_min terbesar yang <= nilai_akhir.
   Jika skala kosong atau belum diatur, mengembalikan None.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple, Union


TWOPLACES = Decimal("0.01")


def _to_decimal(val: Any) -> Decimal:
    """Konversi input ke Decimal secara aman."""
    if isinstance(val, Decimal):
        return val
    return Decimal(str(val))


def cell_poin(bobot: Decimal, nilai: Decimal) -> Decimal:
    """
    Menghitung kontribusi poin sel per (bentuk_penilaian, IK):
    poin = bobot * nilai / 100, dibulatkan 2 desimal ROUND_HALF_UP.
    """
    b = _to_decimal(bobot)
    n = _to_decimal(nilai)
    raw = (b * n) / Decimal("100")
    return raw.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


@dataclass
class HasilOBE:
    poin_ik: Dict[str, Decimal]
    poin_cpl: Dict[str, Decimal]
    persen_cpl: Dict[str, Decimal]
    nilai_akhir: Decimal


def compute_result(
    cpmk_ik: Dict[str, Dict[str, Union[Decimal, float, int]]],
    matrix: Dict[str, Dict[str, Union[Decimal, float, int]]],
    nilai: Dict[str, Dict[str, Union[Decimal, float, int]]],
    ik_cpl: Dict[str, str],
) -> HasilOBE:
    """
    Menghitung capaian OBE deterministik per mahasiswa untuk satu mata kuliah.

    Parameters:
    -----------
    cpmk_ik : dict[cpmk_id/kode, dict[ik_id/kode, bobot]]
        Bobot IK pada mapping CPMK.
    matrix : dict[bentuk_id/nama, dict[ik_id/kode, bobot_sel]]
        Matriks bobot poin sel per bentuk penilaian x IK.
    nilai : dict[bentuk_id/nama, dict[ik_id/kode, nilai]]
        Nilai mentah mahasiswa skala 0-100 per bentuk penilaian x IK.
    ik_cpl : dict[ik_id/kode, cpl_id/kode]
        Pemetaan dari IK ke CPL induknya.
    """
    # Kumpulkan seluruh IK yang relevan
    all_iks = set(ik_cpl.keys())
    for bp_dict in matrix.values():
        all_iks.update(bp_dict.keys())
    for cpmk_dict in cpmk_ik.values():
        all_iks.update(cpmk_dict.keys())

    # Kumpulkan seluruh CPL yang relevan
    all_cpls = set(ik_cpl.values())

    # Hitung poin sel
    poin_ik: Dict[str, Decimal] = {ik: Decimal("0.00") for ik in all_iks}
    raw_total_poin = Decimal("0")

    for bp, ik_bobots in matrix.items():
        bp_nilai = nilai.get(bp, {})
        for ik, bobot_raw in ik_bobots.items():
            b = _to_decimal(bobot_raw)
            val = _to_decimal(bp_nilai.get(ik, Decimal("0")))
            # Raw poin untuk nilai akhir (belum dibulatkan)
            cell_raw = (b * val) / Decimal("100")
            raw_total_poin += cell_raw

            # Poin terbulat untuk akumulasi IK
            cell_rounded = cell_raw.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            poin_ik[ik] = (poin_ik.get(ik, Decimal("0.00")) + cell_rounded).quantize(TWOPLACES, rounding=ROUND_HALF_UP)

    # Nilai akhir: jumlah raw poin dibulatkan 2 desimal
    nilai_akhir = raw_total_poin.quantize(TWOPLACES, rounding=ROUND_HALF_UP)

    # Hitung bobot_cp dari mapping CPMK-IK
    bobot_cp: Dict[str, Decimal] = {cpl: Decimal("0.00") for cpl in all_cpls}
    for cpmk, ik_mappings in cpmk_ik.items():
        for ik, b_ik in ik_mappings.items():
            cpl = ik_cpl.get(ik)
            if cpl:
                bobot_cp[cpl] = bobot_cp.get(cpl, Decimal("0.00")) + _to_decimal(b_ik)

    # Hitung poin_cpl dan persen_cpl
    poin_cpl: Dict[str, Decimal] = {cpl: Decimal("0.00") for cpl in all_cpls}
    persen_cpl: Dict[str, Decimal] = {cpl: Decimal("0.00") for cpl in all_cpls}

    for ik, p_ik in poin_ik.items():
        cpl = ik_cpl.get(ik)
        if cpl:
            poin_cpl[cpl] = (poin_cpl.get(cpl, Decimal("0.00")) + p_ik).quantize(TWOPLACES, rounding=ROUND_HALF_UP)

    for cpl, p_cpl in poin_cpl.items():
        b_cpl = bobot_cp.get(cpl, Decimal("0.00"))
        if b_cpl > Decimal("0"):
            pct = (p_cpl / b_cpl) * Decimal("100")
            persen_cpl[cpl] = pct.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        else:
            persen_cpl[cpl] = Decimal("0.00")

    return HasilOBE(
        poin_ik=poin_ik,
        poin_cpl=poin_cpl,
        persen_cpl=persen_cpl,
        nilai_akhir=nilai_akhir,
    )


def pilih_huruf(
    nilai: Union[Decimal, float, int],
    skala: Union[List[Tuple[str, Union[Decimal, float, int]]], List[Dict[str, Any]]],
) -> Optional[str]:
    """
    Menentukan huruf nilai berdasarkan batas_min terbesar yang <= nilai.
    Jika skala kosong atau belum diatur, mengembalikan None.
    """
    if not skala:
        return None

    val = _to_decimal(nilai)
    kandidat = []

    for item in skala:
        if isinstance(item, (tuple, list)):
            huruf, batas_min = item[0], _to_decimal(item[1])
        elif isinstance(item, dict):
            huruf, batas_min = item["huruf"], _to_decimal(item["batas_min"])
        else:
            huruf, batas_min = getattr(item, "huruf"), _to_decimal(getattr(item, "batas_min"))

        if batas_min <= val:
            kandidat.append((batas_min, huruf))

    if not kandidat:
        return None

    # Urutkan berdasarkan batas_min terbesar
    kandidat.sort(key=lambda x: x[0], reverse=True)
    return kandidat[0][1]

