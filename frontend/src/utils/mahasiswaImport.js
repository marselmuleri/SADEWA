// Impor data mahasiswa dari file ekspor SIAKAD (mis. export-YYYY-MM-DD_HH_MM_SS.xls).
//
// File ekspor SIAKAD berekstensi .xls tetapi isinya teks UTF-16 dipisah tab, dengan kolom:
//   Nim | Nama | Jenis kelamin | Agama | Prodi | Tahun masuk | Jalur masuk | Kode status terakhir
// Kolom yang dipakai SADEWA: Nim, Nama, Tahun masuk (angkatan), Jalur masuk (status masuk),
// Kode status terakhir (status akademik + semester). Jenis kelamin & Agama tidak disimpan.
// File yang sama yang disimpan ulang sebagai Excel (.xlsx), template Excel SADEWA, dan format CSV lama
// (nim, nama, semester_aktif, status_masuk) juga diterima.

import { downloadTemplate, readSpreadsheet } from './spreadsheet'

export const KOLOM_SIAKAD = ['Nim', 'Nama', 'Jenis kelamin', 'Agama', 'Prodi', 'Tahun masuk', 'Jalur masuk', 'Kode status terakhir']
const KOLOM_WAJIB_SIAKAD = ['nim', 'nama', 'tahun masuk', 'kode status terakhir']

const norm = (s) => String(s ?? '').trim()
const kunci = (s) => norm(s).toLowerCase().replace(/[_\s]+/g, ' ')

// "[2026-1] Aktif" -> { tahun: 2026, periode: 1, status: 'Aktif' }
export function bacaKodeStatus(kode) {
  const m = /^\s*\[(\d{4})-(\d)\]\s*(.*)$/.exec(norm(kode))
  if (!m) return { tahun: null, periode: null, teks: norm(kode) }
  return { tahun: Number(m[1]), periode: Number(m[2]), teks: norm(m[3]) }
}

// Status PDDikti/SIAKAD -> status akademik SADEWA (Aktif/Cuti/Non-Aktif/Lulus/Keluar)
export function petakanStatusAkademik(teks) {
  const t = kunci(teks)
  if (!t) return null
  if (t === 'aktif') return 'Aktif'
  if (t.includes('cuti')) return 'Cuti'
  if (t.includes('lulus')) return 'Lulus'
  if (t.includes('non aktif') || t.includes('non-aktif') || t.includes('tidak aktif') || t.includes('nonaktif')) return 'Non-Aktif'
  if (['undur', 'drop', 'dikeluarkan', 'keluar', 'meninggal', 'hilang', 'putus', 'mutasi', 'pindah'].some((k) => t.includes(k))) return 'Keluar'
  return null
}

// Jalur masuk: jalur seleksi mahasiswa baru (SNBP, SNBT, UM, SBUB, dst.) = Reguler;
// jalur pindahan/alih jenjang/RPL = Transfer.
export function petakanStatusMasuk(jalur) {
  const t = kunci(jalur)
  if (!t) return null
  if (t === 'reguler') return 'Reguler'
  if (['transfer', 'pindah', 'alih', 'rpl', 'lanjutan'].some((k) => t.includes(k))) return 'Transfer'
  return 'Reguler'
}

// Semester berjalan dari tahun masuk dan periode status terakhir: masuk 2023, [2026-1] -> semester 7.
export function hitungSemester(tahunMasuk, tahun, periode) {
  if (!tahunMasuk || !tahun || !periode) return null
  const s = (tahun - tahunMasuk) * 2 + periode
  return s >= 1 && s <= 14 ? s : null
}

// Nama prodi di file ("Teknik Komputer S1") vs akun ("S1 Teknik Komputer"): bandingkan tanpa jenjang.
export function prodiSama(a, b) {
  const bersih = (s) => kunci(s).replace(/\b(s1|s2|s3|d3|d4|program studi|prodi)\b/g, '').replace(/\s+/g, ' ').trim()
  return Boolean(a && b) && bersih(a) === bersih(b)
}

/**
 * Baca file impor (.xls SIAKAD, .xlsx, .csv). Hasil: { format: 'siakad' | 'csv', rows: [{ rowNumber, nim, nama, angkatan, semester_aktif,
 * status_masuk, status_akademik, prodi, jalur, statusAsli, errors[] }] }
 */
