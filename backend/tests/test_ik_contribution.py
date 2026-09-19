from decimal import Decimal
from app.services.calculation.ik_contribution import calculate_ik_contribution


def test_single_bentuk_penilaian_full_weight():
    """1 Bentuk Penilaian, semua bobotnya masuk ke 1 IK."""
    nilai = {1: Decimal("80")}
    bobot_ik = {1: Decimal("100")}
    bobot_bp = {1: Decimal("100")}
    hasil = calculate_ik_contribution(nilai, bobot_ik, bobot_bp)
    assert hasil == Decimal("80")


def test_ik_partial_weight_within_bentuk_penilaian():
    """Sesuai contoh dokumen: Tugas (bobot 20%) berkontribusi 12% ke IK-A.1."""
    nilai = {1: Decimal("90")}  # nilai Tugas = 90
    bobot_ik = {1: Decimal("12")}  # bobot IK-A.1 dalam Tugas = 12%
    bobot_bp = {1: Decimal("20")}  # bobot Tugas terhadap MK = 20%
    hasil = calculate_ik_contribution(nilai, bobot_ik, bobot_bp)
    # 90 * (12/20) = 54
    assert hasil == Decimal("54")


def test_multiple_bentuk_penilaian_summed():
    """Kontribusi dari beberapa Bentuk Penilaian dijumlahkan untuk 1 IK."""
    nilai = {1: Decimal("80"), 2: Decimal("70")}
    bobot_ik = {1: Decimal("50"), 2: Decimal("50")}
    bobot_bp = {1: Decimal("100"), 2: Decimal("100")}
    hasil = calculate_ik_contribution(nilai, bobot_ik, bobot_bp)
    # (80 * 0.5) + (70 * 0.5) = 40 + 35 = 75
    assert hasil == Decimal("75")


def test_bentuk_penilaian_without_ik_mapping_ignored():
    """Bentuk Penilaian yang tidak dipetakan ke IK ini tidak ikut dihitung."""
    nilai = {1: Decimal("80"), 2: Decimal("100")}
    bobot_ik = {1: Decimal("100")}  # BP #2 tidak ada di sini
    bobot_bp = {1: Decimal("100"), 2: Decimal("100")}
    hasil = calculate_ik_contribution(nilai, bobot_ik, bobot_bp)
    assert hasil == Decimal("80")


def test_zero_bobot_bentuk_penilaian_skipped_no_division_error():
    """Bobot Bentuk Penilaian 0 tidak boleh menyebabkan ZeroDivisionError."""
    nilai = {1: Decimal("80")}
    bobot_ik = {1: Decimal("50")}
    bobot_bp = {1: Decimal("0")}
    hasil = calculate_ik_contribution(nilai, bobot_ik, bobot_bp)
    assert hasil == Decimal("0")


def test_empty_input_returns_zero():
    hasil = calculate_ik_contribution({}, {}, {})
    assert hasil == Decimal("0")


def test_nilai_zero():
    nilai = {1: Decimal("0")}
    bobot_ik = {1: Decimal("100")}
    bobot_bp = {1: Decimal("100")}
    hasil = calculate_ik_contribution(nilai, bobot_ik, bobot_bp)
    assert hasil == Decimal("0")