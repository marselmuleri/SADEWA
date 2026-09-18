import enum


class UserRole(str, enum.Enum):
    admin = "Admin"
    dosen = "Dosen"
    kaprodi = "Kaprodi"
    dekan = "Dekan"


class StatusMasuk(str, enum.Enum):
    reguler = "Reguler"
    transfer = "Transfer"


class StatusKurikulum(str, enum.Enum):
    draft = "draft"
    published = "published"


class SemesterEnum(str, enum.Enum):
    ganjil = "Ganjil"
    genap = "Genap"


class NilaiSource(str, enum.Enum):
    siap = "siap"
    upload = "upload"
    manual = "manual"


class StatusOutcome(str, enum.Enum):
    tercapai = "Tercapai"
    tidak_tercapai = "Tidak Tercapai"


class NarasiTipe(str, enum.Enum):
    rekomendasi_umum = "rekomendasi_umum"
    per_mahasiswa = "per_mahasiswa"


class NarasiStatus(str, enum.Enum):
    draft = "draft"
    finalized = "finalized"


class LaporanStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"


class SiapSyncStatus(str, enum.Enum):
    success = "success"
    failed = "failed"
    not_configured = "not_configured"