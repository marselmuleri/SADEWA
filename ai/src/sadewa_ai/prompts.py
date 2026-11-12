"""
Penyusunan prompt.

Dipisahkan dari rag_chain.py agar bisa diuji tanpa memanggil LLM maupun
memuat vector store.
"""

from typing import Any, Dict, List

from .config import settings

SYSTEM_RPS = (
    "Kamu adalah sistem generator RPS akademik berbasis OBE yang presisi. "
    "Kembalikan hanya JSON valid, mulai dengan { dan akhiri dengan }. "
    "Tidak ada teks lain, tidak ada markdown."
)

SYSTEM_NARASI = (
    "Kamu adalah asisten penyusun laporan evaluasi kurikulum untuk borang "
    "akreditasi program studi. Kembalikan hanya JSON valid, mulai dengan { dan "
    "akhiri dengan }. Tidak ada teks lain, tidak ada markdown."
)


def build_rps_prompt(
    mk_name: str,
    sks: int,
    semester: str,
    prodi: str,
    deskripsi: str,
    context_kurikulum: str,
    context_web: str = "",
) -> str:
    """Prompt untuk pembangkitan Kontrak Kuliah + RPS 16 pertemuan (format RPS baru)."""
    topik = (deskripsi or "").strip()
    if topik:
        blok_topik = (
            "## Topik / Fokus dari Dosen (WAJIB DIPENUHI)\n"
            f"{topik}\n"
            "Topik ini adalah permintaan eksplisit dosen. Integrasikan ke dalam materi "
            f"mata kuliah {mk_name}: minimal 5 pertemuan (di luar UTS dan UAS) harus "
            "membahas topik ini secara langsung pada kolom \"bahan_kajian\" dan "
            "\"kemampuan_akhir\". Jika topik tidak berkaitan langsung dengan mata kuliah, "
            "jadikan studi kasus atau penerapan dalam mata kuliah tersebut. Sisa pertemuan "
            "boleh memuat materi inti mata kuliah."
        )
        aturan_topik = (
            f'- Topik/fokus dosen ("{topik}") HARUS tercermin jelas pada bahan kajian pertemuan, '
            "bukan hanya disebut sekilas"
        )
    else:
        blok_topik = (
            "## Topik / Fokus dari Dosen\n"
            "(tidak ada, susun dari silabus standar mata kuliah)"
        )
        aturan_topik = "- Susun materi dari silabus standar mata kuliah"

    uts, uas, n = settings.minggu_uts, settings.minggu_uas, settings.jumlah_pertemuan
    return f"""Kamu adalah sistem generator RPS (Rencana Pembelajaran Semester) resmi
untuk universitas berbasis OBE (Outcome-Based Education).

Tugasmu: generate Kontrak Kuliah dan RPS yang VALID, PRESISI, dan bebas halusinasi.
Kamu WAJIB mengikuti format dan standar dari dokumen kurikulum resmi berikut.
Jika konteks di bawah tidak memuat informasi yang kamu butuhkan, gunakan
struktur standar OBE nasional dan JANGAN mengarang nama dokumen, nomor
peraturan, atau kode yang tidak ada di konteks.

## Konteks Dokumen Kurikulum (GUNAKAN INI SEBAGAI REFERENSI FORMAT)
{context_kurikulum}

{f'''## Referensi RPS Universitas Lain (Gunakan Sebagai Perbandingan Materi)
{context_web}

''' if context_web else ''}\
## Parameter Mata Kuliah yang Harus Digenerate
- Nama Mata Kuliah : {mk_name}
- Kode MK          : [generate kode yang sesuai format institusi]
- SKS              : {sks} SKS
- Semester         : {semester}
- Program Studi    : {prodi}

{blok_topik}

## Instruksi Output
Kembalikan dalam format JSON yang valid.
JANGAN tambahkan teks lain di luar JSON.
JANGAN gunakan markdown code block.
Langsung mulai dengan karakter {{ dan akhiri dengan }}.

Struktur JSON (contoh isi hanya ilustrasi format, sesuaikan dengan mata kuliah):
{{
  "kode_mk": "string",
  "deskripsi_mk": "string (2-3 kalimat, deskripsi singkat mata kuliah)",
  "cpl": [
    {{"kode": "CPL 2", "deskripsi": "Mampu melakukan perancangan komponen, sistem, dan proses ...", "label": "ENGINEERING DESIGN"}}
  ],
  "cpmk": [
    {{"kode": "CPMK 2.1", "deskripsi": "Mahasiswa mampu mendesain dan mengimplementasikan ..."}}
  ],
  "penilaian": [
    {{"poin": "Aktivitas Partisipatif", "komponen": "Aktivitas", "rincian": ["Kontribusi dalam kelompok"], "bobot": 10, "cpmk": ["CPMK 2.1"]}},
    {{"poin": "Hasil Proyek", "komponen": "Hasil Proyek", "rincian": ["Tugas besar"], "bobot": 40, "cpmk": ["CPMK 2.1"]}},
    {{"poin": "Tugas", "komponen": "Tugas", "rincian": ["Tugas harian", "Kuis"], "bobot": 20, "cpmk": ["CPMK 2.1"]}},
    {{"poin": "Kognitif / Pengetahuan", "komponen": "UTS", "rincian": [], "bobot": 15, "cpmk": ["CPMK 2.1"]}},
    {{"poin": "Kognitif / Pengetahuan", "komponen": "UAS", "rincian": [], "bobot": 15, "cpmk": ["CPMK 2.1"]}}
  ],
  "pertemuan": [
    {{
      "minggu": 1,
      "kemampuan_akhir": "Mahasiswa mampu menerapkan (C3) ...",
      "bahan_kajian_judul": "Judul Pokok Bahasan",
      "bahan_kajian": "rincian sub-pokok bahasan, dipisah koma",
      "metode": "Case Method, Praktikum, SDL",
      "pengalaman_belajar": ["Mahasiswa mempelajari ..., melakukan ..., dan mendokumentasikan ..."],
      "target_cpmk": ["CPMK 2.1", "CPMK 5.1"],
      "kriteria_indikator": ["Mampu ...; mampu ...; hasil ... dapat diverifikasi."]
    }},
    {{"minggu": {uts}, "jenis": "UTS"}},
    {{"minggu": {uas}, "jenis": "UAS"}}
  ],
  "referensi": ["Penulis, Judul Buku, Penerbit, Tahun"]
}}

ATURAN WAJIB:
- "pertemuan" berisi tepat {n} objek, minggu 1-{n} tanpa duplikat.
- Minggu {uts} = UTS dan minggu {uas} = UAS: cukup {{"minggu": {uts}, "jenis": "UTS"}} dan
  {{"minggu": {uas}, "jenis": "UAS"}} tanpa field lain.
- Setiap pertemuan kuliah WAJIB mengisi kemampuan_akhir, bahan_kajian_judul, bahan_kajian,
  metode, pengalaman_belajar (minimal 1 butir), target_cpmk (minimal 1), dan
  kriteria_indikator (minimal 1 butir). JANGAN mengisi bobot pada pertemuan kuliah.
- "kemampuan_akhir" diawali "Mahasiswa mampu" dan mencantumkan level taksonomi Bloom
  dalam kurung, mis. "(C3)" atau "(C4)".
- "metode" berupa daftar metode dipisah koma (mis. Case Method, Praktikum,
  Problem Based Learning, Project Based Learning, Diskusi, Simulasi, SDL).
- Kode CPL berformat "CPL <nomor>" dan "label" adalah nama singkat CPL dalam huruf kapital
  tanpa tanda kurung.
- Kode CPMK berformat "CPMK <nomor CPL>.<urutan>", mis. "CPMK 2.1" untuk CPMK pertama
  yang mendukung CPL 2. Setiap CPL minimal punya satu CPMK.
- Setiap kode pada "target_cpmk" dan pada "cpmk" di "penilaian" HARUS ada di array "cpmk".
- "penilaian": 3-6 baris. Total bobot seluruh baris = {settings.bobot_total}. WAJIB ada satu
  baris dengan komponen "UTS" dan satu baris dengan komponen "UAS" (poin evaluasi
  "Kognitif / Pengetahuan"). Baris dengan poin evaluasi yang sama ditulis berurutan.
- "referensi": 3-6 buku teks atau sumber resmi yang benar-benar ada. JANGAN mengarang
  judul, penulis, atau tahun; bila ragu, gunakan buku teks standar yang umum dipakai.
- Semua konten dalam Bahasa Indonesia (istilah teknis boleh bahasa Inggris).
- Konten harus spesifik untuk mata kuliah {mk_name}
{aturan_topik}
"""


