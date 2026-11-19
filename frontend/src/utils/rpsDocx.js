// Kontrak Kuliah + RPS sebagai dokumen Word asli (.docx / Office Open XML).
// Struktur sama dengan pratinjau & cetak di rpsExport.js: halaman 1 Kontrak Kuliah, halaman 2 dst. RPS.
// Modul ini (beserta library docx) hanya dimuat saat tombol "Word" diklik.

import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import {
  UJIAN,
  angka,
  bobotUjian,
  normalisasiRps,
  semesterAkademik,
  tanpaAwalan,
  targetCpmkTeks,
  totalBobotPenilaian,
} from './rpsExport'

// Ukuran dalam twip (1 pt = 20 twip, 1 cm ≈ 567 twip). A4 landscape, margin 1.5 cm x 1.6 cm.
const MARGIN_V = 850
const MARGIN_H = 907
const LEBAR_HALAMAN = 16838 - 2 * MARGIN_H
const UKURAN = 20 // 10 pt (setengah-poin)
const UKURAN_KONTRAK = 22 // 11 pt

const garis = (tebal) => ({ style: BorderStyle.SINGLE, size: tebal ? 18 : 8, color: '000000' })
const tanpaGaris = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

// ---------- paragraf ----------
const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), size: o.size ?? UKURAN, bold: o.bold, break: o.break })

function para(isi, o = {}) {
  const children = (Array.isArray(isi) ? isi : [isi]).map((x) => (typeof x === 'string' ? run(x, o) : x))
  return new Paragraph({
    children,
    alignment: o.align,
    indent: o.hang ? { left: 240, hanging: 240 } : undefined,
    spacing: { before: o.before ?? 0, after: o.after ?? 0 },
  })
}

// Teks multi-baris ("Perte-\nmuan") menjadi satu paragraf dengan pemisah baris
const baris = (teks, o = {}) => para(String(teks).split('\n').map((t, i) => run(t, { ...o, break: i ? 1 : undefined })), o)

const bernomor = (items, o = {}) => items.map((t, i) => para(`${i + 1}.  ${t}`, { ...o, hang: true }))
const berbutir = (items, tanda, o = {}) => items.map((t) => para(`${tanda}  ${t}`, { ...o, hang: true }))

// ---------- tabel ----------
function sel(isi, o = {}) {
  const children = (Array.isArray(isi) ? isi : [isi]).flat().filter(Boolean)
  return new TableCell({
    children: children.length ? children.map((c) => (typeof c === 'string' ? para(c, o) : c)) : [para('')],
    columnSpan: o.colspan,
    rowSpan: o.rowspan,
    verticalAlign: o.valign ?? VerticalAlign.TOP,
  })
}

