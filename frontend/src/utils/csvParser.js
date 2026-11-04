/**
 * Utilitas Parser dan Generator CSV untuk Frontend SADEWA
 * Mendukung format RFC-4180 (koma / titik-koma, escaped quotes, trimmed text, UTF-8 BOM).
 */

export function parseCsv(text) {
  if (!text || typeof text !== 'string') return []

  // Hapus UTF-8 BOM jika ada
  let cleanText = text
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1)
  }

  const lines = []
  let currentRow = []
  let currentField = ''
  let insideQuotes = false

  // Deteksi pemisah default (koma atau titik koma) berdasarkan baris pertama
  const firstLine = cleanText.split(/\r\n|\n|\r/)[0] || ''
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ','

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i]
    const nextChar = cleanText[i + 1]

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: ""
          currentField += '"'
          i++
        } else {
          // Tutup quote
          insideQuotes = false
        }
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        insideQuotes = true
      } else if (char === delimiter) {
        currentRow.push(currentField.trim())
        currentField = ''
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++
        }
        currentRow.push(currentField.trim())
        if (currentRow.length > 0 && currentRow.some((val) => val !== '')) {
          lines.push(currentRow)
        }
        currentRow = []
        currentField = ''
      } else if (char === '\n') {
        currentRow.push(currentField.trim())
        if (currentRow.length > 0 && currentRow.some((val) => val !== '')) {
          lines.push(currentRow)
        }
        currentRow = []
        currentField = ''
      } else {
        currentField += char
      }
    }
  }

  // Tambahkan baris terakhir jika masih ada sisa
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((val) => val !== '')) {
      lines.push(currentRow)
    }
  }

  if (lines.length === 0) return []

  // Normalisasi header
  const headers = lines[0].map((h) =>
    h.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '')
  )

  const rows = []
  for (let r = 1; r < lines.length; r++) {
    const rowObj = {}
    headers.forEach((header, colIdx) => {
      rowObj[header] = lines[r][colIdx] !== undefined ? lines[r][colIdx] : ''
    })
    rows.push(rowObj)
  }

  return { headers, rows }
}

export function downloadCsvTemplate(filename, headers, sampleRows = []) {
  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""'
    const stringified = String(str).replace(/"/g, '""')
    return `"${stringified}"`
  }

  const headerLine = headers.map((h) => escapeCsv(h.label || h.key || h)).join(',')
  const dataLines = sampleRows.map((row) => {
    if (Array.isArray(row)) {
      return row.map((cell) => escapeCsv(cell)).join(',')
    }
    return headers.map((h) => escapeCsv(row[h.key || h] ?? '')).join(',')
  })

  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 150)
}
