"""
Seed data demo SADEWA yang lengkap dan konsisten dengan aturan sistem.

Isi:
  - 2 fakultas, 5 prodi, akun semua role (password: password123)
  - Per prodi: kurikulum 2020 (published, diarsipkan), 2024 (aktif, dipakai MK), 2026 (draf revisi)
  - 8 CPL x 3 IK, 12-13 mata kuliah, CPMK + pemetaan IK, jenis evaluasi, bentuk penilaian,
    matriks bobot yang lolos cek_siap_dinilai
  - Mahasiswa angkatan 2022-2026, peserta, nilai per (bentuk penilaian x IK) dengan pola realistis
    (kemampuan mahasiswa, kesulitan CPL, tren per angkatan), lalu dikalkulasi lewat mesin asli
    sehingga capaian IK/CPMK/CPL tersimpan dalam format terbaru (CPL per mata kuliah)
  - Skala nilai, range nilai CPL, laporan evaluasi berbagai status, RPS, arsip kurikulum & semester

Cara pakai (dari folder backend/):
    python -m app.core.seed_demo --reset     # HAPUS semua tabel lalu isi ulang
    python -m app.core.seed_demo             # hanya jalan jika tabel users masih kosong

Database target diambil dari DATABASE_URL (backend/.env atau variabel lingkungan).
"""
from __future__ import annotations

import argparse
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal, engine
from app.core.security import get_password_hash
from app.models import (
    CPL, CPMK, CPMKIKMap, BentukPenilaian, CPMKAchievement, Fakultas, IK, JenisEvaluasi,
    KurikulumVersion, LaporanEvaluasi, Mahasiswa, MataKuliah, MKBentukPenilaian,
    MKBentukPenilaianIKMap, NilaiBentukPenilaian, PengampuMataKuliah, PesertaMataKuliah,
    ProgramStudi, RangeNilaiCPL, RPS, SkalaNilai, User,
)
from app.models.arsip_kurikulum import ArsipKurikulum
from app.models.enums import LaporanStatus, NilaiSource, SemesterEnum, StatusKurikulum, StatusMasuk, UserRole
from app.services.arsip import arsipkan_publish, arsipkan_semester
from app.services.calculation.engine import cek_siap_dinilai, run_kalkulasi

PASSWORD = "password123"
TAHUN_BERJALAN = 2026            # Semester Ganjil 2026/2027 sedang berjalan
TAHUN_AJARAN_LALU = "2025/2026"  # Tahun ajaran terakhir yang sudah selesai dinilai
ANGKATAN = [2022, 2023, 2024, 2025, 2026]
MHS_PER_ANGKATAN = 24
RNG = random.Random(2026)

