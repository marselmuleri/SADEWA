"""
Test Spesifikasi OBE: Kontrak Fungsi Murni Kalkulasi OBE (Formula SIMAK-NG).

KONTRAK MODUL app.services.calculation.obe_formula:
--------------------------------------------------
1. cell_poin(bobot: Decimal, nilai: Decimal) -> Decimal
   - Menghitung kontribusi poin sel: bobot * nilai / 100
   - Dibulatkan 2 desimal dengan mode ROUND_HALF_UP.

2. compute_result(cpmk_ik: dict, matrix: dict, nilai: dict, ik_cpl: dict) -> HasilOBE
   - cpmk_ik: dict[str, dict[str, Decimal]] -> bobot IK per CPMK
   - matrix: dict[str, dict[str, Decimal]]  -> bobot poin sel per bentuk penilaian x IK
   - nilai: dict[str, dict[str, Decimal]]   -> nilai mentah 0-100 mahasiswa per bentuk penilaian x IK
   - ik_cpl: dict[str, str]                 -> relasi IK ke kode CPL
   - return: objek/namedtuple/dataclass dengan atribut:
     * poin_ik: dict[str, Decimal]          (akumulasi poin per IK, dibulatkan 2 desimal)
     * poin_cpl: dict[str, Decimal]         (akumulasi poin per CPL dari IK miliknya)
     * persen_cpl: dict[str, Decimal]       (persen ketercapaian = poin_cpl / total_bobot_cpl * 100, dibulatkan 2 desimal)
     * nilai_akhir: Decimal                 (dihitung dari akumulasi poin belum dibulatkan, lalu dibulatkan 2 desimal)

3. pilih_huruf(nilai: Decimal, skala: list[tuple[str, Decimal]]) -> str | None
   - Menentukan huruf nilai berdasarkan batas_min terbesar yang <= nilai.
   - Jika skala kosong atau belum diatur, return None.

Catatan: Modul 'app.services.calculation.obe_formula' belum ada di codebase aplikasi,
sehingga test ini sengaja akan gagal dengan ImportError saat dijalankan.
"""

from decimal import Decimal
import pytest

def _import_formula():
    from app.services.calculation.obe_formula import cell_poin, compute_result, pilih_huruf
    return cell_poin, compute_result, pilih_huruf


def test_cell_poin_rounding_half_up():
    """
    Test pembulatan cell_poin():
    - 12.5 * 75 / 100 = 9.375 -> dibulatkan 9.38
    - 13.5 * 75 / 100 = 10.125 -> dibulatkan 10.13
    """
    cell_poin, compute_result, pilih_huruf = _import_formula()
    assert cell_poin(Decimal("12.5"), Decimal("75")) == Decimal("9.38")
    assert cell_poin(Decimal("13.5"), Decimal("75")) == Decimal("10.13")