export async function bacaFileMahasiswa(buffer) {
  const { header, data } = await readSpreadsheet(buffer, { kolomKunci: ['nim'] })
  if (!header.length) throw new Error('File kosong atau tidak memiliki baris header.')
  const idx = Object.fromEntries(header.map((h, i) => [kunci(h), i]))
  const ambil = (r, nama) => (idx[nama] != null ? norm(r[idx[nama]]) : '')

  const siakad = KOLOM_WAJIB_SIAKAD.every((k) => k in idx)
  const csvLama = ['nim', 'nama', 'semester aktif', 'status masuk'].every((k) => k in idx)
  if (!siakad && !csvLama) {
    const ada = header.filter(Boolean).join(', ')
    throw new Error(`Kolom file tidak dikenali (${ada || 'tanpa header'}). Gunakan file ekspor SIAKAD dengan kolom: ${KOLOM_SIAKAD.join(', ')}.`)
  }

  const rows = data
    .filter((r) => r.some((c) => c !== ''))
    .map((r, i) => {
      const errors = []
      const nim = ambil(r, 'nim')
      const nama = ambil(r, 'nama')
      if (!nim) errors.push('NIM wajib diisi')
      else if (!/^[0-9A-Za-z.-]+$/.test(nim)) errors.push(`NIM tidak valid: "${nim}"`)
      if (!nama) errors.push('Nama wajib diisi')

      if (siakad) {
        const tahunMasukTeks = ambil(r, 'tahun masuk')
        const angkatan = /^\d{4}$/.test(tahunMasukTeks) ? Number(tahunMasukTeks) : null
        if (!angkatan) errors.push(`Tahun masuk tidak valid: "${tahunMasukTeks || 'kosong'}"`)
        const statusAsli = ambil(r, 'kode status terakhir')
        const kode = bacaKodeStatus(statusAsli)
        const statusAkademik = petakanStatusAkademik(kode.teks)
        if (!statusAkademik) errors.push(`Status tidak dikenali: "${statusAsli || 'kosong'}"`)
        const semester = hitungSemester(angkatan, kode.tahun, kode.periode)
        if (angkatan && !semester) errors.push(`Semester tidak dapat dihitung dari "${statusAsli || 'kosong'}" dan tahun masuk ${angkatan}`)
        const jalur = ambil(r, 'jalur masuk')
        return {
          rowNumber: i + 2, nim, nama, angkatan, semester_aktif: semester,
          status_masuk: petakanStatusMasuk(jalur) || 'Reguler', status_akademik: statusAkademik,
          prodi: ambil(r, 'prodi'), jalur, statusAsli, errors,
        }
      }

      const semTeks = ambil(r, 'semester aktif')
      const sem = Number(semTeks)
      if (!Number.isInteger(sem) || sem < 1 || sem > 14) errors.push(`Semester aktif harus angka bulat 1-14 (terbaca: "${semTeks || 'kosong'}")`)
      const masuk = kunci(ambil(r, 'status masuk'))
      const statusMasuk = masuk === 'reguler' ? 'Reguler' : masuk === 'transfer' ? 'Transfer' : null
      if (!statusMasuk) errors.push(`Status masuk harus Reguler atau Transfer (terbaca: "${ambil(r, 'status masuk') || 'kosong'}")`)
      return {
        rowNumber: i + 2, nim, nama, angkatan: null, semester_aktif: Number.isInteger(sem) ? sem : null,
        status_masuk: statusMasuk || 'Reguler', status_akademik: 'Aktif', prodi: '', jalur: '', statusAsli: '', errors,
      }
    })

  return { format: siakad ? 'siakad' : 'csv', rows }
}

// Template Excel berkolom sama dengan ekspor SIAKAD, sehingga file SIAKAD maupun template ini bisa diunggah.
export async function unduhTemplateSiakad(prodiNama = 'Teknik Komputer S1') {
  const contoh = [
    ['21120123120001', 'NAMA MAHASISWA SATU', 'PRIA', 'ISLAM', prodiNama, '2023', 'SNBP', '[2026-1] Aktif'],
    ['21120123120002', 'NAMA MAHASISWA DUA', 'WANITA', 'ISLAM', prodiNama, '2023', 'SNBT', '[2025-2] Cuti'],
    ['21120124120003', 'NAMA MAHASISWA TIGA', 'PRIA', 'PROTESTAN', prodiNama, '2024', 'UM S1', '[2026-1] Aktif'],
  ]
  await downloadTemplate(
    'template_impor_mahasiswa',
    [
      { header: 'Nim', key: 'nim', width: 18, required: true, text: true },
      { header: 'Nama', key: 'nama', width: 34, required: true },
      { header: 'Jenis kelamin', key: 'jk', width: 14, list: ['PRIA', 'WANITA'], note: 'Tidak disimpan di SADEWA.' },
      { header: 'Agama', key: 'agama', width: 14, note: 'Tidak disimpan di SADEWA.' },
      { header: 'Prodi', key: 'prodi', width: 26, note: 'Harus sama dengan program studi akun Anda.' },
      { header: 'Tahun masuk', key: 'tahun', width: 13, required: true, text: true, note: 'Tahun angkatan, 4 digit (mis. 2023).' },
      { header: 'Jalur masuk', key: 'jalur', width: 14, note: 'SNBP, SNBT, UM, dst. = Reguler; pindahan/alih jenjang/RPL = Transfer.' },
      { header: 'Kode status terakhir', key: 'status', width: 22, required: true, note: 'Format: [TAHUN-PERIODE] Status, mis. [2026-1] Aktif. Periode 1 = ganjil, 2 = genap.' },
    ],
    contoh,
    {
      sheetName: 'Mahasiswa',
      contoh: true,
      petunjuk: [
        'Cara tercepat: unggah langsung file ekspor data mahasiswa dari SIAKAD tanpa diubah. Template ini hanya untuk input manual.',
        'Isi satu mahasiswa per baris. Baris berwarna kuning adalah contoh; hapus atau timpa sebelum diunggah.',
        'Kolom Nim dan Tahun masuk berformat teks agar angka tidak berubah menjadi notasi ilmiah.',
        'Kode status terakhir ditulis seperti di SIAKAD, mis. "[2026-1] Aktif" atau "[2025-2] Cuti". Semester berjalan dihitung otomatis dari kolom ini dan Tahun masuk.',
        'Simpan sebagai Excel Workbook (.xlsx). Maksimal 500 baris dan 2 MB per file.',
      ],
    },
  )
}
