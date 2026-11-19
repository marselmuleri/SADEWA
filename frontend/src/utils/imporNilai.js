// Impor nilai mahasiswa dari Excel (.xlsx) / CSV untuk satu mata kuliah.
//
// Format file: satu baris per peserta, kolom NIM, Nama Mahasiswa, Kelas, lalu satu kolom per
// komponen penilaian (judul "<Nama bentuk> (<bobot>%)", sama seperti template). Satu nilai per
// komponen; backend menerapkannya ke semua IK pada matriks komponen itu.
// Sel kosong = nilai tidak diubah.

import { downloadTemplate, normalisasiKolom, readSpreadsheet } from './spreadsheet'

export const nimPeserta = (p) => String(p.mahasiswa?.nim || p.nim || '').trim()
export const namaPeserta = (p) => p.mahasiswa?.nama || p.nama || ''

// Judul kolom komponen; nama bentuk yang sama dibedakan dengan nomor urut.
export function judulKomponen(componentsList, bentukMap) {
  const dasar = componentsList.map((c) => `${bentukMap.get(Number(c.bentuk_penilaian_id))?.nama || 'Komponen'} (${Number(c.bobot)}%)`)
  return dasar.map((j, i) => (dasar.filter((x) => x === j).length > 1 ? `${j} #${dasar.slice(0, i + 1).filter((x) => x === j).length}` : j))
}

const urutPeserta = (pesertaList) =>
  [...pesertaList].sort(
    (a, b) => String(a.kelas || '').localeCompare(String(b.kelas || '')) || nimPeserta(a).localeCompare(nimPeserta(b)),
  )

export async function unduhTemplateNilai({ course, componentsList, bentukMap, pesertaList, scoresByPesertaAndComp }) {
  const judul = judulKomponen(componentsList, bentukMap)
  const kolomNilai = componentsList.map((c, i) => ({
    header: judul[i],
    key: `k_${c.id}`,
    width: Math.max(14, judul[i].length + 4),
    min: 0,
    max: 100,
    note: 'Nilai 0 - 100. Kosongkan bila belum ada nilai atau tidak ingin diubah.',
  }))
  const rows = urutPeserta(pesertaList).map((p) => {
    const row = { nim: nimPeserta(p), nama: namaPeserta(p), kelas: p.kelas || '' }
    componentsList.forEach((c) => {
      const s = scoresByPesertaAndComp.get(`${p.id}_${c.id}`)
      // Nilai per IK yang berbeda-beda tidak diringkas ke satu angka: sel dikosongkan agar tidak tertimpa
      row[`k_${c.id}`] = s && s.seragam ? s.nilai : ''
    })
    return row
  })
  await downloadTemplate(
    `nilai_${course.kode}_${course.semester || ''}`,
    [
      { header: 'NIM', key: 'nim', width: 18, required: true, text: true, note: 'Jangan diubah. Dipakai untuk mencocokkan peserta.' },
      { header: 'Nama Mahasiswa', key: 'nama', width: 34 },
      { header: 'Kelas', key: 'kelas', width: 8 },
      ...kolomNilai,
    ],
    rows,
    {
      sheetName: 'Nilai',
      barisKosong: 0,
      petunjuk: [
        `Template ini berisi semua peserta ${course.kode} ${course.nama}. Nilai yang sudah tersimpan di SADEWA ikut tercantum.`,
        'Isi nilai angka 0 - 100 pada kolom komponen penilaian. Excel menolak nilai di luar rentang tersebut. Desimal boleh memakai koma atau titik.',
        'Sel kosong berarti nilai tidak diubah. Untuk menghapus nilai, gunakan tombol hapus di aplikasi.',
        'Jangan mengubah kolom NIM dan judul kolom. Kolom Nama dan Kelas hanya sebagai informasi. Urutan baris boleh diubah.',
        'Satu nilai per komponen berlaku untuk semua Indikator Kinerja (IK) yang dinilai komponen itu. Bila sebelumnya nilai per IK berbeda-beda, selnya dikosongkan agar tidak tertimpa.',
        'Simpan sebagai Excel Workbook (.xlsx), lalu unggah lewat tombol "Impor Nilai Excel". Anda akan melihat pratinjau sebelum nilai disimpan.',
        'Setelah impor, klik "Hitung Evaluasi Capaian" agar capaian CPMK dan CPL diperbarui.',
      ],
    },
  )
}

