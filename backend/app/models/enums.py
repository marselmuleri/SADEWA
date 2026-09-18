import enum


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    dosen = "dosen"
    kaprodi = "kaprodi"
    dekan = "dekan"


class JenisPenilaian(str, enum.Enum):
    tugas = "tugas"
    uts = "uts"
    uas = "uas"
    proyek = "proyek"
    kuis = "kuis"
