"""Uji validasi skema Pydantic untuk request RPS dan narasi evaluasi."""

import pytest
from pydantic import ValidationError

from sadewa_ai.schemas import NarasiRequest, RPSRequest


def test_rps_request_valid():
    req = RPSRequest(
        mk_name="Machine Learning", sks=3, semester="Ganjil",
        prodi="Teknik Komputer", deskripsi="Deskripsi",
    )
    assert req.mk_name == "Machine Learning"


def test_rps_request_sks_tidak_valid_ditolak():
    with pytest.raises(ValidationError):
        RPSRequest(mk_name="X", sks=5, semester="Ganjil", prodi="Y")


def test_rps_request_semester_tidak_valid_ditolak():
    with pytest.raises(ValidationError):
        RPSRequest(mk_name="X", sks=3, semester="Sela", prodi="Y")


def test_rps_request_nama_kosong_ditolak():
    with pytest.raises(ValidationError):
        RPSRequest(mk_name="   ", sks=3, semester="Ganjil", prodi="Y")


def test_narasi_request_valid():
    req = NarasiRequest(
        mk_name="ML", prodi="Teknik Komputer", semester="Ganjil",
        tahun_ajaran="2025/2026",
        capaian=[{"kode": "CPL 3", "nilai_rata_rata": 64.5}],
    )
    assert req.capaian[0].kode == "CPL 3"


def test_narasi_request_capaian_kosong_ditolak():
    with pytest.raises(ValidationError):
        NarasiRequest(
            mk_name="ML", prodi="Teknik Komputer", semester="Ganjil",
            tahun_ajaran="2025/2026", capaian=[],
        )


def test_narasi_request_nilai_bukan_angka_ditolak():
    with pytest.raises(ValidationError):
        NarasiRequest(
            mk_name="ML", prodi="Teknik Komputer", semester="Ganjil",
            tahun_ajaran="2025/2026",
            capaian=[{"kode": "CPL 3", "nilai_rata_rata": "delapan puluh"}],
        )