# ---------------------------------------------------------------------------------------
# Definisi data
# ---------------------------------------------------------------------------------------
# CPL: (deskripsi, topik untuk IK). MK: (kode, nama, sks, level semester 1-8, [indeks CPL], jenis)
# jenis: "t" teori, "p" praktikum, "j" proyek
FAKULTAS = [
    {
        "kode": "FT", "nama": "Fakultas Teknik", "no": 21,
        "dekan": ("Prof. Dr. Ir. Hartono Wibisono, M.T.", "dekan@sadewa.ac.id"),
        "prodi": [
            {
                "kode": "IF", "nama": "Informatika", "no": 1,
                "admin": ("Admin Prodi Informatika", "adminprodi@sadewa.ac.id"),
                "kaprodi": ("Dr. Arif Setiawan, M.Kom.", "kaprodi@sadewa.ac.id"),
                "dosen": [
                    ("Dr. Rina Kusumawati, M.Kom.", "dosen@sadewa.ac.id"),
                    ("Ahmad Fauzi, S.Kom., M.T.", None), ("Dewi Lestari, M.Cs.", None),
                    ("Dr. Bambang Hermawan, M.Kom.", None), ("Indah Permatasari, M.Kom.", None),
                    ("Yoga Pratama, S.T., M.Eng.", None),
                ],
                "cpl": [
                    ("Mampu menerapkan pemikiran logis, kritis, sistematis, dan inovatif dalam pengembangan ilmu dan teknologi informatika", "pemikiran komputasional"),
                    ("Mampu menganalisis permasalahan komputasi kompleks dan menerapkan prinsip matematika serta ilmu komputer untuk menyelesaikannya", "analisis algoritma dan matematika komputasi"),
                    ("Mampu merancang, mengimplementasikan, dan mengevaluasi perangkat lunak sesuai kebutuhan pengguna", "rekayasa perangkat lunak"),
                    ("Mampu merancang dan mengelola basis data serta sistem informasi", "basis data dan sistem informasi"),
                    ("Mampu menerapkan konsep jaringan komputer, keamanan informasi, dan sistem terdistribusi", "jaringan dan keamanan"),
                    ("Mampu menerapkan kecerdasan buatan dan analitik data untuk menyelesaikan masalah nyata", "kecerdasan buatan dan analitik data"),
                    ("Mampu berkomunikasi secara efektif dan bekerja sama dalam tim multidisiplin", "komunikasi dan kerja tim"),
                    ("Mampu menunjukkan sikap profesional, etika, dan tanggung jawab dalam praktik komputasi", "etika dan profesionalisme"),
                ],
                "mk": [
                    ("IF101", "Algoritma dan Pemrograman", 4, 1, [0, 1], "p"),
                    ("IF102", "Matematika Diskrit", 3, 1, [1, 0], "t"),
                    ("IF103", "Pengantar Teknologi Informasi", 2, 1, [6, 7], "t"),
                    ("IF201", "Struktur Data", 3, 2, [1, 2], "p"),
                    ("IF202", "Pemrograman Berorientasi Objek", 3, 2, [2, 0], "p"),
                    ("IF203", "Basis Data", 3, 3, [3, 2], "p"),
                    ("IF301", "Rekayasa Perangkat Lunak", 3, 4, [2, 6], "t"),
                    ("IF302", "Jaringan Komputer", 3, 4, [4, 1], "p"),
                    ("IF303", "Kecerdasan Buatan", 3, 5, [5, 1], "t"),
                    ("IF304", "Keamanan Informasi", 3, 5, [4, 7], "t"),
                    ("IF401", "Pembelajaran Mesin", 3, 6, [5, 3], "p"),
                    ("IF402", "Proyek Perangkat Lunak", 4, 6, [2, 6, 7], "j"),
                    ("IF403", "Etika Profesi Teknologi Informasi", 2, 7, [7, 6], "t"),
                ],
                # Pola capaian: CPL lemah, CPL menurun antar angkatan, CPL kuat
                "pola": {"lemah": 4, "turun": 5, "kuat": 6},
            },
            {
                "kode": "TE", "nama": "Teknik Elektro", "no": 2,
                "admin": ("Admin Prodi Teknik Elektro", "adminprodi.te@sadewa.ac.id"),
                "kaprodi": ("Dr. Eng. Bayu Saputra, M.T.", "kaprodi.te@sadewa.ac.id"),
                "dosen": [
                    ("Dr. Teguh Santosa, M.T.", None), ("Hendra Gunawan, S.T., M.T.", None),
                    ("Siti Rahmawati, M.Eng.", None), ("Agus Salim, M.T.", None),
                    ("Ratna Sari, Ph.D.", None), ("Fajar Nugroho, M.T.", None),
                ],
                "cpl": [
                    ("Mampu menerapkan matematika, sains, dan prinsip rekayasa untuk menyelesaikan masalah teknik elektro", "matematika dan prinsip rekayasa elektro"),
                    ("Mampu menganalisis rangkaian listrik dan sistem elektronika", "rangkaian dan elektronika"),
                    ("Mampu merancang sistem kendali dan instrumentasi", "sistem kendali dan instrumentasi"),
                    ("Mampu menganalisis dan merancang sistem tenaga listrik", "sistem tenaga listrik"),
                    ("Mampu menerapkan prinsip telekomunikasi dan pengolahan sinyal", "telekomunikasi dan pengolahan sinyal"),
                    ("Mampu merancang dan melaksanakan eksperimen laboratorium serta menganalisis datanya", "eksperimen laboratorium"),
                    ("Mampu berkomunikasi secara efektif dan bekerja sama dalam tim rekayasa", "komunikasi dan kerja tim rekayasa"),
                    ("Mampu menerapkan etika profesi serta keselamatan dan kesehatan kerja (K3)", "etika profesi dan K3"),
                ],
                "mk": [
                    ("TE101", "Kalkulus Teknik", 3, 1, [0, 1], "t"),
                    ("TE102", "Fisika Listrik dan Magnet", 3, 1, [0, 5], "t"),
                    ("TE103", "Rangkaian Listrik I", 3, 2, [1, 0], "t"),
                    ("TE104", "Praktikum Rangkaian Listrik", 1, 2, [5, 6], "p"),
                    ("TE201", "Elektronika Dasar", 3, 3, [1, 5], "p"),
                    ("TE202", "Sinyal dan Sistem", 3, 3, [4, 0], "t"),
                    ("TE301", "Sistem Kendali", 3, 4, [2, 0], "t"),
                    ("TE302", "Mesin Listrik", 3, 4, [3, 1], "p"),
                    ("TE303", "Instrumentasi Elektronika", 3, 5, [2, 5], "p"),
                    ("TE304", "Sistem Tenaga Listrik", 3, 5, [3, 7], "t"),
                    ("TE401", "Telekomunikasi Digital", 3, 6, [4, 1], "t"),
                    ("TE402", "Proyek Rekayasa Elektro", 4, 6, [6, 2, 3], "j"),
                    ("TE403", "Kewirausahaan Teknologi", 2, 7, [6], "t"),
                ],
                "pola": {"lemah": 3, "turun": 1, "kuat": 5},
            },
            {
                "kode": "TS", "nama": "Teknik Sipil", "no": 3,
                "admin": ("Admin Prodi Teknik Sipil", "adminprodi.ts@sadewa.ac.id"),
                "kaprodi": ("Dr. Ir. Sutrisno, M.T.", "kaprodi.ts@sadewa.ac.id"),
                "dosen": [
                    ("Dr. Joko Susilo, M.T.", None), ("Lina Marlina, M.T.", None),
                    ("Rudi Hartono, M.Sc.", None), ("Wahyu Setiawan, M.T.", None),
                    ("Maya Anggraini, Ph.D.", None), ("Dimas Prakoso, M.T.", None),
                ],
                "cpl": [
                    ("Mampu menerapkan matematika dan mekanika rekayasa dalam perencanaan teknik sipil", "matematika dan mekanika rekayasa"),
                    ("Mampu menganalisis dan merancang struktur bangunan", "analisis dan perancangan struktur"),
                    ("Mampu menganalisis perilaku tanah dan merancang fondasi", "geoteknik dan fondasi"),
                    ("Mampu merencanakan sistem pengelolaan sumber daya air", "hidrologi dan sumber daya air"),
                    ("Mampu merencanakan sistem transportasi dan infrastruktur jalan", "rekayasa transportasi"),
                    ("Mampu mengelola proyek konstruksi secara efektif dan efisien", "manajemen konstruksi"),
                    ("Mampu berkomunikasi secara efektif dan bekerja dalam tim proyek", "komunikasi dan kerja tim proyek"),
                    ("Mampu menerapkan etika profesi dan prinsip pembangunan berkelanjutan", "etika dan keberlanjutan"),
                ],
                "mk": [
                    ("TS101", "Mekanika Teknik I", 3, 1, [0, 1], "t"),
                    ("TS102", "Matematika Teknik", 3, 1, [0, 7], "t"),
                    ("TS103", "Menggambar Teknik", 2, 2, [6, 0], "p"),
                    ("TS201", "Analisis Struktur", 3, 3, [1, 0], "t"),
                    ("TS202", "Mekanika Tanah", 3, 3, [2, 0], "p"),
                    ("TS203", "Hidrologi", 3, 4, [3, 7], "t"),
                    ("TS301", "Struktur Beton", 3, 4, [1, 5], "t"),
                    ("TS302", "Rekayasa Fondasi", 3, 5, [2, 1], "t"),
                    ("TS303", "Rekayasa Transportasi", 3, 5, [4, 7], "t"),
                    ("TS401", "Bangunan Air", 3, 6, [3, 4], "t"),
                    ("TS402", "Manajemen Proyek Konstruksi", 3, 6, [5, 6], "t"),
                    ("TS403", "Tugas Besar Perancangan Gedung", 4, 7, [1, 5, 6], "j"),
                ],
                "pola": {"lemah": 2, "turun": 3, "kuat": 6},
            },
        ],
    },
    {
        "kode": "FEB", "nama": "Fakultas Ekonomika dan Bisnis", "no": 22,
        "dekan": ("Prof. Dr. Retno Widyaningsih, S.E., M.Si.", "dekan.feb@sadewa.ac.id"),
        "prodi": [
            {
                "kode": "MN", "nama": "Manajemen", "no": 1,
                "admin": ("Admin Prodi Manajemen", "adminprodi.mn@sadewa.ac.id"),
                "kaprodi": ("Dr. Wulan Sari, S.E., M.M.", "kaprodi.mn@sadewa.ac.id"),
                "dosen": [
                    ("Dr. Nur Hidayah, M.M.", None), ("Andi Wijaya, M.B.A.", None),
                    ("Putri Ayu Lestari, M.M.", None), ("Budi Santoso, M.Si.", None),
                    ("Diana Puspita, M.M.", None), ("Rizky Ramadhan, M.M.", None),
                ],
                "cpl": [
                    ("Mampu menerapkan konsep manajemen dan teori organisasi dalam pengambilan keputusan", "konsep manajemen dan organisasi"),
                    ("Mampu menganalisis laporan keuangan dan keputusan investasi perusahaan", "manajemen keuangan"),
                    ("Mampu merumuskan strategi pemasaran berbasis riset pasar", "strategi pemasaran"),
                    ("Mampu mengelola sumber daya manusia secara efektif", "manajemen sumber daya manusia"),
                    ("Mampu mengelola operasi dan rantai pasok organisasi", "manajemen operasi dan rantai pasok"),
                    ("Mampu menerapkan metode kuantitatif dan riset bisnis", "metode kuantitatif dan riset bisnis"),
                    ("Mampu mengembangkan inovasi dan rencana usaha", "kewirausahaan dan inovasi"),
                    ("Mampu berkomunikasi, memimpin, dan bertindak sesuai etika bisnis", "kepemimpinan dan etika bisnis"),
                ],
                "mk": [
                    ("MN101", "Pengantar Manajemen", 3, 1, [0, 7], "t"),
                    ("MN102", "Matematika Ekonomi", 3, 1, [5, 1], "t"),
                    ("MN103", "Pengantar Akuntansi", 3, 2, [1, 5], "t"),
                    ("MN201", "Manajemen Pemasaran", 3, 3, [2, 0], "t"),
                    ("MN202", "Manajemen Keuangan", 3, 3, [1, 5], "t"),
                    ("MN203", "Manajemen Sumber Daya Manusia", 3, 4, [3, 7], "t"),
                    ("MN204", "Manajemen Operasi", 3, 4, [4, 5], "p"),
                    ("MN301", "Perilaku Organisasi", 3, 5, [0, 3], "t"),
                    ("MN302", "Riset Pemasaran", 3, 5, [2, 5], "p"),
                    ("MN401", "Manajemen Strategik", 3, 6, [0, 6], "t"),
                    ("MN402", "Kewirausahaan", 3, 6, [6, 2], "j"),
                    ("MN403", "Etika Bisnis dan Kepemimpinan", 2, 7, [7, 3], "t"),
                ],
                "pola": {"lemah": 5, "turun": 2, "kuat": 0},
            },
            {
                "kode": "AK", "nama": "Akuntansi", "no": 2,
                "admin": ("Admin Prodi Akuntansi", "adminprodi.ak@sadewa.ac.id"),
                "kaprodi": ("Dr. Hesti Rahayu, S.E., M.Ak., Ak.", "kaprodi.ak@sadewa.ac.id"),
                "dosen": [
                    ("Dr. Sri Wahyuni, Ak., M.Si.", None), ("Eko Prasetyo, M.Ak.", None),
                    ("Fitri Handayani, M.Si.", None), ("Hadi Kurniawan, Ak., M.Ak.", None),
                    ("Novi Rahayu, M.Ak.", None), ("Taufik Hidayat, M.Si.", None),
                ],
                "cpl": [
                    ("Mampu menyusun laporan keuangan sesuai standar akuntansi keuangan", "standar akuntansi keuangan"),
                    ("Mampu menerapkan akuntansi biaya dan manajemen untuk pengambilan keputusan", "akuntansi biaya dan manajemen"),
                    ("Mampu melaksanakan audit dan jasa asurans sesuai standar", "auditing dan asurans"),
                    ("Mampu menerapkan ketentuan perpajakan dalam praktik bisnis", "perpajakan"),
                    ("Mampu merancang dan mengevaluasi sistem informasi akuntansi", "sistem informasi akuntansi"),
                    ("Mampu menerapkan akuntansi sektor publik dan pelaporan pemerintahan", "akuntansi sektor publik"),
                    ("Mampu menganalisis data dan laporan keuangan untuk mendukung keputusan", "analisis laporan keuangan"),
                    ("Mampu menunjukkan etika profesi dan berkomunikasi secara efektif", "etika profesi akuntan"),
                ],
                "mk": [
                    ("AK101", "Pengantar Akuntansi I", 3, 1, [0, 6], "t"),
                    ("AK102", "Pengantar Bisnis", 2, 1, [7, 6], "t"),
                    ("AK103", "Pengantar Akuntansi II", 3, 2, [0, 6], "t"),
                    ("AK201", "Akuntansi Biaya", 3, 3, [1, 6], "t"),
                    ("AK202", "Akuntansi Keuangan Menengah", 3, 3, [0, 6], "t"),
                    ("AK203", "Perpajakan I", 3, 4, [3, 7], "t"),
                    ("AK204", "Akuntansi Manajemen", 3, 4, [1, 6], "t"),
                    ("AK301", "Sistem Informasi Akuntansi", 3, 5, [4, 6], "p"),
                    ("AK302", "Auditing I", 3, 5, [2, 7], "t"),
                    ("AK401", "Akuntansi Sektor Publik", 3, 6, [5, 0], "t"),
                    ("AK402", "Perpajakan II", 3, 6, [3, 4], "p"),
                    ("AK403", "Auditing II", 3, 7, [2, 4], "j"),
                ],
                "pola": {"lemah": 2, "turun": 4, "kuat": 0},
            },
        ],
    },
]

