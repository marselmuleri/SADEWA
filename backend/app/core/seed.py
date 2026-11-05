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

    # --- 1. Fakultas & Program Studi (2 Prodi) ---
    fakultas = Fakultas(nama="Fakultas Teknik", kode="FT")
    db.add(fakultas)
    db.flush()

    prodi_if = ProgramStudi(nama="Informatika", kode="IF", fakultas_id=fakultas.id)
    prodi_el = ProgramStudi(nama="Teknik Elektro", kode="EL", fakultas_id=fakultas.id)
    db.add_all([prodi_if, prodi_el])
    db.flush()

    # --- 2. Users: Semua role untuk IF & EL, Dekan FT, Super Admin ---
    super_admin = User(
        nama="Super Admin", email="superadmin@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.super_admin, is_active=True,
    )
    admin_if = User(
        nama="Admin Prodi IF", email="adminprodi@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.admin_prodi,
        program_studi_id=prodi_if.id, is_active=True,
    )
    kaprodi_if = User(
        nama="Kaprodi IF", email="kaprodi@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.kaprodi,
        program_studi_id=prodi_if.id, is_active=True,
    )
    dosen_if = User(
        nama="Dosen IF", email="dosen@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.dosen,
        program_studi_id=prodi_if.id, is_active=True,
    )
    admin_el = User(
        nama="Admin Prodi EL", email="adminprodi_el@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.admin_prodi,
        program_studi_id=prodi_el.id, is_active=True,
    )
    kaprodi_el = User(
        nama="Kaprodi EL", email="kaprodi_el@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.kaprodi,
        program_studi_id=prodi_el.id, is_active=True,
    )
    dosen_el = User(
        nama="Dosen EL", email="dosen_el@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.dosen,
        program_studi_id=prodi_el.id, is_active=True,
    )
    dekan = User(
        nama="Dekan FT", email="dekan@sadewa.ac.id",
        password_hash=get_password_hash("password123"), role=UserRole.dekan,
        fakultas_id=fakultas.id, is_active=True,
    )
    db.add_all([super_admin, admin_if, kaprodi_if, dosen_if, admin_el, kaprodi_el, dosen_el, dekan])
    db.flush()

    # --- 3. Kurikulum, CPL, IK untuk IF ---
    kurikulum_if = KurikulumVersion(
        program_studi_id=prodi_if.id, version_label="2025", semester=SemesterEnum.ganjil,
        status=StatusKurikulum.published, created_by=admin_if.id,
        published_at=datetime.now(timezone.utc),
    )
    db.add(kurikulum_if)
    db.flush()

    cpl_defs_if = [
        ("CPL-1", "Kemampuan analisis masalah komputasi"),
        ("CPL-2", "Kemampuan perancangan solusi perangkat lunak"),
        ("CPL-3", "Kemampuan komunikasi dan kolaborasi profesional"),
    ]
    cpl_list_if = [
        CPL(kurikulum_version_id=kurikulum_if.id, kode=k, deskripsi=d, program_studi_id=prodi_if.id, created_by=admin_if.id)
        for k, d in cpl_defs_if
    ]
    db.add_all(cpl_list_if)
    db.flush()

    ik_list_if = []
    for cpl in cpl_list_if:
        for i in range(1, 3):
            ik_list_if.append(IK(
                cpl_id=cpl.id, kode=f"{cpl.kode}.{i}", deskripsi=f"Indikator {i} untuk {cpl.kode}",
                urutan=i, created_by=admin_if.id,
            ))
    db.add_all(ik_list_if)
    db.flush()

    # --- 4. Mata Kuliah + Dosen Pengampu + CPMK untuk IF ---
    mk_defs_if = [
        ("IF201", "Machine Learning", 3),
        ("IF202", "Basis Data Lanjut", 3),
        ("IF203", "Rekayasa Perangkat Lunak", 3),
    ]
    mk_list_if = [
        MataKuliah(
            kurikulum_version_id=kurikulum_if.id, kode=k, nama=n, sks=sks,
            semester=SemesterEnum.ganjil, tahun_ajaran="2025/2026", program_studi_id=prodi_if.id,
        )
        for k, n, sks in mk_defs_if
    ]
    db.add_all(mk_list_if)
    db.flush()

    db.add_all([PengampuMataKuliah(mata_kuliah_id=mk.id, user_id=dosen_if.id, is_koordinator=True) for mk in mk_list_if])

    cpmk_list_if = []
    for mk in mk_list_if:
        for i in range(1, 3):
            cpmk_list_if.append(CPMK(
                mata_kuliah_id=mk.id, kode=f"CPMK-{mk.kode}-{i}",
                deskripsi=f"Capaian pembelajaran {i} untuk {mk.nama}",
                bobot=50, created_by=dosen_if.id,
            ))
    db.add_all(cpmk_list_if)
    db.flush()

    # Mapping tiap CPMK ke IK IF
    # CPMK 1 ke IK[0] (bobot 50), CPMK 2 ke IK[1] (bobot 50)
    for mk_idx, mk in enumerate(mk_list_if):
        cpmks = [c for c in cpmk_list_if if c.mata_kuliah_id == mk.id]
        if len(cpmks) >= 2:
            db.add(CPMKIKMap(cpmk_id=cpmks[0].id, ik_id=ik_list_if[0].id, bobot=50))
            db.add(CPMKIKMap(cpmk_id=cpmks[1].id, ik_id=ik_list_if[1].id, bobot=50))
    db.flush()

    # --- 5. Jenis Evaluasi & Bentuk Penilaian untuk IF ---
    # Bobot total JenisEvaluasi = 100
    jenis_defs_if = [("Tugas", 20), ("Kuis", 20), ("UTS", 30), ("UAS", 30)]
    jenis_list_if = [
        JenisEvaluasi(program_studi_id=prodi_if.id, nama=n, urutan=i, bobot=b)
        for i, (n, b) in enumerate(jenis_defs_if, start=1)
    ]
    db.add_all(jenis_list_if)
    db.flush()

    bentuk_list_if = [BentukPenilaian(jenis_evaluasi_id=j.id, nama=j.nama) for j in jenis_list_if]
    db.add_all(bentuk_list_if)
    db.flush()

    # MKBentukPenilaian bobot total = 100 (20, 20, 30, 30)
    mbp_list_if = []
    for mk in mk_list_if:
        for bp, (_, b) in zip(bentuk_list_if, jenis_defs_if):
            mbp_list_if.append(MKBentukPenilaian(
                mata_kuliah_id=mk.id, bentuk_penilaian_id=bp.id, bobot=b,
                semester=SemesterEnum.ganjil, created_by=dosen_if.id,
            ))
    db.add_all(mbp_list_if)
    db.flush()

    # Matriks MKBentukPenilaian ke IK (menggunakan ik_list_if[0] dan ik_list_if[1])
    for mbp in mbp_list_if:
        db.add(MKBentukPenilaianIKMap(mk_bentuk_penilaian_id=mbp.id, ik_id=ik_list_if[0].id, bobot=mbp.bobot))
    db.flush()

    # --- 6. Mahasiswa + Peserta + Nilai untuk IF ---
    mahasiswa_list_if = [
        Mahasiswa(
            nim=f"2201{i:03d}", nama=f"Mahasiswa IF {i}", angkatan=2022,
            semester_aktif=5, status_masuk=StatusMasuk.reguler, program_studi_id=prodi_if.id
        )
        for i in range(1, 21)
    ]
    db.add_all(mahasiswa_list_if)
    db.flush()

    peserta_list_if = []
    for m in mahasiswa_list_if:
        for mk in mk_list_if:
            peserta_list_if.append(PesertaMataKuliah(mata_kuliah_id=mk.id, mahasiswa_id=m.id, kelas="A"))
    db.add_all(peserta_list_if)
    db.flush()

    mbp_by_mk_if: dict[int, list[MKBentukPenilaian]] = {}
    for mbp in mbp_list_if:
        mbp_by_mk_if.setdefault(mbp.mata_kuliah_id, []).append(mbp)

    nilai_rows_if = []
    for peserta in peserta_list_if:
        for mbp in mbp_by_mk_if[peserta.mata_kuliah_id]:
            base = random.uniform(65, 90)
            nilai_rows_if.append(NilaiBentukPenilaian(
                peserta_mata_kuliah_id=peserta.id,
                mk_bentuk_penilaian_id=mbp.id,
                ik_id=ik_list_if[0].id,  # Menggunakan model nilai per IK
                semester=SemesterEnum.ganjil,
                nilai=round(base, 2),
                source=NilaiSource.manual,
                imported_by=dosen_if.id,
            ))
    db.add_all(nilai_rows_if)
    db.flush()

    # --- 7. Data Minimal untuk Prodi Kedua (Teknik Elektro / EL) ---
    kurikulum_el = KurikulumVersion(
        program_studi_id=prodi_el.id, version_label="2025", semester=SemesterEnum.ganjil,
        status=StatusKurikulum.published, created_by=admin_el.id,
        published_at=datetime.now(timezone.utc),
    )
    db.add(kurikulum_el)
    db.flush()

    cpl_el = CPL(
        kurikulum_version_id=kurikulum_el.id, kode="EL-CPL-1",
        deskripsi="Kemampuan analisis rangkaian listrik dan sistem tenaga",
        program_studi_id=prodi_el.id, created_by=admin_el.id,
    )
    db.add(cpl_el)
    db.flush()

    ik_el = IK(
        cpl_id=cpl_el.id, kode="EL-CPL-1.1", deskripsi="Indikator 1 untuk EL-CPL-1",
        urutan=1, created_by=admin_el.id,
    )
    db.add(ik_el)
    db.flush()

    mk_el = MataKuliah(
        kurikulum_version_id=kurikulum_el.id, kode="EL101", nama="Rangkaian Listrik",
        sks=3, semester=SemesterEnum.ganjil, tahun_ajaran="2025/2026", program_studi_id=prodi_el.id,
    )
    db.add(mk_el)
    db.flush()

    db.add(PengampuMataKuliah(mata_kuliah_id=mk_el.id, user_id=dosen_el.id, is_koordinator=True))

    jenis_el = [
        JenisEvaluasi(program_studi_id=prodi_el.id, nama="Tugas EL", urutan=1, bobot=40),
        JenisEvaluasi(program_studi_id=prodi_el.id, nama="UAS EL", urutan=2, bobot=60),
    ]
    db.add_all(jenis_el)
    db.flush()

    mahasiswa_el = [
        Mahasiswa(
            nim=f"2202{i:03d}", nama=f"Mahasiswa EL {i}", angkatan=2022,
            semester_aktif=5, status_masuk=StatusMasuk.reguler, program_studi_id=prodi_el.id,
        )
        for i in range(1, 6)
    ]
    db.add_all(mahasiswa_el)
    db.flush()

    peserta_el = [PesertaMataKuliah(mata_kuliah_id=mk_el.id, mahasiswa_id=m.id, kelas="A") for m in mahasiswa_el]
    db.add_all(peserta_el)
    db.flush()

    db.commit()

    return {
        "message": "Seed sukses",
        "login_password_semua_akun": "password123",
        "users": {
            "super_admin": super_admin.email,
            "admin_prodi_if": admin_if.email,
            "kaprodi_if": kaprodi_if.email,
            "dosen_if": dosen_if.email,
            "admin_prodi_el": admin_el.email,
            "kaprodi_el": kaprodi_el.email,
            "dosen_el": dosen_el.email,
            "dekan_ft": dekan.email,
        },
        "fakultas": 1,
        "program_studi": 2,
        "kurikulum_version": 2,
        "if": {
            "cpl": len(cpl_list_if),
            "ik": len(ik_list_if),
            "mata_kuliah": len(mk_list_if),
            "cpmk": len(cpmk_list_if),
            "jenis_evaluasi": len(jenis_list_if),
            "mahasiswa": len(mahasiswa_list_if),
            "peserta": len(peserta_list_if),
            "nilai": len(nilai_rows_if),
        },
        "el": {
            "mata_kuliah": 1,
            "mahasiswa": len(mahasiswa_el),
        },
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