def test_kasus_putu_sandra():
    """
    Test Kasus 1 (Putu Sandra) sesuai spesifikasi dokumen SIMAK-NG:
    Konfigurasi MK:
      CPMK1(CP1) bobot 5: IK1b=5
      CPMK2(CP2) bobot 20: IK2a=10, IK2c=10
      CPMK4(CP4) bobot 37.5: IK4c=37.5
      CPMK6(CP6) bobot 12.5: IK6c=12.5
      CPMK7(CP7) bobot 12.5: IK7a=12.5
      CPMK8(CP8) bobot 12.5: IK8a=4, IK8b=4.5, IK8c=4
    Matriks:
      Tugas(50): IK1b 0.5, IK2a 4, IK2c 10, IK4c 6, IK6c 12.5, IK7a 4.5, IK8a 4, IK8b 4.5, IK8c 4
      Kuis(10): IK1b 1.5, IK4c 4, IK7a 4.5
      UTS(20): IK1b 3, IK4c 13.5, IK7a 3.5
      UAS(20): IK2a 6, IK4c 14
    Nilai Putu Sandra:
      Tugas: IK1b 100, IK2a 100, IK2c 75, IK4c 100, IK6c 75, IK7a 50, IK8a 50, IK8b 50, IK8c 100
      Kuis: IK1b 50, IK4c 100, IK7a 100
      UTS: IK1b 75, IK4c 75, IK7a 50
      UAS: IK2a 100, IK4c 50
    Ekspektasi:
      poin_cpl: CP1=3.50, CP2=17.50, CP4=27.13, CP6=9.38, CP7=8.50, CP8=8.25
      persen_cpl: CP1=70.00, CP2=87.50, CP4=72.35, CP6=75.04, CP7=68.00, CP8=66.00
      nilai_akhir: 74.25
    """
    cpmk_ik = {
        "CPMK1": {"IK1b": Decimal("5")},
        "CPMK2": {"IK2a": Decimal("10"), "IK2c": Decimal("10")},
        "CPMK4": {"IK4c": Decimal("37.5")},
        "CPMK6": {"IK6c": Decimal("12.5")},
        "CPMK7": {"IK7a": Decimal("12.5")},
        "CPMK8": {"IK8a": Decimal("4"), "IK8b": Decimal("4.5"), "IK8c": Decimal("4")},
    }

    ik_cpl = {
        "IK1b": "CP1",
        "IK2a": "CP2",
        "IK2c": "CP2",
        "IK4c": "CP4",
        "IK6c": "CP6",
        "IK7a": "CP7",
        "IK8a": "CP8",
        "IK8b": "CP8",
        "IK8c": "CP8",
    }

    matrix = {
        "Tugas": {
            "IK1b": Decimal("0.5"), "IK2a": Decimal("4"), "IK2c": Decimal("10"),
            "IK4c": Decimal("6"), "IK6c": Decimal("12.5"), "IK7a": Decimal("4.5"),
            "IK8a": Decimal("4"), "IK8b": Decimal("4.5"), "IK8c": Decimal("4"),
        },
        "Kuis": {
            "IK1b": Decimal("1.5"), "IK4c": Decimal("4"), "IK7a": Decimal("4.5"),
        },
        "UTS": {
            "IK1b": Decimal("3"), "IK4c": Decimal("13.5"), "IK7a": Decimal("3.5"),
        },
        "UAS": {
            "IK2a": Decimal("6"), "IK4c": Decimal("14"),
        },
    }

    nilai = {
        "Tugas": {
            "IK1b": Decimal("100"), "IK2a": Decimal("100"), "IK2c": Decimal("75"),
            "IK4c": Decimal("100"), "IK6c": Decimal("75"), "IK7a": Decimal("50"),
            "IK8a": Decimal("50"), "IK8b": Decimal("50"), "IK8c": Decimal("100"),
        },
        "Kuis": {
            "IK1b": Decimal("50"), "IK4c": Decimal("100"), "IK7a": Decimal("100"),
        },
        "UTS": {
            "IK1b": Decimal("75"), "IK4c": Decimal("75"), "IK7a": Decimal("50"),
        },
        "UAS": {
            "IK2a": Decimal("100"), "IK4c": Decimal("50"),
        },
    }

    cell_poin, compute_result, pilih_huruf = _import_formula()
    hasil = compute_result(cpmk_ik=cpmk_ik, matrix=matrix, nilai=nilai, ik_cpl=ik_cpl)

    assert hasil.poin_cpl["CP1"] == Decimal("3.50")
    assert hasil.poin_cpl["CP2"] == Decimal("17.50")
    assert hasil.poin_cpl["CP4"] == Decimal("27.13")
    assert hasil.poin_cpl["CP6"] == Decimal("9.38")
    assert hasil.poin_cpl["CP7"] == Decimal("8.50")
    assert hasil.poin_cpl["CP8"] == Decimal("8.25")

    assert hasil.persen_cpl["CP1"] == Decimal("70.00")
    assert hasil.persen_cpl["CP2"] == Decimal("87.50")
    assert hasil.persen_cpl["CP4"] == Decimal("72.35")
    assert hasil.persen_cpl["CP6"] == Decimal("75.04")
    assert hasil.persen_cpl["CP7"] == Decimal("68.00")
    assert hasil.persen_cpl["CP8"] == Decimal("66.00")

    assert hasil.nilai_akhir == Decimal("74.25")


def test_pembulatan_terpisah_nilai_akhir_vs_poin_cpl():
    """
    Bukti pemisahan pembulatan:
    Jumlah poin terbulat per CP = 3.50 + 17.50 + 27.13 + 9.38 + 8.50 + 8.25 = 74.26,
    namun nilai_akhir harus 74.25 (akumulasi poin mentah belum dibulatkan = 74.245 -> 74.25).
    """
    cpmk_ik = {
        "CPMK1": {"IK1b": Decimal("5")},
        "CPMK2": {"IK2a": Decimal("10"), "IK2c": Decimal("10")},
        "CPMK4": {"IK4c": Decimal("37.5")},
        "CPMK6": {"IK6c": Decimal("12.5")},
        "CPMK7": {"IK7a": Decimal("12.5")},
        "CPMK8": {"IK8a": Decimal("4"), "IK8b": Decimal("4.5"), "IK8c": Decimal("4")},
    }
    ik_cpl = {
        "IK1b": "CP1", "IK2a": "CP2", "IK2c": "CP2", "IK4c": "CP4",
        "IK6c": "CP6", "IK7a": "CP7", "IK8a": "CP8", "IK8b": "CP8", "IK8c": "CP8",
    }
    matrix = {
        "Tugas": {
            "IK1b": Decimal("0.5"), "IK2a": Decimal("4"), "IK2c": Decimal("10"),
            "IK4c": Decimal("6"), "IK6c": Decimal("12.5"), "IK7a": Decimal("4.5"),
            "IK8a": Decimal("4"), "IK8b": Decimal("4.5"), "IK8c": Decimal("4"),
        },
        "Kuis": {"IK1b": Decimal("1.5"), "IK4c": Decimal("4"), "IK7a": Decimal("4.5")},
        "UTS": {"IK1b": Decimal("3"), "IK4c": Decimal("13.5"), "IK7a": Decimal("3.5")},
        "UAS": {"IK2a": Decimal("6"), "IK4c": Decimal("14")},
    }
    nilai = {
        "Tugas": {
            "IK1b": Decimal("100"), "IK2a": Decimal("100"), "IK2c": Decimal("75"),
            "IK4c": Decimal("100"), "IK6c": Decimal("75"), "IK7a": Decimal("50"),
            "IK8a": Decimal("50"), "IK8b": Decimal("50"), "IK8c": Decimal("100"),
        },
        "Kuis": {"IK1b": Decimal("50"), "IK4c": Decimal("100"), "IK7a": Decimal("100")},
        "UTS": {"IK1b": Decimal("75"), "IK4c": Decimal("75"), "IK7a": Decimal("50")},
        "UAS": {"IK2a": Decimal("100"), "IK4c": Decimal("50")},
    }

    cell_poin, compute_result, pilih_huruf = _import_formula()
    hasil = compute_result(cpmk_ik=cpmk_ik, matrix=matrix, nilai=nilai, ik_cpl=ik_cpl)
    sum_poin_terbulat = sum(hasil.poin_cpl.values())
    assert sum_poin_terbulat == Decimal("74.26")
    assert hasil.nilai_akhir == Decimal("74.25")
    assert hasil.nilai_akhir != sum_poin_terbulat