def _format_capaian(capaian: List[Dict[str, Any]]) -> str:
    """Ubah data ketercapaian CPL/CPMK menjadi tabel teks untuk prompt."""
    if not capaian:
        return "(tidak ada data ketercapaian yang dikirim)"

    baris = []
    for item in capaian:
        kode = item.get("kode", "-")
        deskripsi = item.get("deskripsi", "")
        nilai = item.get("nilai_rata_rata")
        jumlah = item.get("jumlah_mahasiswa")
        tercapai = item.get("jumlah_tercapai")

        bagian = f"- {kode}"
        if deskripsi:
            bagian += f" ({deskripsi})"
        bagian += f": rata-rata {nilai}"
        if jumlah is not None and tercapai is not None:
            bagian += f", {tercapai} dari {jumlah} mahasiswa mencapai ambang"
        baris.append(bagian)

    return "\n".join(baris)


def build_narasi_prompt(
    mk_name: str,
    prodi: str,
    semester: str,
    tahun_ajaran: str,
    capaian: List[Dict[str, Any]],
    context_kurikulum: str,
    ambang: float = None,
) -> str:
    """
    Prompt untuk Laporan Evaluasi Kurikulum (C300 Tabel 25 nomor 2):
    narasi capaian pembelajaran dalam format standar borang akreditasi.
    """
    if ambang is None:
        ambang = settings.ambang_tercapai

    return f"""Kamu adalah asisten penyusun laporan evaluasi kurikulum program studi.

Tugasmu: menerjemahkan data kuantitatif ketercapaian CPL/CPMK menjadi narasi
evaluasi akademik yang siap dipakai pada borang akreditasi, beserta rekomendasi
intervensi yang konkret.

## Konteks Dokumen Kurikulum dan Format Borang
{context_kurikulum}

## Identitas Mata Kuliah
- Mata Kuliah    : {mk_name}
- Program Studi  : {prodi}
- Semester       : {semester}
- Tahun Ajaran   : {tahun_ajaran}
- Ambang tercapai: {ambang} (skala 0-100)

## Data Ketercapaian (HANYA gunakan angka di bawah ini)
{_format_capaian(capaian)}

## Instruksi Output
Kembalikan laporan dalam format JSON yang valid.
JANGAN tambahkan teks lain di luar JSON.
JANGAN gunakan markdown code block.
Langsung mulai dengan karakter {{ dan akhiri dengan }}.

Struktur JSON:
{{
  "ringkasan_capaian": "string (3-5 kalimat, gambaran umum ketercapaian)",
  "analisis_cpl": [
    {{
      "kode": "CPL X",
      "status": "Tercapai" atau "Belum Tercapai",
      "analisis": "string (2-3 kalimat menjelaskan angka dan implikasinya)"
    }}
  ],
  "faktor_penyebab": [
    "string (faktor yang diduga menyebabkan capaian rendah)"
  ],
  "rekomendasi_intervensi": [
    {{
      "sasaran": "CPL/CPMK yang disasar",
      "tindakan": "string (langkah konkret dan dapat dieksekusi dosen)",
      "prioritas": "Tinggi" atau "Sedang" atau "Rendah"
    }}
  ],
  "kesimpulan": "string (2-3 kalimat penutup)"
}}

ATURAN WAJIB:
- JANGAN mengarang angka. Gunakan hanya angka pada bagian Data Ketercapaian.
- Tandai status "Belum Tercapai" bila nilai rata-rata di bawah {ambang}.
- Buat satu entri "analisis_cpl" untuk SETIAP kode pada Data Ketercapaian.
- Rekomendasi harus spesifik untuk mata kuliah {mk_name}, bukan saran umum.
- Gunakan bahasa formal akademik dalam Bahasa Indonesia.
- Jika seluruh capaian sudah baik, tetap berikan rekomendasi penguatan.
"""
SYSTEM_EVALUASI_CPMK = (
    "Kamu adalah asisten dosen penyusun portofolio mata kuliah berbasis OBE. "
    "Kembalikan hanya JSON valid, mulai dengan { dan akhiri dengan }. "
    "Tidak ada teks lain, tidak ada markdown."
)


