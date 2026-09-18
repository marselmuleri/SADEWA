from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.peserta_mata_kuliah import PesertaMataKuliah
from app.models.nilai_bentuk_penilaian import NilaiBentukPenilaian
from app.models.mk_bentuk_penilaian import MKBentukPenilaian
from app.models.mk_bentuk_penilaian_ik_map import MKBentukPenilaianIKMap
from app.models.ik_achievement import IKAchievement
from app.models.cpl_achievement import CPLAchievement
from app.models.cpmk_achievement import CPMKAchievement
from app.models.cpmk_ik_map import CPMKIKMap
from app.models.cpmk import CPMK
from app.models.ik import IK
from app.models.hasil_evaluasi import HasilEvaluasi
from app.services.calculation.ik_contribution import calculate_ik_contribution


def validasi_bobot_mata_kuliah(db: Session, mata_kuliah_id: int) -> list[str]:
    warnings = []
    mbp_list = db.query(MKBentukPenilaian).filter(MKBentukPenilaian.mata_kuliah_id == mata_kuliah_id).all()
    total_bobot = sum(mbp.bobot for mbp in mbp_list)
    if total_bobot != 100:
        warnings.append(f"Total bobot Bentuk Penilaian = {total_bobot}%, seharusnya 100%")

    for mbp in mbp_list:
        ik_maps = db.query(MKBentukPenilaianIKMap).filter(MKBentukPenilaianIKMap.mk_bentuk_penilaian_id == mbp.id).all()
        total_ik_bobot = sum(m.bobot for m in ik_maps)
        if total_ik_bobot > mbp.bobot:
            warnings.append(f"Bobot IK dalam Bentuk Penilaian '{mbp.id}' ({total_ik_bobot}%) melebihi bobot Bentuk Penilaian ({mbp.bobot}%)")

    cpmk_list = db.query(CPMK).filter(CPMK.mata_kuliah_id == mata_kuliah_id).all()
    for cpmk in cpmk_list:
        maps = db.query(CPMKIKMap).filter(CPMKIKMap.cpmk_id == cpmk.id).all()
        if not maps:
            warnings.append(f"CPMK '{cpmk.kode}' belum punya mapping ke IK sama sekali")
        total_map_bobot = sum(m.bobot for m in maps)
        if total_map_bobot > cpmk.bobot:
            warnings.append(f"Bobot IK dalam CPMK '{cpmk.kode}' ({total_map_bobot}%) melebihi bobot CPMK ({cpmk.bobot}%)")

    return warnings