def test_kasus_nilai_kosong():
    """
    Kasus tanpa input nilai sama sekali: semua sel tanpa nilai dihitung 0.
    nilai_akhir harus 0.00.
    """
    cell_poin, compute_result, pilih_huruf = _import_formula()
    cpmk_ik = {"CPMK1": {"IK1a": Decimal("100")}}
    matrix = {"UAS": {"IK1a": Decimal("100")}}
    nilai = {}
    ik_cpl = {"IK1a": "CP1"}

    hasil = compute_result(cpmk_ik=cpmk_ik, matrix=matrix, nilai=nilai, ik_cpl=ik_cpl)
    assert hasil.nilai_akhir == Decimal("0.00")
    assert hasil.poin_ik["IK1a"] == Decimal("0.00")
    assert hasil.persen_cpl["CP1"] == Decimal("0.00")


def test_kasus_multi_cpl_dalam_satu_cpmk():
    """
    Satu CPMK memetakan IK dari CPL berbeda (misal CPMK1 memetakan IK1a dari CP1 dan IK2a dari CP2).
    Poin dan persen harus masuk ke masing-masing CPL lewat IK, bukan disatukan ke satu CPL.
    """
    cell_poin, compute_result, pilih_huruf = _import_formula()
    cpmk_ik = {
        "CPMK1": {"IK1a": Decimal("50"), "IK2a": Decimal("50")},
    }
    matrix = {
        "Tugas": {"IK1a": Decimal("50"), "IK2a": Decimal("50")},
    }
    nilai = {
        "Tugas": {"IK1a": Decimal("80"), "IK2a": Decimal("60")},
    }
    ik_cpl = {
        "IK1a": "CP1",
        "IK2a": "CP2",
    }

    hasil = compute_result(cpmk_ik=cpmk_ik, matrix=matrix, nilai=nilai, ik_cpl=ik_cpl)
    # IK1a: 50 * 80 / 100 = 40.00 -> CP1 = 40.00 (persen: 40/50*100 = 80.00)
    # IK2a: 50 * 60 / 100 = 30.00 -> CP2 = 30.00 (persen: 30/50*100 = 60.00)
    assert hasil.poin_cpl["CP1"] == Decimal("40.00")
    assert hasil.poin_cpl["CP2"] == Decimal("30.00")
    assert hasil.persen_cpl["CP1"] == Decimal("80.00")
    assert hasil.persen_cpl["CP2"] == Decimal("60.00")
    assert hasil.nilai_akhir == Decimal("70.00")


def test_kasus_bobot_cp_nol_tidak_division_by_zero():
    """
    Jika ada CPL yang bobot IK-nya di MK = 0, persen_cpl harus 0.00 tanpa melempar ZeroDivisionError.
    """
    cell_poin, compute_result, pilih_huruf = _import_formula()
    cpmk_ik = {
        "CPMK1": {"IK1a": Decimal("0")},
    }
    matrix = {
        "Tugas": {"IK1a": Decimal("0")},
    }
    nilai = {
        "Tugas": {"IK1a": Decimal("100")},
    }
    ik_cpl = {
        "IK1a": "CP1",
    }

    hasil = compute_result(cpmk_ik=cpmk_ik, matrix=matrix, nilai=nilai, ik_cpl=ik_cpl)
    assert hasil.persen_cpl["CP1"] == Decimal("0.00")