/**
 * Baca file nilai. Hasil: { kolomHilang: string[], baris: [{ nomor, nim, nama, peserta, nilai: {compId: {teks, angka, status}}, galat: [], status }] }
 * status sel: 'baru' | 'ubah' | 'tetap' | 'kosong' | 'galat'
 * status baris: 'galat' (dilewati) | 'siap' (ada perubahan) | 'tetap' (tidak ada perubahan)
 */
export async function bacaFileNilai(buffer, { componentsList, bentukMap, pesertaList, scoresByPesertaAndComp }) {
  const { header, data } = await readSpreadsheet(buffer, { kolomKunci: ['nim'] })
  const idx = new Map(header.map((h, i) => [normalisasiKolom(h), i]))
  if (!idx.has('nim')) {
    throw new Error('Kolom "NIM" tidak ditemukan. Gunakan template dari tombol "Unduh Template Excel".')
  }
  const iNim = idx.get('nim')
  const iNama = idx.get('nama mahasiswa') ?? idx.get('nama')

  // Kolom komponen dicocokkan dengan judulnya; bila judul diubah, cadangannya posisi kolom template.
  const judul = judulKomponen(componentsList, bentukMap)
  const posisiTemplate = header.length === 3 + componentsList.length
  const kolomHilang = []
  const iKomp = componentsList.map((c, i) => {
    const cocok = idx.get(normalisasiKolom(judul[i]))
    if (cocok !== undefined) return cocok
    if (posisiTemplate) return 3 + i
    kolomHilang.push(judul[i])
    return null
  })

  const pesertaByNim = new Map(pesertaList.map((p) => [nimPeserta(p), p]))
  const nimDilihat = new Set()

  const baris = data.map((r, n) => {
    const nim = String(r[iNim] ?? '').trim()
    const peserta = pesertaByNim.get(nim)
    const galat = []
    if (!nim) galat.push('NIM kosong')
    else if (nimDilihat.has(nim)) galat.push('NIM ganda di file')
    else if (!peserta) galat.push('NIM bukan peserta mata kuliah ini')
    nimDilihat.add(nim)

    const nilai = {}
    componentsList.forEach((c, i) => {
      const teks = iKomp[i] === null ? '' : String(r[iKomp[i]] ?? '').trim()
      if (teks === '') {
        nilai[c.id] = { teks, angka: null, status: 'kosong' }
        return
      }
      const angka = Number(teks.replace(',', '.'))
      if (!Number.isFinite(angka) || angka < 0 || angka > 100) {
        galat.push(`${judul[i]}: "${teks}" bukan angka 0 - 100`)
        nilai[c.id] = { teks, angka: null, status: 'galat' }
        return
      }
      const bulat = Math.round(angka * 100) / 100
      const lama = peserta ? scoresByPesertaAndComp.get(`${peserta.id}_${c.id}`) : null
      const status = !lama ? 'baru' : lama.seragam && Number(lama.nilai) === bulat ? 'tetap' : 'ubah'
      nilai[c.id] = { teks, angka: bulat, status }
    })

    const adaUbah = Object.values(nilai).some((v) => v.status === 'baru' || v.status === 'ubah')
    return {
      nomor: n + 2,
      nim,
      nama: peserta ? namaPeserta(peserta) : String(r[iNama] ?? ''),
      peserta,
      nilai,
      galat,
      status: galat.length ? 'galat' : adaUbah ? 'siap' : 'tetap',
    }
  })

  return { kolomHilang, baris }
}

// Rekaman untuk POST /nilai/manual: hanya sel baru/berubah dari baris tanpa galat.
export function rekamanImpor(baris) {
  return baris
    .filter((b) => b.status === 'siap')
    .flatMap((b) =>
      Object.entries(b.nilai)
        .filter(([, v]) => v.status === 'baru' || v.status === 'ubah')
        .map(([compId, v]) => ({ peserta_mata_kuliah_id: b.peserta.id, mk_bentuk_penilaian_id: Number(compId), nilai: v.angka })),
    )
}
