"""Uji validasi struktur RPS dan narasi evaluasi."""

import copy
import pytest

from sadewa_ai.config import settings
from sadewa_ai.validators import validate_narasi, validate_rps


def buat_rps_valid() -> dict:
    """RPS contoh yang memenuhi seluruh aturan OBE."""
    pertemuan = []
    # 14 pertemuan materi, bobot 50 dibagi rata + UTS 20 + UAS 30 = 100
    bobot_materi = [4, 4, 4, 4, 3, 3, 3, 4, 4, 4, 3, 3, 3, 4]
    minggu_materi = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]

    for minggu, bobot in zip(minggu_materi, bobot_materi):
        pertemuan.append({
            "minggu": minggu,
            "cpmk": "CPMK 1-1",
            "sub_cpmk": "Mampu menjelaskan konsep dasar",
            "materi": f"Materi minggu {minggu}",
            "metode": "Ceramah dan Diskusi",
            "bobot": bobot,
        })

    pertemuan.append({
        "minggu": 8, "cpmk": "-", "sub_cpmk": "-",
        "materi": "UTS", "metode": "Ujian Tertulis", "bobot": 20,
    })
    pertemuan.append({
        "minggu": 16, "cpmk": "-", "sub_cpmk": "-",
        "materi": "UAS", "metode": "Ujian Tertulis", "bobot": 30,
    })
    pertemuan.sort(key=lambda x: x["minggu"])

    return {
        "kode_mk": "TKK1234",
        "deskripsi_mk": "Mata kuliah tentang jaringan syaraf tiruan.",
        "cpl": [{"kode": "CPL 3", "deskripsi": "Mampu merancang sistem"}],
        "cpmk": [{"kode": "CPMK 1-1", "deskripsi": "Memahami konsep dasar"}],
        "pertemuan": pertemuan,
    }


def test_rps_valid_lolos():
    valid, errors = validate_rps(buat_rps_valid())
    assert valid, f"Seharusnya valid, tapi ada error: {errors}"
    assert errors == []


def test_total_bobot_salah_terdeteksi():
    data = buat_rps_valid()
    data["pertemuan"][0]["bobot"] = 99
    valid, errors = validate_rps(data)
    assert not valid
    assert any("Total bobot" in e for e in errors)


def test_jumlah_pertemuan_kurang_terdeteksi():
    data = buat_rps_valid()
    data["pertemuan"] = data["pertemuan"][:10]
    valid, errors = validate_rps(data)
    assert not valid
    assert any("Jumlah pertemuan" in e for e in errors)


def test_uts_bukan_di_minggu_8_terdeteksi():
    data = buat_rps_valid()
    for item in data["pertemuan"]:
        if item["minggu"] == settings.minggu_uts:
            item["materi"] = "Materi biasa"
    valid, errors = validate_rps(data)
    assert not valid
    assert any("UTS" in e for e in errors)


def test_uas_bukan_di_minggu_16_terdeteksi():
    data = buat_rps_valid()
    for item in data["pertemuan"]:
        if item["minggu"] == settings.minggu_uas:
            item["materi"] = "Materi biasa"
    valid, errors = validate_rps(data)
    assert not valid
    assert any("UAS" in e for e in errors)


def test_minggu_duplikat_terdeteksi():
    data = buat_rps_valid()
    data["pertemuan"][1]["minggu"] = 1
    valid, errors = validate_rps(data)
    assert not valid
    assert any("duplikat" in e for e in errors)


def test_cpmk_tidak_terdaftar_terdeteksi():
    data = buat_rps_valid()
    data["pertemuan"][0]["cpmk"] = "CPMK 9-9"
    valid, errors = validate_rps(data)
    assert not valid
    assert any("tidak ada di daftar cpmk" in e for e in errors)


def test_field_wajib_hilang_terdeteksi():
    data = buat_rps_valid()
    del data["kode_mk"]
    valid, errors = validate_rps(data)
    assert not valid
    assert any("kode_mk" in e for e in errors)


def test_bobot_bukan_angka_terdeteksi():
    data = buat_rps_valid()
    data["pertemuan"][0]["bobot"] = "lima"
    valid, errors = validate_rps(data)
    assert not valid


def test_pertemuan_bukan_list_terdeteksi():
    data = buat_rps_valid()
    data["pertemuan"] = "bukan list"
    valid, errors = validate_rps(data)
    assert not valid


# --- Narasi evaluasi --------------------------------------------------------

def buat_narasi_valid() -> dict:
    return {
        "ringkasan_capaian": "Secara umum capaian pembelajaran cukup baik.",
        "analisis_cpl": [
            {"kode": "CPL 3", "status": "Belum Tercapai", "analisis": "Nilai rata-rata 64."}
        ],
        "faktor_penyebab": ["Alokasi praktikum kurang"],
        "rekomendasi_intervensi": [
            {"sasaran": "CPL 3", "tindakan": "Tambah sesi praktikum", "prioritas": "Tinggi"}
        ],
        "kesimpulan": "Diperlukan penguatan pada CPL 3.",
    }


def test_narasi_valid_lolos():
    valid, errors = validate_narasi(buat_narasi_valid())
    assert valid, f"Seharusnya valid, tapi ada error: {errors}"


def test_narasi_field_hilang_terdeteksi():
    data = buat_narasi_valid()
    del data["rekomendasi_intervensi"]
    valid, errors = validate_narasi(data)
    assert not valid
    assert any("rekomendasi_intervensi" in e for e in errors)


def test_narasi_list_kosong_terdeteksi():
    data = buat_narasi_valid()
    data["analisis_cpl"] = []
    valid, errors = validate_narasi(data)
    assert not valid


def test_narasi_ringkasan_kosong_terdeteksi():
    data = buat_narasi_valid()
    data["ringkasan_capaian"] = "   "
    valid, errors = validate_narasi(data)
    assert not valid
