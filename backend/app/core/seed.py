from __future__ import annotations

import random
from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal, engine
from app.core.security import get_password_hash
from app.models import CPL, CPMK, Mahasiswa, MataKuliah, Penilaian, ProgramStudi, User
from app.models.enums import JenisPenilaian, UserRole


def seed(db: Session):
    if db.query(User).first():
        return {"message": "Seed dibatalkan: data sudah ada"}

    admin = User(nama="Admin SADEWA", email="admin@sadewa.ac.id", password_hash=get_password_hash("admin123"), role=UserRole.admin)
    dosen = User(nama="Dosen SADEWA", email="dosen@sadewa.ac.id", password_hash=get_password_hash("dosen123"), role=UserRole.dosen)
    kaprodi = User(nama="Kaprodi SADEWA", email="kaprodi@sadewa.ac.id", password_hash=get_password_hash("kaprodi123"), role=UserRole.kaprodi)
    db.add_all([admin, dosen, kaprodi])
    db.flush()

    prodi = ProgramStudi(nama="Informatika", kode="IF", jenjang="S1")
    db.add(prodi)
    db.flush()

    mk1 = MataKuliah(kode_mk="IF201", nama_mk="Machine Learning", sks=3, semester=5, program_studi_id=prodi.id, dosen_id=dosen.id)
    mk2 = MataKuliah(kode_mk="IF202", nama_mk="Basis Data Lanjut", sks=3, semester=4, program_studi_id=prodi.id, dosen_id=dosen.id)
    mk3 = MataKuliah(kode_mk="IF203", nama_mk="Rekayasa Perangkat Lunak", sks=3, semester=4, program_studi_id=prodi.id, dosen_id=dosen.id)
    db.add_all([mk1, mk2, mk3])
    db.flush()

    cpl1 = CPL(kode_cpl="CPL-1", deskripsi="Kemampuan analisis masalah komputasi", program_studi_id=prodi.id)
    cpl2 = CPL(kode_cpl="CPL-2", deskripsi="Kemampuan perancangan solusi perangkat lunak", program_studi_id=prodi.id)
    cpl3 = CPL(kode_cpl="CPL-3", deskripsi="Kemampuan komunikasi dan kolaborasi profesional", program_studi_id=prodi.id)
    db.add_all([cpl1, cpl2, cpl3])
    db.flush()

    cpmk_list = [
        CPMK(kode_cpmk="CPMK-IF201-1", deskripsi="Memahami konsep supervised learning", mata_kuliah_id=mk1.id, bobot_ke_cpl={"CPL-1": 0.6, "CPL-2": 0.4}),
        CPMK(kode_cpmk="CPMK-IF201-2", deskripsi="Implementasi model klasifikasi", mata_kuliah_id=mk1.id, bobot_ke_cpl={"CPL-1": 0.5, "CPL-2": 0.5}),
        CPMK(kode_cpmk="CPMK-IF202-1", deskripsi="Normalisasi dan optimasi query", mata_kuliah_id=mk2.id, bobot_ke_cpl={"CPL-1": 0.4, "CPL-2": 0.6}),
        CPMK(kode_cpmk="CPMK-IF202-2", deskripsi="Desain data warehouse", mata_kuliah_id=mk2.id, bobot_ke_cpl={"CPL-2": 0.7, "CPL-3": 0.3}),
        CPMK(kode_cpmk="CPMK-IF203-1", deskripsi="Menyusun requirement perangkat lunak", mata_kuliah_id=mk3.id, bobot_ke_cpl={"CPL-2": 0.7, "CPL-3": 0.3}),
        CPMK(kode_cpmk="CPMK-IF203-2", deskripsi="Menerapkan testing dan QA", mata_kuliah_id=mk3.id, bobot_ke_cpl={"CPL-1": 0.3, "CPL-2": 0.4, "CPL-3": 0.3}),
    ]
    db.add_all(cpmk_list)
    db.flush()

    mahasiswa_list = []
    for i in range(1, 21):
        mahasiswa_list.append(
            Mahasiswa(
                nim=f"2201{i:03d}",
                nama=f"Mahasiswa {i}",
                angkatan=2022,
                program_studi_id=prodi.id,
            )
        )
    db.add_all(mahasiswa_list)
    db.flush()

    jenis_all = [
        JenisPenilaian.tugas,
        JenisPenilaian.kuis,
        JenisPenilaian.uts,
        JenisPenilaian.uas,
        JenisPenilaian.proyek,
    ]

    penilaian_rows = []
    for m in mahasiswa_list:
        for cpmk in cpmk_list:
            for jenis in jenis_all:
                base = random.uniform(55, 88)
                jitter = random.uniform(-8, 8)
                nilai = max(35, min(98, base + jitter))
                penilaian_rows.append(
                    Penilaian(
                        mahasiswa_id=m.id,
                        mata_kuliah_id=cpmk.mata_kuliah_id,
                        cpmk_id=cpmk.id,
                        jenis=jenis,
                        nilai=round(nilai, 2),
                        semester="Ganjil",
                        tahun_akademik="2025/2026",
                    )
                )

    db.add_all(penilaian_rows)
    db.commit()
    return {
        "message": "Seed sukses",
        "users": 3,
        "program_studi": 1,
        "mata_kuliah": 3,
        "mahasiswa": 20,
        "cpl": 3,
        "cpmk": 6,
        "penilaian": len(penilaian_rows),
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