IK_TEMPLATE = [
    "Menjelaskan konsep dan prinsip dasar {t}",
    "Menerapkan {t} pada studi kasus yang terstruktur",
    "Menganalisis dan mengevaluasi solusi {t} secara kritis",
]

JENIS_EVALUASI = [
    ("Tugas", ["Tugas Individu", "Tugas Kelompok"]),
    ("Kuis", ["Kuis"]),
    ("Ujian", ["UTS", "UAS"]),
    ("Praktikum", ["Laporan Praktikum"]),
    ("Proyek", ["Proyek Akhir"]),
]
TEMPLATE_PENILAIAN = {
    "t": [("Tugas Individu", 20), ("Kuis", 10), ("UTS", 30), ("UAS", 40)],
    "p": [("Tugas Kelompok", 15), ("Laporan Praktikum", 25), ("UTS", 25), ("UAS", 35)],
    "j": [("Tugas Kelompok", 20), ("Proyek Akhir", 50), ("UAS", 30)],
}
EFEK_BENTUK = {"Tugas Individu": 4, "Tugas Kelompok": 5, "Kuis": 0, "UTS": -2, "UAS": -4, "Laporan Praktikum": 4, "Proyek Akhir": 2}

SKALA = [("A", 85), ("AB", 80), ("B", 70), ("BC", 65), ("C", 60), ("D", 50), ("E", 0)]
RANGE_CPL = [
    ("Sangat Baik", 85, 100, "#047857", "Melampaui target capaian"),
    ("Baik", 70, 84.99, "#10B981", "Mencapai target capaian"),
    ("Cukup", 55, 69.99, "#F4A300", "Di bawah target, perlu pendampingan"),
    ("Kurang", 0, 54.99, "#EF4444", "Jauh di bawah target, perlu intervensi"),
]
TAKSONOMI = ["C2", "C3", "C4", "C5", "C6"]

