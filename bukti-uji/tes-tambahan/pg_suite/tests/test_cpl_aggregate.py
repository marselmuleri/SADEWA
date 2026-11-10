from decimal import Decimal
from types import SimpleNamespace

from app.services.calculation.cpl_aggregate import gabung_capaian_cpl


def _row(mhs, cpl, mk, nilai, bobot, angkatan=2024):
    return SimpleNamespace(
        mahasiswa_id=mhs, cpl_id=cpl, mata_kuliah_id=mk,
        nilai=Decimal(str(nilai)), bobot_cp=None if bobot is None else Decimal(str(bobot)), angkatan=angkatan,
    )


def test_gabungan_berbobot_bobot_ik():
    # MK1: 80% dengan bobot IK 30, MK2: 40% dengan bobot IK 10 -> (2400 + 400) / 40 = 70.00
    hasil = gabung_capaian_cpl([_row(1, 10, 101, 80, 30), _row(1, 10, 102, 40, 10)])
    g = hasil[(1, 10)]
    assert g.nilai == Decimal("70.00")
    assert g.jumlah_mata_kuliah == 2
    assert g.angkatan == 2024


def test_baris_lama_hanya_cadangan():
    # Hanya data lama -> dipakai apa adanya
    assert gabung_capaian_cpl([_row(1, 10, None, 65, None)])[(1, 10)].nilai == Decimal("65.00")
    # Ada data per MK -> data lama diabaikan
    hasil = gabung_capaian_cpl([_row(1, 10, None, 10, None), _row(1, 10, 101, 90, 20)])
    assert hasil[(1, 10)].nilai == Decimal("90.00")


def test_bobot_nol_diabaikan_dan_per_mahasiswa_terpisah():
    hasil = gabung_capaian_cpl([_row(1, 10, 101, 50, 0), _row(1, 10, 102, 80, 5), _row(2, 10, 101, 60, 5)])
    assert hasil[(1, 10)].nilai == Decimal("80.00")
    assert hasil[(2, 10)].nilai == Decimal("60.00")