def _format_capaian_cpmk(
    cpmk: List[Dict[str, Any]], skala_maks: Any
) -> str:
    """Ubah statistik CPMK menjadi daftar teks untuk prompt."""
    baris = []
    for item in cpmk:
        bagian = f"- {item.get('kode', '-')}"
        if item.get("deskripsi"):
            bagian += f" ({item['deskripsi']})"
        bagian += f": rata-rata nilai {round(float(item.get('rata_rata', 0)), 2)}"
        if item.get("rerata_skala") is not None and skala_maks:
            bagian += f", rerata skala {round(float(item['rerata_skala']), 2)} dari {skala_maks}"
        bagian += (
            f", {item.get('jumlah_tercapai', 0)} dari {item.get('jumlah_mahasiswa', 0)} mahasiswa "
            f"({round(float(item.get('persen_tercapai', 0)), 1)}%) mencapai ambang"
        )
        bagian += ", status: " + ("MEMENUHI target" if item.get("memenuhi") else "BELUM MEMENUHI target")
        baris.append(bagian)
    return "\n".join(baris) if baris else "(tidak ada data CPMK)"


def build_evaluasi_cpmk_prompt(
    mk_name: str,
    prodi: str,
    semester: str,
    tahun_ajaran: str,
    ambang: float,
    target_persen: float,
    cpmk: List[Dict[str, Any]],
    context_kurikulum: str,
    target_rerata_skala: Any = None,
    skala_maks: Any = None,
) -> str:
    """
    Prompt untuk sheet Evaluasi portofolio mata kuliah: satu analisis pelaksanaan
    pembelajaran dan satu rencana perbaikan semester depan untuk setiap CPMK.
    """
    target_skala = ""
    if target_rerata_skala is not None and skala_maks:
        target_skala = f"\n- Target rerata skala: {target_rerata_skala} (skala 1-{skala_maks})"

    return f"""Tugasmu: menyusun kolom "Analisis Pelaksanaan Pembelajaran" dan
"Rencana Perbaikan Semester Depan" pada tabel Evaluasi Pemenuhan CPMK di
portofolio mata kuliah.

## Konteks Dokumen Kurikulum
{context_kurikulum}

## Identitas Mata Kuliah
- Mata Kuliah    : {mk_name}
- Program Studi  : {prodi}
- Semester       : {semester}
- Tahun Ajaran   : {tahun_ajaran}
- Ambang nilai CPMK: {ambang} (skala 0-100)
- Target mahasiswa mencapai ambang: {target_persen}%{target_skala}

## Data Ketercapaian CPMK (HANYA gunakan angka di bawah ini)
{_format_capaian_cpmk(cpmk, skala_maks)}

## Instruksi Output
Kembalikan JSON valid tanpa teks lain dan tanpa markdown, dengan struktur:
{{
  "evaluasi": [
    {{
      "kode": "kode CPMK persis seperti pada data",
      "analisis": "string (2-4 kalimat)",
      "rencana_perbaikan": "string (1-3 kalimat)"
    }}
  ]
}}

ATURAN WAJIB:
- Buat tepat satu entri untuk SETIAP kode CPMK pada data, dengan kode yang sama persis.
- "analisis": sebutkan persentase ketercapaian dari data, artinya bagi kemampuan
  mahasiswa sesuai deskripsi CPMK, dan dugaan penyebab bila belum memenuhi target.
- "rencana_perbaikan": tindakan konkret untuk semester berikutnya pada mata kuliah
  {mk_name}. Jika CPMK sudah memenuhi target, tulis upaya mempertahankan atau
  meningkatkan capaian.
- JANGAN mengarang angka di luar data.
- Bahasa Indonesia formal akademik, tanpa poin-poin atau penomoran.
"""
