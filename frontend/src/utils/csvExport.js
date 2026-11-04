export function exportToCsv(filename, headers, rows) {
  if (!rows || rows.length === 0) {
    alert('Tidak ada data untuk diekspor')
    return
  }

  try {
    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""'
      const stringified = String(str).replace(/"/g, '""')
      return `"${stringified}"`
    }

    const headerLine = headers.map((h) => escapeCsv(h.label)).join(',')
    const dataLines = rows.map((row) =>
      headers.map((h) => escapeCsv(row[h.key] ?? '')).join(',')
    )

    const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    // Delay revokeObjectURL so the browser has time to start the download
    setTimeout(() => URL.revokeObjectURL(url), 150)
  } catch (err) {
    console.error('Gagal mengekspor CSV:', err)
    alert('Terjadi kesalahan saat mengekspor CSV. Silakan coba lagi.')
  }
}
