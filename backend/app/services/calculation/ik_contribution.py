from decimal import Decimal


def calculate_ik_contribution(
    nilai_bentuk_penilaian: dict[int, Decimal],
    bobot_ik_dalam_bentuk: dict[int, Decimal],
    bobot_bentuk_penilaian: dict[int, Decimal],
) -> Decimal:
    """
    STATUS: BELUM FINAL - rumus placeholder untuk development & testing.
    Begitu rumus final datang dari Kaprodi, cukup ganti isi fungsi ini.

    Kontribusi_IK = Σ (nilai_bentuk_penilaian × (bobot_IK_dalam_bentuk / bobot_bentuk_penilaian))

    Args:
        nilai_bentuk_penilaian: {mk_bentuk_penilaian_id: nilai (0-100)}
        bobot_ik_dalam_bentuk: {mk_bentuk_penilaian_id: bobot IK dalam bentuk penilaian ini (%)}
        bobot_bentuk_penilaian: {mk_bentuk_penilaian_id: bobot bentuk penilaian terhadap MK (%)}
    """
    total = Decimal("0")
    for bp_id, nilai in nilai_bentuk_penilaian.items():
        bobot_ik = bobot_ik_dalam_bentuk.get(bp_id, Decimal("0"))
        bobot_bp = bobot_bentuk_penilaian.get(bp_id, Decimal("1"))
        if bobot_bp == 0:
            continue
        total += nilai * (bobot_ik / bobot_bp)
    return total