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
) -> str:
    """Prompt untuk pembangkitan draf RPS 16 pertemuan."""
    return f"""Kamu adalah sistem generator RPS (Rencana Pembelajaran Semester) resmi
untuk universitas berbasis OBE (Outcome-Based Education).

Tugasmu: generate RPS yang VALID, PRESISI, dan bebas halusinasi.
Kamu WAJIB mengikuti format dan standar dari dokumen kurikulum resmi berikut.
Jika konteks di bawah tidak memuat informasi yang kamu butuhkan, gunakan
struktur standar OBE nasional dan JANGAN mengarang nama dokumen, nomor
peraturan, atau kode yang tidak ada di konteks.

## Konteks Dokumen Kurikulum (GUNAKAN INI SEBAGAI REFERENSI FORMAT)
{context_kurikulum}

## Parameter Mata Kuliah yang Harus Digenerate
- Nama Mata Kuliah : {mk_name}
- Kode MK          : [generate kode yang sesuai format institusi]
- SKS              : {sks} SKS Teori
- Semester         : {semester}
- Program Studi    : {prodi}
- Deskripsi        : {deskripsi}

## Instruksi Output
Kembalikan RPS dalam format JSON yang valid.
JANGAN tambahkan teks lain di luar JSON.
JANGAN gunakan markdown code block.
Langsung mulai dengan karakter {{ dan akhiri dengan }}.

Struktur JSON:
{{
  "kode_mk": "string",
  "deskripsi_mk": "string (2-3 kalimat)",
  "cpl": [
    {{"kode": "CPL X", "deskripsi": "string"}}
  ],
  "cpmk": [
    {{"kode": "CPMK X-Y", "deskripsi": "string"}}
  ],
  "pertemuan": [
    {{
      "minggu": 1,
      "cpmk": "CPMK X-Y",
      "sub_cpmk": "Kemampuan akhir yang diharapkan",
      "materi": "Topik materi spesifik",
      "metode": "Ceramah dan Diskusi",
      "bobot": 5
    }}
  ]
}}

ATURAN WAJIB:
- Buat tepat {settings.jumlah_pertemuan} pertemuan (minggu 1-{settings.jumlah_pertemuan})
- Minggu {settings.minggu_uts} = UTS (cpmk: "-", materi: "UTS", bobot: 20)
- Minggu {settings.minggu_uas} = UAS (cpmk: "-", materi: "UAS", bobot: 30)
- Bobot total semua pertemuan HARUS = {settings.bobot_total}
- Setiap nilai "cpmk" pada pertemuan HARUS salah satu kode yang kamu daftarkan
  di array "cpmk", kecuali untuk UTS dan UAS yang memakai "-"
- Semua konten dalam Bahasa Indonesia
- Konten harus spesifik untuk mata kuliah {mk_name}
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
