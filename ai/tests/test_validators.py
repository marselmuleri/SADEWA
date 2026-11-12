"""Uji validasi struktur RPS dan narasi evaluasi."""

import copy
import pytest

from sadewa_ai.config import settings
from sadewa_ai.validators import rapikan_rps, validate_narasi, validate_rps


def buat_rps_mentah() -> dict:
    """RPS format 2 (Kontrak Kuliah + RPS) seperti keluaran LLM, sebelum dirapikan."""
    pertemuan = []
    for minggu in range(1, settings.jumlah_pertemuan + 1):
        if minggu in (settings.minggu_uts, settings.minggu_uas):
            pertemuan.append({"minggu": minggu, "jenis": "UTS" if minggu == settings.minggu_uts else "UAS"})
            continue
        pertemuan.append({
            "minggu": minggu,
            "kemampuan_akhir": "Mahasiswa mampu menerapkan (C3) konfigurasi dasar",
            "bahan_kajian_judul": f"Pokok bahasan {minggu}",
            "bahan_kajian": "sub-pokok A, sub-pokok B",
            "metode": "Case Method, Praktikum, SDL",
            "pengalaman_belajar": ["Mahasiswa mengkonfigurasi perangkat dan menguji konektivitas."],
            "target_cpmk": "CPMK 2.1, 5.1",
            "kriteria_indikator": ["Konfigurasi benar; konektivitas terverifikasi."],
        })
    return {
        "kode_mk": "TSK1624307",
        "deskripsi_mk": "Mata kuliah pengantar switching dan routing.",
        "cpl": [
            {"kode": "CPL 2", "deskripsi": "Mampu merancang sistem", "label": "(engineering design)"},
            {"kode": "CPL5", "deskripsi": "Menguasai peralatan modern", "label": "MASTERING MODERN TOOLS"},
        ],
        "cpmk": [
            {"kode": "CPMK 2.1", "deskripsi": "Mendesain arsitektur jaringan"},
            {"kode": "cpmk5.1", "deskripsi": "Menggunakan Packet Tracer"},
        ],
        "penilaian": [
            {"poin": "Tugas", "komponen": "Tugas", "rincian": "1. Tugas harian\n2. Modul netacad", "bobot": 70, "cpmk": ["CPMK 2.1", "5.1"]},
            {"poin": "Kognitif / Pengetahuan", "komponen": "UTS", "rincian": [], "bobot": 15, "cpmk": ["CPMK 2.1"]},
            {"poin": "Kognitif / Pengetahuan", "komponen": "UAS", "rincian": [], "bobot": 15, "cpmk": ["CPMK 5.1"]},
        ],
        "pertemuan": pertemuan,
        "referensi": ["Cisco Networking Academy, Switching, Routing and Wireless Essentials"],
    }


def buat_rps_valid() -> dict:
    return rapikan_rps(buat_rps_mentah(), sks=2)


def test_rapikan_menyeragamkan_format():
    data = buat_rps_valid()
    assert data["format"] == 2
    assert [c["kode"] for c in data["cpl"]] == ["CPL 2", "CPL 5"]
    assert data["cpl"][0]["label"] == "ENGINEERING DESIGN"
    assert [c["kode"] for c in data["cpmk"]] == ["CPMK 2.1", "CPMK 5.1"]
    assert data["penilaian"][0]["rincian"] == ["Tugas harian", "Modul netacad"]
    assert data["penilaian"][0]["cpmk"] == ["CPMK 2.1", "CPMK 5.1"]

    m1 = data["pertemuan"][0]
    assert m1["target_cpmk"] == ["CPMK 2.1", "CPMK 5.1"]
    assert m1["waktu"] == "2 x 50 menit"
    assert m1["bobot"] is None
    uts = data["pertemuan"][settings.minggu_uts - 1]
    uas = data["pertemuan"][settings.minggu_uas - 1]
    assert (uts["jenis"], uts["bobot"]) == ("UTS", 15)
    assert (uas["jenis"], uas["bobot"]) == ("UAS", 15)


def test_rapikan_memaksa_minggu_ujian():
    """LLM menulis materi biasa di minggu UTS: tetap dijadikan baris UTS."""
    mentah = buat_rps_mentah()
    mentah["pertemuan"][settings.minggu_uts - 1] = {"minggu": settings.minggu_uts, "bahan_kajian_judul": "Materi biasa"}
    data = rapikan_rps(mentah, sks=3)
    assert data["pertemuan"][settings.minggu_uts - 1]["jenis"] == "UTS"


def test_rps_valid_lolos():
    valid, errors = validate_rps(buat_rps_valid())
    assert valid, f"Seharusnya valid, tapi ada error: {errors}"
    assert errors == []


def test_total_bobot_penilaian_salah_terdeteksi():
    data = buat_rps_valid()
    data["penilaian"][0]["bobot"] = 60
    valid, errors = validate_rps(data)
    assert not valid
    assert any("Total bobot penilaian" in e for e in errors)


def test_bobot_bukan_angka_terdeteksi():
    data = buat_rps_valid()
    data["penilaian"][0]["bobot"] = "tujuh puluh"
    valid, errors = validate_rps(data)
    assert not valid
    assert any("bukan angka" in e for e in errors)


def test_penilaian_tanpa_uas_terdeteksi():
    data = buat_rps_valid()
    data["penilaian"] = data["penilaian"][:2]
    valid, errors = validate_rps(data)
    assert not valid
    assert any("'UAS'" in e for e in errors)


def test_jumlah_pertemuan_kurang_terdeteksi():
    data = buat_rps_valid()
    data["pertemuan"] = data["pertemuan"][:10]
    valid, errors = validate_rps(data)
    assert not valid
    assert any("Jumlah pertemuan" in e for e in errors)


def test_minggu_duplikat_terdeteksi():
    data = buat_rps_valid()
    data["pertemuan"][1]["minggu"] = 1
    valid, errors = validate_rps(data)
    assert not valid
    assert any("duplikat" in e for e in errors)


def test_kolom_pertemuan_kosong_terdeteksi():
    data = buat_rps_valid()
    data["pertemuan"][0]["pengalaman_belajar"] = []
    valid, errors = validate_rps(data)
    assert not valid
    assert any("pengalaman_belajar" in e for e in errors)


def test_cpmk_tidak_terdaftar_terdeteksi():
    data = buat_rps_valid()
    data["pertemuan"][0]["target_cpmk"] = ["CPMK 9.9"]
    valid, errors = validate_rps(data)
    assert not valid
    assert any("tidak ada di daftar cpmk" in e for e in errors)


def test_cpl_tanpa_label_terdeteksi():
    data = buat_rps_valid()
    data["cpl"][0]["label"] = ""
    valid, errors = validate_rps(data)
    assert not valid
    assert any("label" in e for e in errors)


def test_field_wajib_hilang_terdeteksi():
    data = buat_rps_valid()
    del data["kode_mk"]
    valid, errors = validate_rps(data)
    assert not valid
    assert any("kode_mk" in e for e in errors)


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