NAMA_DEPAN = [
    "Adi", "Agus", "Aisyah", "Alya", "Andika", "Anisa", "Ardi", "Arya", "Ayu", "Bagas", "Bima", "Bunga",
    "Cahya", "Citra", "Daffa", "Dani", "Dewi", "Dimas", "Dinda", "Eka", "Elsa", "Fadil", "Fajar", "Farah",
    "Fikri", "Gilang", "Hana", "Hanif", "Ilham", "Indra", "Intan", "Kevin", "Kirana", "Laras", "Lukman",
    "Maya", "Nabila", "Naufal", "Nadia", "Oki", "Putri", "Raka", "Rara", "Reza", "Rizki", "Salsa", "Sari",
    "Satria", "Tania", "Tegar", "Umar", "Vina", "Wahyu", "Wulan", "Yogi", "Yuni", "Zahra", "Zaki",
]
NAMA_BELAKANG = [
    "Pratama", "Saputra", "Wijaya", "Kusuma", "Lestari", "Hidayat", "Santoso", "Nugroho", "Rahmawati",
    "Setiawan", "Permata", "Utami", "Firmansyah", "Ramadhan", "Maharani", "Putra", "Anggraini", "Hakim",
    "Gunawan", "Sari", "Purnama", "Wibowo", "Fauzan", "Kurniawan", "Halim", "Syahputra", "Amelia",
    "Prasetyo", "Handayani", "Siregar", "Nasution", "Simanjuntak", "Tanjung", "Harahap", "Daulay",
]


def _slug_email(nama: str) -> str:
    bersih = nama.split(",")[0]
    for gelar in ("Prof.", "Dr.", "Eng.", "Ir.", "Ak."):
        bersih = bersih.replace(gelar, "")
    kata = [k.lower() for k in bersih.replace(".", " ").split() if k]
    return ".".join(kata[:2]) + "@sadewa.ac.id"


def _user(nama, email, role, prodi_id=None, fakultas_id=None, nip=None):
    return User(
        nama=nama, email=email, nip=nip, password_hash=get_password_hash(PASSWORD), role=role,
        program_studi_id=prodi_id, fakultas_id=fakultas_id, is_active=True,
    )


