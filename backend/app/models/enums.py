import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    dosen = "dosen"
    kaprodi = "kaprodi"


class JenisPenilaian(str, enum.Enum):
    tugas = "tugas"
    uts = "uts"
    uas = "uas"
    proyek = "proyek"
    kuis = "kuis"