def run_kalkulasi(db: Session, mata_kuliah_id: int) -> dict:
    peserta_list = db.query(PesertaMataKuliah).filter(PesertaMataKuliah.mata_kuliah_id == mata_kuliah_id).all()
    mbp_list = db.query(MKBentukPenilaian).filter(MKBentukPenilaian.mata_kuliah_id == mata_kuliah_id).all()
    bobot_bentuk_penilaian = {mbp.id: mbp.bobot for mbp in mbp_list}

    ik_ids_in_mk = set()
    ik_bobot_per_bp = {}
    for mbp in mbp_list:
        maps = db.query(MKBentukPenilaianIKMap).filter(MKBentukPenilaianIKMap.mk_bentuk_penilaian_id == mbp.id).all()
        for m in maps:
            ik_ids_in_mk.add(m.ik_id)
            ik_bobot_per_bp.setdefault(m.ik_id, {})[mbp.id] = m.bobot

    sample_results = []

    for peserta in peserta_list:
        nilai_records = db.query(NilaiBentukPenilaian).filter(
            NilaiBentukPenilaian.peserta_mata_kuliah_id == peserta.id
        ).all()
        nilai_per_bp = {n.mk_bentuk_penilaian_id: n.nilai for n in nilai_records}

        for ik_id in ik_ids_in_mk:
            bobot_ik_map = ik_bobot_per_bp.get(ik_id, {})
            kontribusi = calculate_ik_contribution(
                nilai_bentuk_penilaian=nilai_per_bp,
                bobot_ik_dalam_bentuk=bobot_ik_map,
                bobot_bentuk_penilaian=bobot_bentuk_penilaian,
            )
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

        # STEP 6: CPMK achievement (turunan, per peserta)
        cpmk_list = db.query(CPMK).filter(CPMK.mata_kuliah_id == mata_kuliah_id).all()
        for cpmk in cpmk_list:
            maps = db.query(CPMKIKMap).filter(CPMKIKMap.cpmk_id == cpmk.id).all()
            if not maps:
                continue
            total_bobot_map = sum(m.bobot for m in maps) or Decimal("1")
            nilai_cpmk = Decimal("0")
            for m in maps:
                ik_ach = db.query(IKAchievement).filter(
                    IKAchievement.mahasiswa_id == peserta.mahasiswa_id,
                    IKAchievement.ik_id == m.ik_id,
                    IKAchievement.mata_kuliah_id == mata_kuliah_id,
                ).first()
                if ik_ach:
                    nilai_cpmk += ik_ach.nilai * (m.bobot / total_bobot_map)
            existing_cpmk = db.query(CPMKAchievement).filter(
                CPMKAchievement.peserta_mata_kuliah_id == peserta.id,
                CPMKAchievement.cpmk_id == cpmk.id,
            ).first()
            status_tercapai = 1 if nilai_cpmk >= 70 else 0
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

        # STEP 7: hasil_evaluasi (transkrip, independen)
        nilai_akhir = Decimal("0")
        for mbp in mbp_list:
            nilai_bp = nilai_per_bp.get(mbp.id)
            if nilai_bp is not None:
                nilai_akhir += nilai_bp * (mbp.bobot / Decimal("100"))
        nilai_huruf = "A" if nilai_akhir >= 85 else "B" if nilai_akhir >= 75 else "C" if nilai_akhir >= 65 else "D"
        existing_he = db.query(HasilEvaluasi).filter(
            HasilEvaluasi.peserta_mata_kuliah_id == peserta.id
        ).first()
        if existing_he:
            existing_he.nilai_akhir = nilai_akhir
            existing_he.nilai_huruf = nilai_huruf
        else:
            db.add(HasilEvaluasi(
                peserta_mata_kuliah_id=peserta.id,
                nilai_akhir=nilai_akhir,
                nilai_huruf=nilai_huruf,
                nilai_bobot=nilai_akhir,
                status_outcome="Tercapai" if nilai_akhir >= 70 else "Tidak Tercapai",
            ))

    db.commit()

    # STEP 5: agregasi ke CPL (across all MK - disederhanakan per MK ini dulu)
    ik_to_cpl = {ik.id: ik.cpl_id for ik in db.query(IK).filter(IK.id.in_(ik_ids_in_mk)).all()}
    for peserta in peserta_list:
        cpl_ids = set(ik_to_cpl.values())
        for cpl_id in cpl_ids:
            ik_ids_for_cpl = [ik_id for ik_id, c in ik_to_cpl.items() if c == cpl_id]
            achs = db.query(IKAchievement).filter(
                IKAchievement.mahasiswa_id == peserta.mahasiswa_id,
                IKAchievement.ik_id.in_(ik_ids_for_cpl),
            ).all()
            if not achs:
                continue
            avg_nilai = sum(a.nilai for a in achs) / len(achs)
            existing_cpl = db.query(CPLAchievement).filter(
                CPLAchievement.mahasiswa_id == peserta.mahasiswa_id,
                CPLAchievement.cpl_id == cpl_id,
            ).first()
            if existing_cpl:
                existing_cpl.nilai = avg_nilai
            else:
                db.add(CPLAchievement(
                    mahasiswa_id=peserta.mahasiswa_id,
                    cpl_id=cpl_id,
                    semester=mbp_list[0].semester if mbp_list else None,
                    nilai=avg_nilai,
                ))
    db.commit()

    return {
        "mata_kuliah_id": mata_kuliah_id,
        "jumlah_peserta_diproses": len(peserta_list),
        "ik_results_sample": sample_results,
    }