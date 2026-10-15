from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.cpl_achievement import CPLAchievement
from app.models.cpmk import CPMK
from app.models.cpmk_achievement import CPMKAchievement
from app.models.cpmk_ik_map import CPMKIKMap
from app.models.hasil_evaluasi import HasilEvaluasi
from app.models.ik import IK
from app.models.ik_achievement import IKAchievement
from app.models.mata_kuliah import MataKuliah
from app.models.mk_bentuk_penilaian import MKBentukPenilaian
from app.models.mk_bentuk_penilaian_ik_map import MKBentukPenilaianIKMap
from app.models.nilai_bentuk_penilaian import NilaiBentukPenilaian
from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.skala_nilai import SkalaNilai
from app.services.calculation.obe_formula import compute_result, pilih_huruf


def cek_siap_dinilai(db: Session, mata_kuliah_id: int) -> list[str]:
    issues: list[str] = []

    # 1. Total bobot CPMK per mata kuliah = 100
    cpmk_list = db.query(CPMK).filter(CPMK.mata_kuliah_id == mata_kuliah_id).all()
    total_cpmk = sum(Decimal(str(c.bobot)) for c in cpmk_list) if cpmk_list else Decimal("0")
    if total_cpmk != Decimal("100"):
        issues.append(f"Total bobot CPMK = {total_cpmk}%, seharusnya 100%")

    # 2. Tiap CPMK berbobot > 0 punya mapping dan jumlah bobot IK == bobot CPMK
    expected_ik_weights: dict[int, Decimal] = {}
    for cpmk in cpmk_list:
        cpmk_bobot = Decimal(str(cpmk.bobot))
        maps = db.query(CPMKIKMap).filter(CPMKIKMap.cpmk_id == cpmk.id).all()
        if cpmk_bobot > Decimal("0"):
            if not maps:
                issues.append(f"CPMK '{cpmk.kode}' belum punya mapping ke IK sama sekali")
            else:
                total_ik_map = sum(Decimal(str(m.bobot)) for m in maps)
                if total_ik_map != cpmk_bobot:
                    issues.append(f"Total bobot IK dalam CPMK '{cpmk.kode}' ({total_ik_map}%) tidak sama persis dengan bobot CPMK ({cpmk_bobot}%)")
        for m in maps:
            expected_ik_weights[m.ik_id] = expected_ik_weights.get(m.ik_id, Decimal("0")) + Decimal(str(m.bobot))

    # 3. Total bobot bentuk penilaian kelas = 100
    mbp_list = db.query(MKBentukPenilaian).filter(MKBentukPenilaian.mata_kuliah_id == mata_kuliah_id).all()
    total_mbp = sum(Decimal(str(mbp.bobot)) for mbp in mbp_list) if mbp_list else Decimal("0")
    if total_mbp != Decimal("100"):
        issues.append(f"Total bobot Bentuk Penilaian = {total_mbp}%, seharusnya 100%")

    # 4. Jumlah tiap baris matriks = bobot bentuk itu (poin)
    actual_ik_weights: dict[int, Decimal] = {}
    for mbp in mbp_list:
        mbp_bobot = Decimal(str(mbp.bobot))
        ik_maps = db.query(MKBentukPenilaianIKMap).filter(MKBentukPenilaianIKMap.mk_bentuk_penilaian_id == mbp.id).all()
        row_sum = sum(Decimal(str(m.bobot)) for m in ik_maps) if ik_maps else Decimal("0")
        if row_sum != mbp_bobot:
            issues.append(f"Bobot IK dalam Bentuk Penilaian '{mbp.id}' ({row_sum}) tidak sama dengan bobot Bentuk Penilaian ({mbp_bobot})")
        for m in ik_maps:
            actual_ik_weights[m.ik_id] = actual_ik_weights.get(m.ik_id, Decimal("0")) + Decimal(str(m.bobot))

    # 5. Jumlah tiap kolom IK = jumlah bobot IK itu pada mapping mata kuliah
    for ik_id, expected_w in expected_ik_weights.items():
        actual_w = actual_ik_weights.get(ik_id, Decimal("0"))
        if actual_w != expected_w:
            ik_obj = db.query(IK).filter(IK.id == ik_id).first()
            kode = ik_obj.kode if ik_obj else str(ik_id)
            issues.append(f"Bobot kolom matriks untuk IK '{kode}' ({actual_w}) tidak sesuai dengan mapping CPMK ({expected_w})")

    # 6. Sel matriks hanya untuk IK yang dimapping pada mata kuliah itu
    for ik_id, actual_w in actual_ik_weights.items():
        if ik_id not in expected_ik_weights and actual_w > Decimal("0"):
            ik_obj = db.query(IK).filter(IK.id == ik_id).first()
            kode = ik_obj.kode if ik_obj else str(ik_id)
            issues.append(f"IK '{kode}' terdaftar dalam matriks bentuk penilaian tetapi tidak dimapping ke CPMK mata kuliah ini")

    return issues


