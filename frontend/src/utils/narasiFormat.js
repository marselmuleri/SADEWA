// Mengubah JSON narasi evaluasi dari AI Service menjadi teks laporan yang bisa diedit dosen.
// Bentuk data: { ringkasan_capaian, analisis_cpl[], faktor_penyebab[], rekomendasi_intervensi[], kesimpulan }
export function formatNarasi(konten) {
  let data = konten
  if (typeof konten === 'string') {
    try {
      data = JSON.parse(konten)
    } catch {
      return konten
    }
  }
  if (!data || typeof data !== 'object') return ''

  const bagian = []
  if (data.ringkasan_capaian) bagian.push(`RINGKASAN CAPAIAN\n${data.ringkasan_capaian}`)
  if (Array.isArray(data.analisis_cpl) && data.analisis_cpl.length) {
    bagian.push(`ANALISIS CPL\n${data.analisis_cpl.map((a) => `- ${a.kode} (${a.status}): ${a.analisis}`).join('\n')}`)
  }
  if (Array.isArray(data.faktor_penyebab) && data.faktor_penyebab.length) {
    bagian.push(`FAKTOR PENYEBAB\n${data.faktor_penyebab.map((f) => `- ${f}`).join('\n')}`)
  }
  if (Array.isArray(data.rekomendasi_intervensi) && data.rekomendasi_intervensi.length) {
    bagian.push(
      `REKOMENDASI INTERVENSI\n${data.rekomendasi_intervensi
        .map((r) => `- [Prioritas ${r.prioritas}] ${r.sasaran}: ${r.tindakan}`)
        .join('\n')}`,
    )
  }
  if (data.kesimpulan) bagian.push(`KESIMPULAN\n${data.kesimpulan}`)
  return bagian.join('\n\n')
}
