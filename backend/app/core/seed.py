from __future__ import annotations

import random
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal, engine
from app.core.security import get_password_hash
from app.models import (
    CPL, CPMK, CPMKIKMap, BentukPenilaian, Fakultas, IK, JenisEvaluasi,
    KurikulumVersion, Mahasiswa, MataKuliah, MKBentukPenilaian, MKBentukPenilaianIKMap,
    NilaiBentukPenilaian, PengampuMataKuliah, PesertaMataKuliah, ProgramStudi, User,
)
from app.models.enums import NilaiSource, SemesterEnum, StatusKurikulum, StatusMasuk, UserRole


def seed(db: Session):
    if db.query(User).first():
        return {"message": "Seed dibatalkan: sudah ada data user"}

    # --- 1. Fakultas & Program Studi ---
    fakultas = Fakultas(nama="Fakultas Teknik", kode="FT")
    db.add(fakultas)
    db.flush()

    prodi = ProgramStudi(nama="Informatika", kode="IF", fakultas_id=fakultas.id)
    db.add(prodi)
    db.flush()

    # --- 2. Users: satu akun per role, semua password "password123" ---
    super_admin = User(
        nama="Super Admin", email="superadmin@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.super_admin, is_active=True,
    )
    admin_prodi = User(
        nama="Admin Prodi IF", email="adminprodi@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.admin_prodi,
        program_studi_id=prodi.id, is_active=True,
    )
    kaprodi = User(
        nama="Kaprodi IF", email="kaprodi@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.kaprodi,
        program_studi_id=prodi.id, is_active=True,
    )
    dekan = User(
        nama="Dekan FT", email="dekan@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.dekan,
        fakultas_id=fakultas.id, is_active=True,
    )
    dosen = User(
        nama="Dosen IF", email="dosen@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.dosen, is_active=True,
    )
    db.add_all([super_admin, admin_prodi, kaprodi, dekan, dosen])
    db.flush()

    # --- 3. Kurikulum, CPL, IK ---
    kurikulum = KurikulumVersion(
        program_studi_id=prodi.id, version_label="2025", semester=SemesterEnum.ganjil,
        status=StatusKurikulum.published, created_by=admin_prodi.id,
        published_at=datetime.now(timezone.utc),
    )
    db.add(kurikulum)
    db.flush()

    cpl_defs = [
        ("CPL-1", "Kemampuan analisis masalah komputasi"),
        ("CPL-2", "Kemampuan perancangan solusi perangkat lunak"),
        ("CPL-3", "Kemampuan komunikasi dan kolaborasi profesional"),
    ]
    cpl_list = [
        CPL(kurikulum_version_id=kurikulum.id, kode=k, deskripsi=d, program_studi_id=prodi.id, created_by=admin_prodi.id)
        for k, d in cpl_defs
    ]
    db.add_all(cpl_list)
    db.flush()

    ik_list = []
    for cpl in cpl_list:
        for i in range(1, 3):
            ik_list.append(IK(
                cpl_id=cpl.id, kode=f"{cpl.kode}.{i}", deskripsi=f"Indikator {i} untuk {cpl.kode}",
                urutan=i, created_by=admin_prodi.id,
            ))
    db.add_all(ik_list)
    db.flush()

    # --- 4. Mata Kuliah + Dosen Pengampu + CPMK ---
    mk_defs = [
        ("IF201", "Machine Learning", 3),
        ("IF202", "Basis Data Lanjut", 3),
        ("IF203", "Rekayasa Perangkat Lunak", 3),
    ]
    mk_list = [
        MataKuliah(
            kurikulum_version_id=kurikulum.id, kode=k, nama=n, sks=sks,
            semester=SemesterEnum.ganjil, tahun_ajaran="2025/2026", program_studi_id=prodi.id,
        )
        for k, n, sks in mk_defs
    ]
    db.add_all(mk_list)
    db.flush()

    db.add_all([PengampuMataKuliah(mata_kuliah_id=mk.id, user_id=dosen.id, is_koordinator="1") for mk in mk_list])

    cpmk_list = []
    for mk in mk_list:
        for i in range(1, 3):
            cpmk_list.append(CPMK(
                mata_kuliah_id=mk.id, kode=f"CPMK-{mk.kode}-{i}",
                deskripsi=f"Capaian pembelajaran {i} untuk {mk.nama}",
                bobot=50, created_by=dosen.id,
            ))
    db.add_all(cpmk_list)
    db.flush()

    # Mapping tiap CPMK ke 1 IK acak dengan bobot 50%
    for cpmk in cpmk_list:
        db.add(CPMKIKMap(cpmk_id=cpmk.id, ik_id=random.choice(ik_list).id, bobot=50))

    # --- 5. Jenis Evaluasi & Bentuk Penilaian ---
    jenis_defs = ["Tugas", "Kuis", "UTS", "UAS"]
    jenis_list = [JenisEvaluasi(program_studi_id=prodi.id, nama=n, urutan=i) for i, n in enumerate(jenis_defs, start=1)]
    db.add_all(jenis_list)
    db.flush()

    bentuk_list = [BentukPenilaian(jenis_evaluasi_id=j.id, nama=j.nama) for j in jenis_list]
    db.add_all(bentuk_list)
    db.flush()

    mbp_list = []
    for mk in mk_list:
        for bp in bentuk_list:
            mbp_list.append(MKBentukPenilaian(
                mata_kuliah_id=mk.id, bentuk_penilaian_id=bp.id, bobot=25,
                semester=SemesterEnum.ganjil, created_by=dosen.id,
            ))
    db.add_all(mbp_list)
    db.flush()

    for mbp in mbp_list:
        db.add(MKBentukPenilaianIKMap(mk_bentuk_penilaian_id=mbp.id, ik_id=random.choice(ik_list).id, bobot=25))

    # --- 6. Mahasiswa + Peserta Mata Kuliah + Nilai ---
    mahasiswa_list = [
        Mahasiswa(nim=f"2201{i:03d}", nama=f"Mahasiswa {i}", semester_aktif=5,
                  status_masuk=StatusMasuk.reguler, program_studi_id=prodi.id)
        for i in range(1, 21)
    ]
    db.add_all(mahasiswa_list)
    db.flush()

    peserta_list = []
    for m in mahasiswa_list:
        for mk in mk_list:
            peserta_list.append(PesertaMataKuliah(mata_kuliah_id=mk.id, mahasiswa_id=m.id, kelas="A"))
    db.add_all(peserta_list)
    db.flush()

    mbp_by_mk: dict[int, list[MKBentukPenilaian]] = {}
    for mbp in mbp_list:
        mbp_by_mk.setdefault(mbp.mata_kuliah_id, []).append(mbp)

    nilai_rows = []
    for peserta in peserta_list:
        for mbp in mbp_by_mk[peserta.mata_kuliah_id]:
            base = random.uniform(55, 88)
            nilai_rows.append(NilaiBentukPenilaian(
                peserta_mata_kuliah_id=peserta.id, mk_bentuk_penilaian_id=mbp.id,
                semester=SemesterEnum.ganjil, nilai=round(base, 2),
                source=NilaiSource.manual, imported_by=dosen.id,
            ))
    db.add_all(nilai_rows)
    db.commit()

    return {
        "message": "Seed sukses",
        "login_password_semua_akun": "password123",
        "users": {
            "super_admin": super_admin.email,
            "admin_prodi": admin_prodi.email,
            "kaprodi": kaprodi.email,
            "dekan": dekan.email,
            "dosen": dosen.email,
        },
        "fakultas": 1, "program_studi": 1, "kurikulum_version": 1,
        "cpl": len(cpl_list), "ik": len(ik_list),
        "mata_kuliah": len(mk_list), "cpmk": len(cpmk_list),
        "jenis_evaluasi": len(jenis_list), "bentuk_penilaian": len(bentuk_list),
        "mahasiswa": len(mahasiswa_list), "peserta_mata_kuliah": len(peserta_list),
        "nilai_bentuk_penilaian": len(nilai_rows),
        "catatan": "Jalankan POST /api/v1/kalkulasi/run/{matkul_id} untuk menghitung IK/CPMK/CPL achievement dari nilai ini.",
    }


def run_seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        result = seed(db)
        print(result)
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()