def validasi_bobot_mata_kuliah(db: Session, mata_kuliah_id: int) -> list[str]:
    return cek_siap_dinilai(db, mata_kuliah_id)


def run_kalkulasi(db: Session, mata_kuliah_id: int) -> dict:
    mk = db.query(MataKuliah).filter(MataKuliah.id == mata_kuliah_id).first()
    peserta_list = db.query(PesertaMataKuliah).filter(PesertaMataKuliah.mata_kuliah_id == mata_kuliah_id).all()
    mbp_list = db.query(MKBentukPenilaian).filter(MKBentukPenilaian.mata_kuliah_id == mata_kuliah_id).all()
    cpmk_list = db.query(CPMK).filter(CPMK.mata_kuliah_id == mata_kuliah_id).all()

    # 1. Bangun matriks bobot per (mbp, ik)
    matrix: dict[int, dict[int, Decimal]] = {}
    ik_ids_in_mk: set[int] = set()
    for mbp in mbp_list:
        matrix[mbp.id] = {}
        maps = db.query(MKBentukPenilaianIKMap).filter(MKBentukPenilaianIKMap.mk_bentuk_penilaian_id == mbp.id).all()
        for m in maps:
            matrix[mbp.id][m.ik_id] = m.bobot
            ik_ids_in_mk.add(m.ik_id)

    # 2. Bangun mapping cpmk_ik
    cpmk_ik: dict[int, dict[int, Decimal]] = {}
    for cpmk in cpmk_list:
        cpmk_ik[cpmk.id] = {}
        maps = db.query(CPMKIKMap).filter(CPMKIKMap.cpmk_id == cpmk.id).all()
        for m in maps:
            cpmk_ik[cpmk.id][m.ik_id] = m.bobot
            ik_ids_in_mk.add(m.ik_id)

    # 3. Bangun relasi ik -> cpl
    ik_to_cpl = {ik.id: ik.cpl_id for ik in db.query(IK).filter(IK.id.in_(ik_ids_in_mk)).all()} if ik_ids_in_mk else {}

    # 4. Ambil skala nilai kurikulum mata kuliah (jika ada)
    skala_rows = []
    if mk and mk.kurikulum_version_id:
        skala_rows = (
            db.query(SkalaNilai)
            .filter(SkalaNilai.kurikulum_version_id == mk.kurikulum_version_id)
            .order_by(SkalaNilai.batas_min.desc())
            .all()
        )
    skala_list = [(s.huruf, s.batas_min) for s in skala_rows]

    sample_results = []

    for peserta in peserta_list:
        nilai_records = db.query(NilaiBentukPenilaian).filter(
            NilaiBentukPenilaian.peserta_mata_kuliah_id == peserta.id
        ).all()

        # Bangun dictionary nilai per (mbp, ik)
        nilai_dict: dict[int, dict[int, Decimal]] = {}
        for n in nilai_records:
            if n.ik_id is not None:
                nilai_dict.setdefault(n.mk_bentuk_penilaian_id, {})[n.ik_id] = n.nilai
            else:
                # Fallback untuk nilai tanpa ik_id (legacy)
                for ik_id in matrix.get(n.mk_bentuk_penilaian_id, {}):
                    nilai_dict.setdefault(n.mk_bentuk_penilaian_id, {})[ik_id] = n.nilai

        # Hitung dengan modul obe_formula
        hasil_obe = compute_result(
            cpmk_ik=cpmk_ik,
            matrix=matrix,
            nilai=nilai_dict,
            ik_cpl=ik_to_cpl,
        )

        # STEP A: Simpan capaian IK
        for ik_id in ik_ids_in_mk:
            kontribusi = hasil_obe.poin_ik.get(ik_id, Decimal("0.00"))
            existing = db.query(IKAchievement).filter(
                IKAchievement.mahasiswa_id == peserta.mahasiswa_id,
                IKAchievement.ik_id == ik_id,
                IKAchievement.mata_kuliah_id == mata_kuliah_id,
            ).first()
            if existing:
                existing.nilai = kontribusi
            else:
                db.add(IKAchievement(
                    mahasiswa_id=peserta.mahasiswa_id,
                    ik_id=ik_id,
                    mata_kuliah_id=mata_kuliah_id,
                    semester=mbp_list[0].semester if mbp_list else None,
                    nilai=kontribusi,
                ))
            if len(sample_results) < 5:
                sample_results.append({"ik_id": ik_id, "nilai": kontribusi})

        # STEP B: CPMK achievement (turunan per peserta)
        for cpmk in cpmk_list:
            maps = cpmk_ik.get(cpmk.id, {})
            if not maps:
                continue
            total_bobot_map = sum(maps.values()) or Decimal("1")
            nilai_cpmk = Decimal("0")
            for m_ik_id, m_bobot in maps.items():
                p_ik = hasil_obe.poin_ik.get(m_ik_id, Decimal("0.00"))
                nilai_cpmk += p_ik * (m_bobot / total_bobot_map)

            existing_cpmk = db.query(CPMKAchievement).filter(
                CPMKAchievement.peserta_mata_kuliah_id == peserta.id,
                CPMKAchievement.cpmk_id == cpmk.id,
            ).first()
            status_tercapai = 1 if nilai_cpmk >= Decimal("70") else 0
            if existing_cpmk:
                existing_cpmk.nilai = nilai_cpmk
                existing_cpmk.status_tercapai = status_tercapai
            else:
                db.add(CPMKAchievement(
                    peserta_mata_kuliah_id=peserta.id,
                    cpmk_id=cpmk.id,
                    nilai=nilai_cpmk,
                    nilai_kriteria=70,
                    status_tercapai=status_tercapai,
                ))

        # STEP C: Simpan Hasil Evaluasi (Transkrip)
        nilai_akhir = hasil_obe.nilai_akhir
        # Huruf berasal dari skala kurikulum (None jika belum diatur)
        nilai_huruf = pilih_huruf(nilai_akhir, skala_list)

        existing_he = db.query(HasilEvaluasi).filter(
            HasilEvaluasi.peserta_mata_kuliah_id == peserta.id
        ).first()
        if existing_he:
            existing_he.nilai_akhir = nilai_akhir
            existing_he.nilai_huruf = nilai_huruf
            existing_he.status_outcome = "Tercapai" if nilai_akhir >= Decimal("70") else "Tidak Tercapai"
        else:
            db.add(HasilEvaluasi(
                peserta_mata_kuliah_id=peserta.id,
                kurikulum_version_id=mk.kurikulum_version_id if mk else None,
                nilai_akhir=nilai_akhir,
                nilai_huruf=nilai_huruf,
                nilai_bobot=nilai_akhir,
                status_outcome="Tercapai" if nilai_akhir >= Decimal("70") else "Tidak Tercapai",
            ))

        # STEP D: Capaian CPL per mahasiswa
        for cpl_id, persen_cpl in hasil_obe.persen_cpl.items():
            existing_cpl = db.query(CPLAchievement).filter(
                CPLAchievement.mahasiswa_id == peserta.mahasiswa_id,
                CPLAchievement.cpl_id == cpl_id,
            ).first()
            if existing_cpl:
                existing_cpl.nilai = persen_cpl
            else:
                db.add(CPLAchievement(
                    mahasiswa_id=peserta.mahasiswa_id,
                    cpl_id=cpl_id,
                    semester=mbp_list[0].semester if mbp_list else None,
                    nilai=persen_cpl,
                ))

    db.commit()

    return {
        "mata_kuliah_id": mata_kuliah_id,
        "jumlah_peserta_diproses": len(peserta_list),
        "ik_results_sample": sample_results,
    }