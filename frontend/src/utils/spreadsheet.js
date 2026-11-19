// Utilitas spreadsheet SADEWA: ekspor, template, dan pembacaan file impor.
//
// - Ekspor & template ditulis sebagai Excel (.xlsx) dengan header bergaya, lebar kolom pas,
//   baris judul dibekukan, filter, dan (untuk template) dropdown/validasi + lembar Petunjuk.
// - Pembacaan impor menerima .xlsx, serta teks .csv/.tsv/.txt dan ekspor SIAKAD (.xls berisi teks UTF-16).
// Library exceljs dimuat hanya saat dibutuhkan agar tidak menambah ukuran halaman awal.

const muatExcelJS = () => import('exceljs').then((m) => m.default || m)

const WARNA = {
  header: 'FF1A3A6B',
  headerTeks: 'FFFFFFFF',
  wajib: 'FFF4A300',
  judul: 'FF142B4A',
  redup: 'FF64748B',
  garis: 'FFE2E8F0',
  zebra: 'FFF8FAFC',
  contoh: 'FFFFFBEB',
}

const GARIS_TIPIS = { style: 'thin', color: { argb: WARNA.garis } }
const BINGKAI = { top: GARIS_TIPIS, left: GARIS_TIPIS, bottom: GARIS_TIPIS, right: GARIS_TIPIS }

export const IMPOR_ACCEPT = '.xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'

function namaFileAman(nama, ekstensi = 'xlsx') {
  const dasar = String(nama || 'SADEWA')
    .replace(/\.(csv|xlsx|xls)$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
  return `${dasar}.${ekstensi}`
}

function unduhBlob(blob, namaFile) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namaFile
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function simpanWorkbook(wb, namaFile) {
  const buffer = await wb.xlsx.writeBuffer()
  unduhBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    namaFileAman(namaFile),
  )
}

function tanggalSekarang() {
  return new Date().toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Angka disimpan sebagai angka agar bisa dihitung di Excel; kode panjang (NIM, NIP) tetap teks.
function nilaiSel(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number' || typeof v === 'boolean') return v
  if (v instanceof Date) return v
  const s = String(v)
  if (/^-?(0|[1-9]\d{0,7})(\.\d+)?$/.test(s.trim())) return Number(s.trim())
  return s
}

function gayaHeader(row, wajibKeys = new Set(), keys = []) {
  row.height = 22
  row.eachCell((cell, col) => {
    cell.font = { bold: true, color: { argb: WARNA.headerTeks } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: wajibKeys.has(keys[col - 1]) ? 'FF0F2A52' : WARNA.header } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = BINGKAI
  })
}

function lebarKolom(label, nilai) {
  const terpanjang = nilai.reduce((m, v) => Math.max(m, String(v ?? '').length), String(label ?? '').length)
  return Math.min(Math.max(terpanjang + 2, 10), 60)
}

/**
 * Ekspor data ke Excel (.xlsx).
 * headers: [{ label, key }] ; rows: [{ [key]: value }]
 * opsi: { title, subtitle, sheetName }
 */
export async function exportToExcel(filename, headers, rows, opsi = {}) {
  if (!rows || rows.length === 0) {
    alert('Tidak ada data untuk diekspor')
    return
  }
  try {
    const ExcelJS = await muatExcelJS()
    const wb = new ExcelJS.Workbook()
    wb.creator = 'SADEWA'
    wb.created = new Date()
    const judul = opsi.title || String(filename).replace(/\.(csv|xlsx)$/i, '').replace(/_/g, ' ')
    const ws = wb.addWorksheet((opsi.sheetName || 'Data').slice(0, 31))

    // Kop: judul, keterangan, baris kosong, lalu tabel
    ws.addRow([judul]).font = { bold: true, size: 14, color: { argb: WARNA.judul } }
    ws.addRow([opsi.subtitle || `Diekspor dari SADEWA · ${tanggalSekarang()}`]).font = { italic: true, size: 9, color: { argb: WARNA.redup } }
    ws.addRow([])
    const barisHeader = ws.rowCount + 1

    const header = ws.addRow(headers.map((h) => h.label))
    gayaHeader(header)

    rows.forEach((r, i) => {
      const row = ws.addRow(headers.map((h) => nilaiSel(r[h.key])))
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = BINGKAI
        cell.alignment = { vertical: 'top', wrapText: true }
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNA.zebra } }
      })
    })

    headers.forEach((h, i) => {
      ws.getColumn(i + 1).width = lebarKolom(h.label, rows.map((r) => r[h.key]))
    })
    ws.views = [{ state: 'frozen', ySplit: barisHeader }]
    ws.autoFilter = { from: { row: barisHeader, column: 1 }, to: { row: barisHeader, column: headers.length } }

    await simpanWorkbook(wb, filename)
  } catch (err) {
    console.error('Gagal mengekspor Excel:', err)
    alert('Terjadi kesalahan saat mengekspor file Excel. Silakan coba lagi.')
  }
}