function tabel(lebarPersen, rows, o = {}) {
  const kolom = lebarPersen.map((p) => Math.round((LEBAR_HALAMAN * p) / 100))
  const tepi = o.tanpaGaris
    ? { top: tanpaGaris, bottom: tanpaGaris, left: tanpaGaris, right: tanpaGaris, insideHorizontal: tanpaGaris, insideVertical: tanpaGaris }
    : {
        top: garis(o.atasTebal),
        bottom: garis(o.bawahTebal),
        left: garis(o.sisiTebal),
        right: garis(o.sisiTebal),
        insideHorizontal: garis(false),
        insideVertical: garis(false),
      }
  return new Table({
    rows,
    columnWidths: kolom,
    width: { size: LEBAR_HALAMAN, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: tepi,
    margins: o.tanpaGaris ? { top: 0, bottom: 0, left: 0, right: 80 } : { top: 40, bottom: 40, left: 80, right: 80 },
  })
}

const tr = (cells, o = {}) => new TableRow({ children: cells, tableHeader: o.header, cantSplit: o.cantSplit ?? true })

// ---------- halaman 1: Kontrak Kuliah ----------
function kontrak(rps, idt, meta) {
  const o = { size: UKURAN_KONTRAK }
  const fakultas = tanpaAwalan(idt.fakultas, 'Fakultas')
  const kode = idt.kode || rps.kode_mk
  const dosen = idt.dosen?.length ? idt.dosen : ['-']

  const identitas = tabel(
    [14, 1.5, 84.5],
    [
      ['Fakultas / Prodi', `${fakultas} / ${idt.program_studi || ''}`],
      ['Tahun Akademik', `Semester ${semesterAkademik(meta.semester)} ${meta.tahun_ajaran || ''}`],
      ['Mata Kuliah', `${kode}- ${idt.nama || ''} (${idt.sks ?? ''} sks)`],
      ['Dosen', dosen.map((n, i) => para(`${i + 1}. ${n}`, o))],
    ].map(([lbl, isi]) => tr([sel(lbl, o), sel(':', o), sel(isi, o)])),
    { tanpaGaris: true },
  )

  // Baris berurutan dengan poin evaluasi sama digabung (rowspan)
  const grup = []
  rps.penilaian.forEach((p) => {
    const akhir = grup[grup.length - 1]
    if (akhir && akhir.poin === p.poin) akhir.items.push(p)
    else grup.push({ poin: p.poin, items: [p] })
  })
  const tengah = { ...o, align: AlignmentType.CENTER }
  const isiPenilaian = grup.flatMap((g, gi) =>
    g.items.map((p, i) => {
      const komponen = p.rincian.length ? [para(`${p.komponen}:`, o), ...bernomor(p.rincian, o)] : para(p.komponen, o)
      const awal =
        i === 0
          ? [
              sel(`${gi + 1}.`, { ...tengah, rowspan: g.items.length, valign: VerticalAlign.CENTER }),
              sel(g.poin, { ...o, rowspan: g.items.length, valign: VerticalAlign.CENTER }),
            ]
          : []
      return tr([
        ...awal,
        sel(komponen, { ...o, valign: VerticalAlign.CENTER }),
        sel(angka(p.bobot), { ...tengah, valign: VerticalAlign.CENTER }),
        sel(p.cpmk.join(', '), { ...tengah, valign: VerticalAlign.CENTER }),
      ])
    }),
  )
  const kepala = (t) => sel(t, { ...tengah, bold: true, valign: VerticalAlign.CENTER })
  const penilaian = tabel([5, 20, 38, 11, 26], [
    tr(['No.', 'Poin Evaluasi', 'Komponen Evaluasi', 'Bobot (%)', 'Komponen CPMK yang Dinilai'].map(kepala), { header: true }),
    ...isiPenilaian,
    tr([sel('Jumlah', { ...tengah, colspan: 3 }), sel(angka(totalBobotPenilaian(rps)), tengah), sel('', o)]),
  ])

  return [
    para('KONTRAK KULIAH', { bold: true, size: 24, align: AlignmentType.CENTER, before: 120, after: 280 }),
    identitas,
    para('Tabel Penilaian Mata Kuliah', { bold: true, size: 22, before: 280, after: 120 }),
    penilaian,
  ]
}

// ---------- halaman 2: RPS ----------
function gambarLogo(logoDataUri) {
  const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/i.exec(logoDataUri || '')
  if (!m) return null
  const biner = atob(m[2])
  const data = new Uint8Array(biner.length)
  for (let i = 0; i < biner.length; i++) data[i] = biner.charCodeAt(i)
  const type = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
  return new ImageRun({ type, data, transformation: { width: 62, height: 62 } })
}

function rpsHalaman(rps, idt, logoDataUri) {
  const fakultas = tanpaAwalan(idt.fakultas, 'Fakultas').toUpperCase()
  const prodi = tanpaAwalan(idt.program_studi, '(S1|S2|S3|D3|D4)').toUpperCase()
  const kode = idt.kode || rps.kode_mk
  const dosen = idt.dosen?.length ? idt.dosen : ['-']
  const tengah = { align: AlignmentType.CENTER }
  const tebal = { bold: true }
  const rata = { align: AlignmentType.JUSTIFIED }

  const logo = gambarLogo(logoDataUri)
  const kop = tabel(
    [13, 41, 46],
    [
      tr([
        sel(logo ? new Paragraph({ children: [logo], alignment: AlignmentType.CENTER }) : '', { rowspan: 2, valign: VerticalAlign.CENTER }),
        sel('RENCANA PEMBELAJARAN SEMESTER', { ...tengah, ...tebal, colspan: 2, size: 24, valign: VerticalAlign.CENTER }),
      ]),
      tr([sel(`Program Studi: ${prodi}`, tebal), sel(`Fakultas: ${fakultas}`, tebal)]),
    ],
    { sisiTebal: true, atasTebal: true },
  )

  const label = (t, n) => sel(t, { ...tebal, rowspan: n > 1 ? n : undefined })
  const barisDaftar = (judul, items, render) =>
    items.length
      ? items.map((it, i) => tr([...(i === 0 ? [label(judul, items.length)] : []), sel(render(it), { colspan: 4 })]))
      : [tr([label(judul, 1), sel('-', { colspan: 4 })])]

  const identitas = tabel(
    [22.5, 12, 13, 8, 44.5],
    [
      tr([
        label('Mata Kuliah:'),
        sel(idt.nama || ''),
        sel([para('Kode:', tebal), para(kode)]),
        sel([para('SKS:', tebal), para(String(idt.sks ?? ''))]),
        sel([para('Sem:', tebal), para(rps.semester_kurikulum)]),
      ]),
      tr([label('Dosen Pengampu:'), sel(bernomor(dosen), { colspan: 4 })]),
      ...barisDaftar('Capaian Pembelajaran Lulusan', rps.cpl, (c) =>
        para([run(`${c.kode} : ${c.deskripsi}`), ...(c.label ? [run(` (${c.label})`, tebal)] : [])], rata),
      ),
      ...barisDaftar('Capaian Pembelajaran Mata Kuliah:', rps.cpmk, (c) => para(`${c.kode} : ${c.deskripsi}`, rata)),
      tr([label('Deskripsi Singkat Mata Kuliah:'), sel(para(rps.deskripsi_mk, rata), { colspan: 4 })]),
    ],
    { sisiTebal: true },
  )

  const kepala = (t, o = {}) => sel(baris(t, { ...tengah, ...tebal }), { valign: VerticalAlign.CENTER, ...o })
  const mingguan = rps.pertemuan.map((p) => {
    if (p.jenis !== 'kuliah') {
      return tr([
        sel(String(p.minggu), tengah),
        sel(UJIAN[p.jenis], { ...tengah, ...tebal, colspan: 7 }),
        sel(angka(bobotUjian(rps, p.jenis, p.bobot)), tengah),
      ])
    }
    const bahan = p.bahan_kajian_judul ? para([run(`${p.bahan_kajian_judul}: `, tebal), run(p.bahan_kajian)]) : para(p.bahan_kajian)
    const kriteria = p.kriteria_indikator.length > 1 ? berbutir(p.kriteria_indikator, '-') : para(p.kriteria_indikator[0] || '')
    return tr([
      sel(String(p.minggu), tengah),
      sel(p.kemampuan_akhir),
      sel(bahan),
      sel(p.metode),
      sel(p.waktu, tengah),
      sel(berbutir(p.pengalaman_belajar, '•')),
      sel(targetCpmkTeks(p.target_cpmk)),
      sel(kriteria),
      sel(angka(p.bobot), tengah),
    ])
  })

  const tabelMingguan = tabel(
    [5.5, 15, 15.5, 8, 6.5, 16, 8.5, 19.5, 5.5],
    [
      // Tiga baris judul diulang otomatis di setiap halaman
      tr([...['1', '2', '3', '4', '5', '6', '7'].map((n) => kepala(n)), kepala('8', { colspan: 2 })], { header: true }),
      tr(
        [
          kepala('Perte-\nmuan', { rowspan: 2 }),
          kepala('Kemampuan Akhir Tiap Tahapan Pembelajaran', { rowspan: 2 }),
          kepala('Bahan Kajian/ Pokok Bahasan', { rowspan: 2 }),
          kepala('Metode Pembela-\njaran', { rowspan: 2 }),
          kepala('Waktu (menit)', { rowspan: 2 }),
          kepala('Pengalaman Belajar Mahasiswa', { rowspan: 2 }),
          kepala('Target CPMK', { rowspan: 2 }),
          kepala('Penilaian', { colspan: 2 }),
        ],
        { header: true },
      ),
      tr([kepala('Kriteria & Indikator'), kepala('Bobot (%)')], { header: true }),
      ...mingguan,
    ],
    { sisiTebal: true, atasTebal: true },
  )

  const referensi = tabel(
    [22.5, 77.5],
    [tr([label('Daftar Referensi:'), sel(rps.referensi.length ? bernomor(rps.referensi) : '-')])],
    { sisiTebal: true, bawahTebal: true },
  )

  return [kop, identitas, tabelMingguan, referensi]
}

/** Hasilkan Blob .docx untuk satu RPS. */
export async function buatRpsDocx(rpsRecord, identitas, logoDataUri = null) {
  const rps = normalisasiRps(rpsRecord.konten)
  const idt = identitas || {}
  const meta = { semester: rpsRecord.semester, tahun_ajaran: rpsRecord.tahun_ajaran }
  const halaman = {
    page: {
      size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
      margin: { top: MARGIN_V, bottom: MARGIN_V, left: MARGIN_H, right: MARGIN_H },
    },
  }

  const doc = new Document({
    creator: 'SADEWA',
    title: `RPS ${idt.kode || rps.kode_mk} ${idt.nama || ''}`.trim(),
    description: 'Kontrak Kuliah dan Rencana Pembelajaran Semester',
    styles: {
      default: { document: { run: { font: 'Times New Roman', size: UKURAN } } },
    },
    sections: [
      { properties: halaman, children: kontrak(rps, idt, meta) },
      // Bagian baru = halaman baru untuk RPS
      { properties: halaman, children: rpsHalaman(rps, idt, logoDataUri) },
    ],
  })
  return Packer.toBlob(doc)
}
