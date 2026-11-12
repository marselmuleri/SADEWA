// Impor data mahasiswa dari file ekspor SIAKAD (mis. export-YYYY-MM-DD_HH_MM_SS.xls).
//
// File ekspor SIAKAD berekstensi .xls tetapi isinya teks UTF-16 dipisah tab, dengan kolom:
//   Nim | Nama | Jenis kelamin | Agama | Prodi | Tahun masuk | Jalur masuk | Kode status terakhir
// Kolom yang dipakai SADEWA: Nim, Nama, Tahun masuk (angkatan), Jalur masuk (status masuk),
// Kode status terakhir (status akademik + semester). Jenis kelamin & Agama tidak disimpan.
// Format CSV lama (nim, nama, semester_aktif, status_masuk) tetap diterima.

export const KOLOM_SIAKAD = ['Nim', 'Nama', 'Jenis kelamin', 'Agama', 'Prodi', 'Tahun masuk', 'Jalur masuk', 'Kode status terakhir']
const KOLOM_WAJIB_SIAKAD = ['nim', 'nama', 'tahun masuk', 'kode status terakhir']

const norm = (s) => String(s ?? '').trim()
const kunci = (s) => norm(s).toLowerCase().replace(/[_\s]+/g, ' ')

// Byte awal file menentukan pengodean teks. File Excel asli (biner) tidak bisa dibaca di sini.
export function dekodeFile(buffer) {
  const b = new Uint8Array(buffer)
  if (b[0] === 0x50 && b[1] === 0x4b) {
    throw new Error('File ini berformat Excel .xlsx. Gunakan file ekspor asli dari SIAKAD (jangan dibuka lalu disimpan ulang di Excel), atau simpan sebagai "Text (Tab delimited)" / CSV.')
  }
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) {
    throw new Error('File ini berformat Excel 97-2003 (biner). Gunakan file ekspor asli dari SIAKAD (jangan disimpan ulang di Excel), atau simpan sebagai "Text (Tab delimited)" / CSV.')
  }
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2))
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2))
  // UTF-16 tanpa BOM: banyak byte nol di posisi ganjil
  if (b.length > 8 && b[1] === 0 && b[3] === 0) return new TextDecoder('utf-16le').decode(b)
  const teks = new TextDecoder('utf-8').decode(b)
  return teks.charCodeAt(0) === 0xfeff ? teks.slice(1) : teks
}

function pecahBaris(teks) {
  const baris = teks.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '')
  if (!baris.length) return { header: [], data: [] }
  const pertama = baris[0]
  const pemisah = pertama.includes('\t') ? '\t' : pertama.includes(';') && !pertama.includes(',') ? ';' : ','
  const sel = (l) => {
    if (pemisah === '\t') return l.split('\t').map(norm)
    // CSV sederhana dengan dukungan tanda kutip
    const out = []
    let cur = ''
    let kutip = false
    for (let i = 0; i < l.length; i++) {
      const c = l[i]
      if (kutip) {
        if (c === '"' && l[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') kutip = false
        else cur += c
      } else if (c === '"') kutip = true
      else if (c === pemisah) { out.push(norm(cur)); cur = '' } else cur += c
    }
    out.push(norm(cur))
    return out
  }
  return { header: sel(pertama), data: baris.slice(1).map(sel) }
}

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
 * Baca file impor. Hasil: { format: 'siakad' | 'csv', rows: [{ rowNumber, nim, nama, angkatan, semester_aktif,
 * status_masuk, status_akademik, prodi, jalur, statusAsli, errors[] }] }
 */
export function bacaFileMahasiswa(buffer) {
  const { header, data } = pecahBaris(dekodeFile(buffer))
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

// Template berformat sama dengan ekspor SIAKAD (UTF-16 LE + tab) agar langsung terbuka di Excel.
export function unduhTemplateSiakad(prodiNama = 'Teknik Komputer S1') {
  const contoh = [
    ['21120123120001', 'NAMA MAHASISWA SATU', 'PRIA', 'ISLAM', prodiNama, '2023', 'SNBP', '[2026-1] Aktif'],
    ['21120123120002', 'NAMA MAHASISWA DUA', 'WANITA', 'ISLAM', prodiNama, '2023', 'SNBT', '[2025-2] Cuti'],
    ['21120124120003', 'NAMA MAHASISWA TIGA', 'PRIA', 'PROTESTAN', prodiNama, '2024', 'UM S1', '[2026-1] Aktif'],
  ]
  const teks = [KOLOM_SIAKAD, ...contoh].map((r) => `${r.join('\t')}\t`).join('\r\n') + '\r\n'
  const isi = new Uint8Array(2 + teks.length * 2)
  isi[0] = 0xff
  isi[1] = 0xfe
  for (let i = 0; i < teks.length; i++) {
    const c = teks.charCodeAt(i)
    isi[2 + i * 2] = c & 0xff
    isi[3 + i * 2] = c >> 8
  }
  const url = URL.createObjectURL(new Blob([isi], { type: 'application/vnd.ms-excel' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'template_impor_mahasiswa_siakad.xls'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