/**
 * Unduh template impor (.xlsx).
 * columns: [{ header, key, width?, required?, text?, list?: string[], min?, max?, note? }]
 *   - text: kolom diformat teks (NIM agar tidak berubah jadi notasi ilmiah)
 *   - list: dropdown pilihan; min/max: validasi angka desimal
 * rows: baris awal (contoh atau data yang sudah diisi sistem)
 * opsi: { sheetName, petunjuk: string[], contoh: boolean (warnai baris sebagai contoh), barisKosong }
 */
export async function downloadTemplate(filename, columns, rows = [], opsi = {}) {
  const ExcelJS = await muatExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SADEWA'
  wb.created = new Date()
  const ws = wb.addWorksheet((opsi.sheetName || 'Data').slice(0, 31))
  const keys = columns.map((c) => c.key)
  const wajib = new Set(columns.filter((c) => c.required).map((c) => c.key))

  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || lebarKolom(c.header, rows.map((r) => (Array.isArray(r) ? '' : r[c.key]))),
    style: c.text ? { numFmt: '@' } : undefined,
  }))
  gayaHeader(ws.getRow(1), wajib, keys)
  columns.forEach((c, i) => {
    if (c.note) ws.getRow(1).getCell(i + 1).note = c.note
  })

  rows.forEach((r) => {
    const nilai = Array.isArray(r) ? r : keys.map((k) => r[k] ?? '')
    const row = ws.addRow(nilai.map((v, i) => (columns[i]?.text ? String(v ?? '') : nilaiSel(v))))
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = BINGKAI
      if (opsi.contoh) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNA.contoh } }
    })
  })

  // Validasi data untuk baris isian (baris contoh + baris kosong tambahan)
  const akhir = Math.max(ws.rowCount, 1) + (opsi.barisKosong ?? 500)
  columns.forEach((c, i) => {
    if (!c.list && c.min === undefined && c.max === undefined) return
    const huruf = ws.getColumn(i + 1).letter
    for (let r = 2; r <= akhir; r++) {
      const cell = ws.getCell(`${huruf}${r}`)
      if (c.list) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: !c.required,
          formulae: [`"${c.list.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Pilihan tidak valid',
          error: `Pilih salah satu: ${c.list.join(', ')}`,
        }
      } else {
        cell.dataValidation = {
          type: 'decimal',
          operator: 'between',
          allowBlank: true,
          formulae: [c.min ?? 0, c.max ?? 100],
          showErrorMessage: true,
          errorTitle: 'Nilai tidak valid',
          error: `Isi angka antara ${c.min ?? 0} dan ${c.max ?? 100}`,
        }
      }
      if (c.text) cell.numFmt = '@'
    }
  })

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  if (opsi.petunjuk?.length) {
    const p = wb.addWorksheet('Petunjuk')
    p.getColumn(1).width = 110
    p.addRow(['Petunjuk Pengisian']).font = { bold: true, size: 14, color: { argb: WARNA.judul } }
    p.addRow([])
    opsi.petunjuk.forEach((t, i) => {
      const row = p.addRow([`${i + 1}. ${t}`])
      row.alignment = { wrapText: true, vertical: 'top' }
    })
    p.addRow([])
    const kolom = p.addRow(['Keterangan kolom:'])
    kolom.font = { bold: true }
    columns.forEach((c) => {
      const ket = [c.required ? 'wajib' : 'opsional', c.list ? `pilihan: ${c.list.join(' / ')}` : null, c.note || null]
        .filter(Boolean)
        .join(' · ')
      p.addRow([`• ${c.header} — ${ket}`]).alignment = { wrapText: true }
    })
  }

  await simpanWorkbook(wb, filename)
}

// ---------------------------------------------------------------------------
// Pembacaan file impor
// ---------------------------------------------------------------------------

function teksSel(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? v.toFixed(0) : String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('')
    if ('result' in v) return teksSel(v.result)
    if ('text' in v) return teksSel(v.text)
    if ('error' in v) return ''
  }
  return String(v)
}

// Byte awal file menentukan pengodean teks (UTF-16 dari ekspor SIAKAD, atau UTF-8).
function dekodeTeks(b) {
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2))
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2))
  if (b.length > 8 && b[1] === 0 && b[3] === 0) return new TextDecoder('utf-16le').decode(b)
  const teks = new TextDecoder('utf-8').decode(b)
  return teks.charCodeAt(0) === 0xfeff ? teks.slice(1) : teks
}

// Parser teks berpemisah (tab / titik-koma / koma) dengan dukungan tanda kutip ala RFC-4180.
function parseTeks(teks) {
  const barisPertama = teks.split(/\r\n|\n|\r/)[0] || ''
  const pemisah = barisPertama.includes('\t')
    ? '\t'
    : barisPertama.includes(';') && !barisPertama.includes(',')
      ? ';'
      : ','
  const hasil = []
  let baris = []
  let sel = ''
  let kutip = false
  const tutupBaris = () => {
    baris.push(sel)
    hasil.push(baris)
    baris = []
    sel = ''
  }
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i]
    if (kutip) {
      if (c === '"' && teks[i + 1] === '"') { sel += '"'; i++ } else if (c === '"') kutip = false
      else sel += c
    } else if (c === '"' && sel === '') kutip = true
    else if (c === pemisah) { baris.push(sel); sel = '' } else if (c === '\r') {
      if (teks[i + 1] === '\n') i++
      tutupBaris()
    } else if (c === '\n') tutupBaris()
    else sel += c
  }
  if (sel !== '' || baris.length) tutupBaris()
  return hasil
}

async function bacaXlsx(buffer) {
  const ExcelJS = await muatExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets.find((w) => !/^petunjuk$/i.test(w.name) && w.rowCount > 0) || wb.worksheets[0]
  if (!ws) return []
  const hasil = []
  ws.eachRow({ includeEmpty: true }, (row) => {
    const sel = []
    for (let c = 1; c <= ws.columnCount; c++) sel.push(teksSel(row.getCell(c).value))
    hasil.push(sel)
  })
  return hasil
}

/**
 * Baca file spreadsheet menjadi { header: string[], data: string[][] }.
 * opsi.kolomKunci: nama kolom (huruf kecil) penanda baris header; baris di atasnya (judul/kop) dilewati.
 */
export async function readSpreadsheet(buffer, opsi = {}) {
  const b = new Uint8Array(buffer)
  let baris
  if (b[0] === 0x50 && b[1] === 0x4b) {
    baris = await bacaXlsx(buffer)
  } else if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) {
    throw new Error('File berformat Excel 97-2003 (.xls biner) belum didukung. Di Excel, pilih File > Save As > "Excel Workbook (.xlsx)", lalu unggah ulang.')
  } else {
    baris = parseTeks(dekodeTeks(b))
  }

  baris = baris.map((r) => r.map((v) => String(v ?? '').trim()))
  const kunci = (opsi.kolomKunci || []).map((k) => k.toLowerCase())
  let idxHeader = baris.findIndex((r) => r.some((v) => v !== ''))
  if (kunci.length) {
    const cocok = baris.slice(0, 15).findIndex((r) => r.some((v) => kunci.includes(normalisasiKolom(v))))
    if (cocok >= 0) idxHeader = cocok
  }
  if (idxHeader < 0) return { header: [], data: [] }

  return {
    header: baris[idxHeader],
    data: baris.slice(idxHeader + 1).filter((r) => r.some((v) => v !== '')),
  }
}

// "Semester Aktif", "semester_aktif", "SEMESTER-AKTIF" -> "semester aktif"
export function normalisasiKolom(s) {
  return String(s ?? '').trim().toLowerCase().replace(/[_\-\s]+/g, ' ').replace(/\s*\*$/, '').trim()
}
