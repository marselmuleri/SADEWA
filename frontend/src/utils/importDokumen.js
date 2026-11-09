// Membaca isi teks file laporan yang diunggah dosen (.docx atau .txt) di browser,
// tanpa library tambahan. File .docx adalah arsip ZIP; teksnya ada di word/document.xml.

export const IMPORT_ACCEPT = '.docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Browser ini belum mendukung pembacaan file Word. Gunakan Chrome, Edge, atau Firefox versi terbaru.')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// Ambil satu file dari arsip ZIP berdasarkan nama, lewat central directory.
export async function readZipEntry(buffer, entryName) {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // End of central directory: cari dari belakang (komentar ZIP maks. 65535 byte).
  let eocd = -1
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('File bukan dokumen Word (.docx) yang valid.')

  const total = view.getUint16(eocd + 10, true)
  let ptr = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder()

  for (let n = 0; n < total; n++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break
    const method = view.getUint16(ptr + 10, true)
    const compSize = view.getUint32(ptr + 20, true)
    const nameLen = view.getUint16(ptr + 28, true)
    const extraLen = view.getUint16(ptr + 30, true)
    const commentLen = view.getUint16(ptr + 32, true)
    const localOffset = view.getUint32(ptr + 42, true)
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen))

    if (name === entryName) {
      const localNameLen = view.getUint16(localOffset + 26, true)
      const localExtraLen = view.getUint16(localOffset + 28, true)
      const start = localOffset + 30 + localNameLen + localExtraLen
      const data = bytes.subarray(start, start + compSize)
      if (method === 0) return data
      if (method === 8) return inflateRaw(data)
      throw new Error('Metode kompresi file Word tidak didukung.')
    }
    ptr += 46 + nameLen + extraLen + commentLen
  }
  throw new Error('Isi dokumen tidak ditemukan. Pastikan file adalah dokumen Word (.docx).')
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decodeXml = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    return ENTITIES[e.toLowerCase()]
  })

// Ubah word/document.xml menjadi teks biasa: satu paragraf per baris.
export function docxXmlToText(xml) {
  const body = xml.match(/<w:body[\s\S]*<\/w:body>/)?.[0] || xml
  const paragraf = body.match(/<w:p\/>|<w:p[\s>][\s\S]*?<\/w:p>/g) || []
  const baris = paragraf.map((p) => {
    let teks = ''
    const token = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:numPr>/g
    let m
    let berpoin = false
    while ((m = token.exec(p))) {
      if (m[1] !== undefined) teks += decodeXml(m[1])
      else if (m[0] === '<w:tab/>') teks += '\t'
      else if (m[0] === '<w:br/>') teks += '\n'
      else berpoin = true // paragraf bernomor/berpoin
    }
    return berpoin && teks.trim() ? `- ${teks}` : teks
  })
  // Rapikan baris kosong berlebih
  return baris.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export async function bacaFileLaporan(file) {
  if (!file) throw new Error('Tidak ada file yang dipilih.')
  if (file.size > IMPORT_MAX_BYTES) throw new Error('Ukuran file maksimal 5 MB.')
  const nama = file.name.toLowerCase()

  if (nama.endsWith('.txt')) return (await file.text()).trim()
  if (nama.endsWith('.docx')) {
    const xml = new TextDecoder().decode(await readZipEntry(await file.arrayBuffer(), 'word/document.xml'))
    return docxXmlToText(xml)
  }
  if (nama.endsWith('.doc')) {
    throw new Error('Format .doc lama belum didukung. Buka di Word lalu "Save As" ke .docx, kemudian import ulang.')
  }
  throw new Error('Format file belum didukung. Gunakan .docx atau .txt.')
}
