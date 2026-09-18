"""
Uji ekstraksi JSON dari keluaran LLM dan penyusunan prompt.

Tidak ada panggilan jaringan di sini, sehingga test bisa jalan tanpa API key.
"""

import pytest

from sadewa_ai.llm_client import JSONExtractionError, extract_json
from sadewa_ai import prompts
from sadewa_ai.config import settings


def test_json_polos():
    assert extract_json('{"a": 1}') == {"a": 1}


def test_json_dengan_pagar_markdown():
    raw = '```json\n{"a": 1, "b": "dua"}\n```'
    assert extract_json(raw) == {"a": 1, "b": "dua"}


def test_json_dengan_pagar_tanpa_label():
    raw = '```\n{"a": 1}\n```'
    assert extract_json(raw) == {"a": 1}


def test_json_dengan_kalimat_pembuka():
    """Kasus yang membuat parser lama gagal total."""
    raw = 'Tentu, berikut RPS yang diminta:\n{"kode_mk": "TKK1234"}'
    assert extract_json(raw) == {"kode_mk": "TKK1234"}


def test_json_dengan_kalimat_pembuka_dan_penutup():
    raw = 'Berikut hasilnya:\n{"a": 1}\nSemoga membantu!'
    assert extract_json(raw) == {"a": 1}


def test_json_bersarang_diambil_utuh():
    raw = 'Ini hasilnya: {"luar": {"dalam": [1, 2, {"x": "y"}]}} selesai'
    assert extract_json(raw) == {"luar": {"dalam": [1, 2, {"x": "y"}]}}


def test_kurung_kurawal_di_dalam_string_tidak_mengacaukan():
    raw = '{"materi": "Notasi himpunan {a, b, c} pada teori graf"}'
    hasil = extract_json(raw)
    assert hasil["materi"] == "Notasi himpunan {a, b, c} pada teori graf"


def test_escape_quote_di_dalam_string():
    raw = '{"catatan": "dosen bilang \\"penting\\" sekali"}'
    hasil = extract_json(raw)
    assert "penting" in hasil["catatan"]


def test_respons_tanpa_json_melempar_error():
    with pytest.raises(JSONExtractionError):
        extract_json("Maaf, saya tidak bisa membuat RPS tersebut.")


def test_json_rusak_melempar_error():
    with pytest.raises(JSONExtractionError):
        extract_json('{"a": 1, "b":}')


def test_json_array_bukan_objek_melempar_error():
    with pytest.raises(JSONExtractionError):
        extract_json("[1, 2, 3]")


# --- Prompt -----------------------------------------------------------------

def test_prompt_rps_memuat_parameter():
    prompt = prompts.build_rps_prompt(
        mk_name="Jaringan Syaraf Tiruan",
        sks=2,
        semester="Ganjil",
        prodi="Teknik Komputer",
        deskripsi="Deskripsi uji",
        context_kurikulum="KONTEKS UJI",
    )
    assert "Jaringan Syaraf Tiruan" in prompt
    assert "Teknik Komputer" in prompt
    assert "KONTEKS UJI" in prompt
    assert str(settings.jumlah_pertemuan) in prompt
    assert str(settings.bobot_total) in prompt


def test_prompt_rps_tidak_lagi_menyebut_skill_industri():
    """Fitur tren industri dihapus mengikuti revisi dosen."""
    prompt = prompts.build_rps_prompt(
        mk_name="Basis Data", sks=3, semester="Genap", prodi="Teknik Komputer",
        deskripsi="", context_kurikulum="",
    )
    assert "skill_industri" not in prompt
    assert "Tren Industri" not in prompt


def test_prompt_narasi_memuat_angka_capaian():
    prompt = prompts.build_narasi_prompt(
        mk_name="Machine Learning",
        prodi="Teknik Komputer",
        semester="Ganjil",
        tahun_ajaran="2025/2026",
        capaian=[{
            "kode": "CPL 3",
            "deskripsi": "Mampu merancang",
            "nilai_rata_rata": 64.5,
            "jumlah_mahasiswa": 38,
            "jumlah_tercapai": 18,
        }],
        context_kurikulum="KONTEKS",
    )
    assert "CPL 3" in prompt
    assert "64.5" in prompt
    assert "38" in prompt
    assert "Machine Learning" in prompt


def test_prompt_narasi_capaian_kosong_tetap_aman():
    prompt = prompts.build_narasi_prompt(
        mk_name="X", prodi="Y", semester="Ganjil", tahun_ajaran="2025/2026",
        capaian=[], context_kurikulum="",
    )
    assert "tidak ada data ketercapaian" in prompt