def _waktu(tahun, bulan, hari):
    return datetime(tahun, bulan, hari, 9, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------------------
# Pembuat data
# ---------------------------------------------------------------------------------------
def _buat_kurikulum(db: Session, prodi, defn, admin) -> dict:
    """Kurikulum 2020 (published lama), 2024 (aktif), 2026 (draf). Mengembalikan CPL & IK 2024."""
    hasil = {}
    cpl_defs = defn["cpl"]

    # --- 2020: 7 CPL, CPL-07 menggabungkan komunikasi & etika; 2 IK per CPL ---
    v2020 = KurikulumVersion(
        program_studi_id=prodi.id, version_label="2020", tahun=2020, status=StatusKurikulum.published,
        deskripsi=f"Kurikulum OBE {prodi.nama} 2020", created_by=admin.id, published_at=_waktu(2020, 7, 15),
    )
    db.add(v2020)
    db.flush()
    for i in range(7):
        if i == 6:
            desk, topik = "Mampu berkomunikasi, bekerja sama, dan bersikap profesional serta beretika", "komunikasi dan profesionalisme"
        else:
            desk, topik = cpl_defs[i]
            if i in (2, 5):
                desk = desk.replace("Mampu", "Memiliki kemampuan untuk", 1)
        cpl = CPL(kurikulum_version_id=v2020.id, program_studi_id=prodi.id, kode=f"CPL-{i + 1:02d}",
                  deskripsi=desk, threshold_capaian=65 if i < 6 else 70, created_by=admin.id)
        db.add(cpl)
        db.flush()
        for j in range(2):
            db.add(IK(cpl_id=cpl.id, kode=f"IK-{i + 1:02d}.{j + 1}", deskripsi=IK_TEMPLATE[j].format(t=topik), urutan=j + 1, created_by=admin.id))

    # --- 2024: 8 CPL x 3 IK (dipakai mata kuliah) ---
    v2024 = KurikulumVersion(
        program_studi_id=prodi.id, version_label="2024", tahun=2024, status=StatusKurikulum.published,
        deskripsi=f"Kurikulum OBE {prodi.nama} 2024 (pemisahan CPL etika & komunikasi, threshold 70)",
        created_by=admin.id, published_at=_waktu(2024, 7, 15),
    )
    db.add(v2024)
    db.flush()
    cpls, iks = [], []
    for i, (desk, topik) in enumerate(cpl_defs):
        cpl = CPL(kurikulum_version_id=v2024.id, program_studi_id=prodi.id, kode=f"CPL-{i + 1:02d}",
                  deskripsi=desk, threshold_capaian=70, created_by=admin.id)
        db.add(cpl)
        db.flush()
        cpls.append(cpl)
        iks.append([])
        for j, tpl in enumerate(IK_TEMPLATE):
            ik = IK(cpl_id=cpl.id, kode=f"IK-{i + 1:02d}.{j + 1}", deskripsi=tpl.format(t=topik), urutan=j + 1, created_by=admin.id)
            db.add(ik)
            iks[-1].append(ik)
    db.flush()

    # --- 2026: draf revisi (CPL-06 diperbarui, CPL-09 baru), belum dipakai MK ---
    v2026 = KurikulumVersion(
        program_studi_id=prodi.id, version_label="2026", tahun=2026, status=StatusKurikulum.draft,
        deskripsi=f"Draf revisi kurikulum {prodi.nama} 2026 berdasarkan evaluasi capaian 2024-2026", created_by=admin.id,
    )
    db.add(v2026)
    db.flush()
    draf = list(cpl_defs) + [("Mampu menerapkan prinsip keberlanjutan dan mempertimbangkan dampak sosial dalam praktik profesional", "keberlanjutan dan dampak sosial")]
    for i, (desk, topik) in enumerate(draf):
        if i == 5:
            desk += ", termasuk pemanfaatan teknologi digital secara bertanggung jawab"
        cpl = CPL(kurikulum_version_id=v2026.id, program_studi_id=prodi.id, kode=f"CPL-{i + 1:02d}",
                  deskripsi=desk, threshold_capaian=72, created_by=admin.id)
        db.add(cpl)
        db.flush()
        for j, tpl in enumerate(IK_TEMPLATE):
            db.add(IK(cpl_id=cpl.id, kode=f"IK-{i + 1:02d}.{j + 1}", deskripsi=tpl.format(t=topik), urutan=j + 1, created_by=admin.id))

    for v in (v2020, v2024, v2026):
        db.add_all([SkalaNilai(kurikulum_version_id=v.id, huruf=h, batas_min=b) for h, b in SKALA])
    db.flush()

    # Arsip publish 2020 (tanggal sesuai saat dipublish)
    arsip = arsipkan_publish(db, v2020, admin.id)
    db.flush()
    arsip.created_at = v2020.published_at

    hasil.update(v2020=v2020, v2024=v2024, v2026=v2026, cpls=cpls, iks=iks)
    return hasil


def _rancang_cpmk(mk_def, iks_per_cpl, urut_mk):
    """
    Mengembalikan daftar CPMK: (bobot, [(ik, bobot_map), ...]).
    Total bobot CPMK = 100 dan Σ bobot pemetaan tiap CPMK = bobot CPMK.
    """
    covered = mk_def[4]
    if len(covered) == 1:
        c = covered[0]
        return [(50, [(iks_per_cpl[c][0], 25), (iks_per_cpl[c][1], 25)]), (50, [(iks_per_cpl[c][2], 50)])]
    bobot = [50, 50] if len(covered) == 2 else [30, 30, 40]
    out = []
    for j, (c, b) in enumerate(zip(covered, bobot)):
        a = (urut_mk + j) % 3
        out.append((b, [(iks_per_cpl[c][a], b // 2), (iks_per_cpl[c][(a + 1) % 3], b - b // 2)]))
    return out


def _buat_struktur_mk(db: Session, prodi, defn, kur, dosen, admin, bentuk_by_nama) -> list[dict]:
    mks = []
    for urut, mk_def in enumerate(defn["mk"]):
        kode, nama, sks, level, covered, jenis = mk_def
        semester = SemesterEnum.ganjil if level % 2 == 1 else SemesterEnum.genap
        mk = MataKuliah(
            kurikulum_version_id=kur["v2024"].id, program_studi_id=prodi.id, kode=kode, nama=nama, sks=sks,
            semester=semester, tahun_ajaran=TAHUN_AJARAN_LALU,
        )
        db.add(mk)
        db.flush()

        # Pengampu: koordinator bergilir; MK dengan sks >= 3 punya anggota tim
        koor = dosen[urut % len(dosen)]
        db.add(PengampuMataKuliah(mata_kuliah_id=mk.id, user_id=koor.id, is_koordinator="1"))
        if sks >= 3:
            db.add(PengampuMataKuliah(mata_kuliah_id=mk.id, user_id=dosen[(urut + 2) % len(dosen)].id, is_koordinator="0"))

        # CPMK + pemetaan IK
        rancangan = _rancang_cpmk(mk_def, kur["iks"], urut)
        kolom_ik: dict[int, int] = {}
        cpmk_objs = []
        for n, (bobot, peta) in enumerate(rancangan, start=1):
            topik = defn["cpl"][next(i for i, lst in enumerate(kur["iks"]) if peta[0][0] in lst)][1]
            cpmk = CPMK(
                mata_kuliah_id=mk.id, kode=f"CPMK-{n}", bobot=bobot, created_by=koor.id,
                level_taksonomi=TAKSONOMI[min(len(TAKSONOMI) - 1, (level - 1) // 2 + n - 1)],
                deskripsi=f"Mahasiswa mampu menguasai {topik} dalam konteks {nama.lower()}",
            )
            db.add(cpmk)
            db.flush()
            cpmk_objs.append(cpmk)
            for ik, b in peta:
                db.add(CPMKIKMap(cpmk_id=cpmk.id, ik_id=ik.id, bobot=b))
                kolom_ik[ik.id] = kolom_ik.get(ik.id, 0) + b

        # Bentuk penilaian + matriks: sel = bobot_bentuk x bobot_IK / 100 (baris & kolom tepat)
        mbps = []
        for nama_bentuk, r in TEMPLATE_PENILAIAN[jenis]:
            mbp = MKBentukPenilaian(
                mata_kuliah_id=mk.id, bentuk_penilaian_id=bentuk_by_nama[nama_bentuk].id, bobot=r,
                semester=semester, created_by=koor.id,
            )
            db.add(mbp)
            db.flush()
            for ik_id, c in kolom_ik.items():
                db.add(MKBentukPenilaianIKMap(mk_bentuk_penilaian_id=mbp.id, ik_id=ik_id, bobot=Decimal(r * c) / 100))
            mbps.append((mbp, nama_bentuk))
        db.flush()

        cpl_ik = {ik.id: ci for ci, lst in enumerate(kur["iks"]) for ik in lst}
        mks.append({"mk": mk, "level": level, "koor": koor, "mbps": mbps, "ik_ids": list(kolom_ik), "cpl_ik": cpl_ik, "cpmk": cpmk_objs})
    return mks


def _buat_mahasiswa(db: Session, prodi, fak_no, prodi_no, nama_terpakai: set) -> list[Mahasiswa]:
    out = []
    for angkatan in ANGKATAN:
        yy = angkatan % 100
        for i in range(1, MHS_PER_ANGKATAN + 1):
            while True:
                nama = f"{RNG.choice(NAMA_DEPAN)} {RNG.choice(NAMA_BELAKANG)}"
                if nama not in nama_terpakai:
                    nama_terpakai.add(nama)
                    break
            out.append(Mahasiswa(
                nim=f"{fak_no:02d}{prodi_no:02d}01{yy:02d}{i:04d}", nama=nama, angkatan=angkatan,
                semester_aktif=(TAHUN_BERJALAN - angkatan) * 2 + 1,
                status_masuk=StatusMasuk.transfer if i % 23 == 0 else StatusMasuk.reguler,
                program_studi_id=prodi.id, is_active=True,
            ))
    db.add_all(out)
    db.flush()
    return out


def _isi_nilai(db: Session, defn, mks, mahasiswa) -> int:
    """Peserta & nilai untuk MK yang semesternya sudah dilewati tiap angkatan."""
    pola = defn["pola"]
    dasar = {i: 76.0 for i in range(len(defn["cpl"]))}
    tren = {i: 0.0 for i in dasar}
    dasar[pola["lemah"]], tren[pola["lemah"]] = 64.0, 1.5    # lemah tapi membaik
    tren[pola["turun"]] = -3.0                               # menurun antar angkatan
    dasar[pola["kuat"]] = 83.0
    kemampuan = {m.id: RNG.gauss(0, 7) - (14 if RNG.random() < 0.06 else 0) for m in mahasiswa}
    efek_ik: dict[int, float] = {}

    total = 0
    for info in mks:
        mk, level = info["mk"], info["level"]
        efek_mk = RNG.gauss(0, 2.5)
        peserta_mhs = [m for m in mahasiswa if (TAHUN_BERJALAN - m.angkatan) * 2 >= level]
        peserta = [PesertaMataKuliah(mata_kuliah_id=mk.id, mahasiswa_id=m.id, kelas="A" if i % 2 == 0 else "B") for i, m in enumerate(peserta_mhs)]
        db.add_all(peserta)
        db.flush()
        baris = []
        for p, m in zip(peserta, peserta_mhs):
            for mbp, nama_bentuk in info["mbps"]:
                for ik_id in info["ik_ids"]:
                    ci = info["cpl_ik"][ik_id]
                    efek_ik.setdefault(ik_id, RNG.gauss(0, 2))
                    v = (dasar[ci] + tren[ci] * (m.angkatan - 2024) + kemampuan[m.id] + efek_mk
                         + EFEK_BENTUK[nama_bentuk] + efek_ik[ik_id] + RNG.gauss(0, 6))
                    baris.append({
                        "peserta_mata_kuliah_id": p.id, "mk_bentuk_penilaian_id": mbp.id, "ik_id": ik_id,
                        "semester": mk.semester, "nilai": Decimal(max(25, min(100, round(v)))),
                        "source": NilaiSource.manual, "imported_by": info["koor"].id,
                    })
        db.bulk_insert_mappings(NilaiBentukPenilaian, baris)
        total += len(baris)
    db.flush()
    return total


def _buat_laporan_dan_rps(db: Session, prodi, mks, kaprodi) -> tuple[int, int]:
    jml_laporan = 0
    kandidat = [i for i in mks if i["level"] <= 6]
    status_urut = [LaporanStatus.approved, LaporanStatus.approved, LaporanStatus.submitted, LaporanStatus.submitted,
                   LaporanStatus.rejected, LaporanStatus.draft]
    for info, status in zip(kandidat, status_urut):
        mk = info["mk"]
        baris_cpmk = []
        for c in info["cpmk"]:
            rata, n, tuntas = db.query(
                func.avg(CPMKAchievement.nilai), func.count(CPMKAchievement.id),
                func.sum(CPMKAchievement.status_tercapai),
            ).filter(CPMKAchievement.cpmk_id == c.id).one()
            if n:
                baris_cpmk.append(f"- {c.kode}: rata-rata {float(rata):.1f}%, {int(tuntas or 0)} dari {n} mahasiswa tuntas (>= 70%).")
        lemah = min(info["cpmk"], key=lambda c: c.bobot)
        konten = (
            f"LAPORAN EVALUASI MATA KULIAH {mk.kode} {mk.nama.upper()}\n"
            f"Semester {mk.semester.value} {TAHUN_AJARAN_LALU}\n\n"
            "RINGKASAN CAPAIAN\n"
            f"Perkuliahan diikuti mahasiswa dari beberapa angkatan. Capaian CPMK secara umum berada di sekitar target 70%.\n\n"
            "ANALISIS CPMK\n" + "\n".join(baris_cpmk) + "\n\n"
            "FAKTOR PENYEBAB\n- Variasi kesiapan awal mahasiswa antar angkatan.\n- Waktu latihan soal analitis masih terbatas.\n\n"
            "REKOMENDASI\n"
            f"- Menambah latihan terstruktur untuk {lemah.kode}.\n- Memberikan umpan balik tugas lebih cepat (maksimal satu minggu).\n\n"
            "KESIMPULAN\nPembelajaran berjalan sesuai RPS; perbaikan difokuskan pada CPMK dengan ketuntasan terendah."
        )
        lap = LaporanEvaluasi(
            mata_kuliah_id=mk.id, dosen_id=info["koor"].id, semester=mk.semester, konten=konten, status=status,
            version=2 if status == LaporanStatus.rejected else 1,
        )
        if status != LaporanStatus.draft:
            lap.submitted_at = _waktu(2026, 2 if mk.semester == SemesterEnum.ganjil else 7, 10 + jml_laporan)
        if status in (LaporanStatus.approved, LaporanStatus.rejected):
            lap.validated_by = kaprodi.id
            lap.validated_at = lap.submitted_at + timedelta(days=3)
        if status == LaporanStatus.rejected:
            lap.remarks = "Mohon lengkapi analisis faktor penyebab dengan data kehadiran dan rencana tindak lanjut yang terukur."
        db.add(lap)
        jml_laporan += 1

    jml_rps = 0
    for info in mks:
        mk = info["mk"]
        cpmks = info["cpmk"]
        # Format 2: Kontrak Kuliah + RPS (sama dengan keluaran Generate RPS)
        kode_cpmk = [c.kode for c in cpmks]
        pertemuan = []
        for minggu in range(1, 17):
            if minggu in (8, 16):
                pertemuan.append({"minggu": minggu, "jenis": "UTS" if minggu == 8 else "UAS", "bobot": 15})
                continue
            c = cpmks[(minggu - 1) * len(cpmks) // 16]
            pertemuan.append({
                "minggu": minggu, "jenis": "kuliah",
                "kemampuan_akhir": f"Mahasiswa mampu menerapkan (C3) {c.deskripsi.split(' dalam ')[0].lower()}.",
                "bahan_kajian_judul": f"Pokok Bahasan {minggu}",
                "bahan_kajian": f"konsep, penerapan, dan studi kasus {mk.nama.lower()} bagian {minggu}.",
                "metode": "Case Method, Diskusi, SDL" if minggu % 3 else "Project Based Learning, Praktikum, SDL",
                "waktu": f"{mk.sks} x 50 menit",
                "pengalaman_belajar": [f"Mahasiswa mempelajari pokok bahasan {minggu}, mengerjakan latihan, dan mendiskusikan hasilnya."],
                "target_cpmk": [c.kode],
                "kriteria_indikator": ["Ketepatan konsep; kelengkapan langkah penyelesaian; kemampuan menjelaskan hasil."],
                "bobot": None,
            })
        cpl_ids = {ik.cpl_id for ik in db.query(IK).filter(IK.id.in_(info["ik_ids"])).all()}
        konten = {
            "format": 2,
            "kode_mk": mk.kode,
            "deskripsi_mk": f"Mata kuliah {mk.nama} membekali mahasiswa dengan konsep dan keterampilan inti yang mendukung capaian pembelajaran program studi {prodi.nama}.",
            "cpl": [{"kode": c.kode, "deskripsi": c.deskripsi, "label": ""} for c in db.query(CPL).filter(CPL.id.in_(cpl_ids)).order_by(CPL.kode).all()],
            "cpmk": [{"kode": c.kode, "deskripsi": c.deskripsi} for c in cpmks],
            "penilaian": [
                {"poin": "Aktivitas Partisipatif", "komponen": "Aktivitas", "rincian": ["Keaktifan dan kontribusi diskusi"], "bobot": 10, "cpmk": kode_cpmk[:2]},
                {"poin": "Hasil Proyek", "komponen": "Hasil Proyek", "rincian": ["Proyek akhir"], "bobot": 40, "cpmk": kode_cpmk},
                {"poin": "Tugas", "komponen": "Tugas", "rincian": ["Tugas harian", "Kuis"], "bobot": 20, "cpmk": kode_cpmk},
                {"poin": "Kognitif / Pengetahuan", "komponen": "UTS", "rincian": [], "bobot": 15, "cpmk": kode_cpmk[: max(1, len(kode_cpmk) // 2)]},
                {"poin": "Kognitif / Pengetahuan", "komponen": "UAS", "rincian": [], "bobot": 15, "cpmk": kode_cpmk},
            ],
            "pertemuan": pertemuan,
            "referensi": [f"Bahan ajar {mk.nama}, Program Studi {prodi.nama}."],
        }
        db.add(RPS(mata_kuliah_id=mk.id, tahun_ajaran=TAHUN_AJARAN_LALU, semester=mk.semester, status="draft",
                   konten=konten, created_by=info["koor"].id))
        jml_rps += 1
    db.flush()
    return jml_laporan, jml_rps


# ---------------------------------------------------------------------------------------
def seed_demo(db: Session, log=print) -> dict:
    if db.query(User).first():
        raise RuntimeError("Database sudah berisi user. Jalankan dengan --reset untuk mengosongkan dan mengisi ulang.")

    t0 = time.time()
    ringkas = {"prodi": 0, "mata_kuliah": 0, "mahasiswa": 0, "nilai": 0, "laporan": 0, "rps": 0}
    akun = []
    db.add(_user("Super Admin SADEWA", "superadmin@sadewa.ac.id", UserRole.super_admin))
    akun.append(("Super Admin", "superadmin@sadewa.ac.id"))
    nama_terpakai: set[str] = set()
    nip = 198001012005011000

    for fdef in FAKULTAS:
        fak = Fakultas(kode=fdef["kode"], nama=fdef["nama"])
        db.add(fak)
        db.flush()
        db.add(_user(fdef["dekan"][0], fdef["dekan"][1], UserRole.dekan, fakultas_id=fak.id))
        akun.append((f"Dekan {fdef['kode']}", fdef["dekan"][1]))

        for pdef in fdef["prodi"]:
            log(f"  - {pdef['nama']}: struktur kurikulum")
            prodi = ProgramStudi(kode=pdef["kode"], nama=pdef["nama"], fakultas_id=fak.id)
            db.add(prodi)
            db.flush()
            admin = _user(pdef["admin"][0], pdef["admin"][1], UserRole.admin_prodi, prodi_id=prodi.id)
            kaprodi = _user(pdef["kaprodi"][0], pdef["kaprodi"][1], UserRole.kaprodi, prodi_id=prodi.id, nip=str(nip))
            nip += 1
            dosen = []
            for nama, email in pdef["dosen"]:
                dosen.append(_user(nama, email or _slug_email(nama), UserRole.dosen, prodi_id=prodi.id, nip=str(nip)))
                nip += 1
            db.add_all([admin, kaprodi, *dosen])
            db.flush()
            akun += [(f"Admin Prodi {pdef['kode']}", admin.email), (f"Kaprodi {pdef['kode']}", kaprodi.email),
                     (f"Dosen {pdef['kode']} (contoh)", dosen[0].email)]

            db.add_all([RangeNilaiCPL(program_studi_id=prodi.id, nama=n, batas_bawah=b, batas_atas=a, warna=w, keterangan=k)
                        for n, b, a, w, k in RANGE_CPL])
            bentuk_by_nama = {}
            for urut, (je_nama, bentuk_list) in enumerate(JENIS_EVALUASI, start=1):
                je = JenisEvaluasi(program_studi_id=prodi.id, nama=je_nama, urutan=urut, bobot=None)
                db.add(je)
                db.flush()
                for bn in bentuk_list:
                    bp = BentukPenilaian(jenis_evaluasi_id=je.id, nama=bn)
                    db.add(bp)
                    bentuk_by_nama[bn] = bp
            db.flush()

            kur = _buat_kurikulum(db, prodi, pdef, admin)
            prodi.kurikulum_aktif_id = kur["v2024"].id  # kurikulum yang dipakai Analitik OBE
            mks = _buat_struktur_mk(db, prodi, pdef, kur, dosen, admin, bentuk_by_nama)

            # Arsip publish kurikulum 2024 (setelah struktur MK lengkap)
            arsip = arsipkan_publish(db, kur["v2024"], admin.id)
            db.flush()
            arsip.created_at = kur["v2024"].published_at

            mahasiswa = _buat_mahasiswa(db, prodi, fdef["no"], pdef["no"], nama_terpakai)
            log(f"  - {pdef['nama']}: nilai {len(mahasiswa)} mahasiswa")
            ringkas["nilai"] += _isi_nilai(db, pdef, mks, mahasiswa)
            db.commit()

            log(f"  - {pdef['nama']}: kalkulasi {len(mks)} mata kuliah")
            for info in mks:
                masalah = cek_siap_dinilai(db, info["mk"].id)
                if masalah:
                    raise RuntimeError(f"{info['mk'].kode} tidak lolos validasi bobot: {masalah}")
                run_kalkulasi(db, info["mk"].id)

            lap, rps = _buat_laporan_dan_rps(db, prodi, mks, kaprodi)
            for semester, bulan in ((SemesterEnum.ganjil, 1), (SemesterEnum.genap, 7)):
                a = arsipkan_semester(db, prodi.id, semester, TAHUN_AJARAN_LALU, admin.id)
                db.flush()
                a.created_at = _waktu(2026, bulan, 31)
            db.commit()

            ringkas["prodi"] += 1
            ringkas["mata_kuliah"] += len(mks)
            ringkas["mahasiswa"] += len(mahasiswa)
            ringkas["laporan"] += lap
            ringkas["rps"] += rps

    ringkas["arsip"] = db.query(ArsipKurikulum).count()
    ringkas["detik"] = round(time.time() - t0, 1)
    ringkas["akun"] = akun
    return ringkas


def main():
    parser = argparse.ArgumentParser(description="Seed data demo SADEWA yang lengkap dan konsisten.")
    parser.add_argument("--reset", action="store_true", help="HAPUS semua tabel lalu buat ulang sebelum mengisi data")
    args = parser.parse_args()

    if args.reset:
        print(f"Mengosongkan database {engine.url.render_as_string(hide_password=True)} ...")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Mengisi data demo:")
        hasil = seed_demo(db)
    except RuntimeError as e:
        print(f"Dibatalkan: {e}")
        sys.exit(1)
    finally:
        db.close()

    print(f"\nSelesai dalam {hasil['detik']} detik.")
    for k in ("prodi", "mata_kuliah", "mahasiswa", "nilai", "laporan", "rps", "arsip"):
        print(f"  {k:<12} {hasil[k]}")
    print(f"\nAkun (semua password: {PASSWORD}):")
    for peran, email in hasil["akun"]:
        print(f"  {peran:<24} {email}")


if __name__ == "__main__":
    main()
