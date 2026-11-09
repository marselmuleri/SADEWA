// Ekspor draf RPS ke Word (.doc berbasis HTML) dan cetak / simpan PDF lewat dialog print browser.

const esc = (val) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export function parseRpsKonten(konten) {
  if (!konten) return null
  if (typeof konten === 'object') return konten
  try {
    return JSON.parse(konten)
  } catch {
    return null
  }
}

function buildRpsHtml(rps, mataKuliah) {
  const data = parseRpsKonten(rps.konten) || {}
  const cpl = Array.isArray(data.cpl) ? data.cpl : []
  const cpmk = Array.isArray(data.cpmk) ? data.cpmk : []
  const pertemuan = Array.isArray(data.pertemuan) ? data.pertemuan : []
  const total = pertemuan.reduce((s, p) => s + (Number(p.bobot) || 0), 0)
  const namaMk = mataKuliah ? `${mataKuliah.kode} — ${mataKuliah.nama}` : data.kode_mk || ''

  const daftar = (items) =>
    items.length
      ? `<ul>${items.map((c) => `<li><b>${esc(c.kode)}</b> — ${esc(c.deskripsi)}</li>`).join('')}</ul>`
      : '<p>-</p>'

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>RPS ${esc(namaMk)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #142B4A; margin: 24px; }
  h1 { font-size: 16pt; margin: 0 0 4px; text-align: center; }
  h2 { font-size: 12pt; margin: 18px 0 6px; border-bottom: 1px solid #94A3B8; padding-bottom: 2px; }
  .sub { text-align: center; margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #64748B; padding: 4px 6px; vertical-align: top; text-align: left; font-size: 10pt; }
  th { background: #E2E8F0; }
  td.num { text-align: center; }
</style></head><body>
<h1>RENCANA PEMBELAJARAN SEMESTER (RPS)</h1>
<p class="sub">${esc(namaMk)}${mataKuliah?.sks ? ` · ${esc(mataKuliah.sks)} SKS` : ''} · Semester ${esc(rps.semester)} · Tahun Ajaran ${esc(rps.tahun_ajaran)}</p>
<h2>Deskripsi Mata Kuliah</h2>
<p>${esc(data.deskripsi_mk || '-')}</p>
<h2>Capaian Pembelajaran Lulusan (CPL)</h2>
${daftar(cpl)}
<h2>Capaian Pembelajaran Mata Kuliah (CPMK)</h2>
${daftar(cpmk)}
<h2>Rencana Pembelajaran Mingguan</h2>
<table>
  <thead><tr><th>Minggu</th><th>CPMK</th><th>Sub-CPMK</th><th>Materi</th><th>Metode</th><th>Bobot (%)</th></tr></thead>
  <tbody>
    ${pertemuan
      .map(
        (p) =>
          `<tr><td class="num">${esc(p.minggu)}</td><td>${esc(p.cpmk)}</td><td>${esc(p.sub_cpmk)}</td><td>${esc(p.materi)}</td><td>${esc(p.metode)}</td><td class="num">${esc(p.bobot)}</td></tr>`,
      )
      .join('')}
    <tr><th colspan="5">Total bobot</th><th>${esc(total)}</th></tr>
  </tbody>
</table>
</body></html>`
}

function namaFile(rps, mataKuliah) {
  const kode = mataKuliah?.kode || parseRpsKonten(rps.konten)?.kode_mk || 'MK'
  return `RPS_${kode}_${rps.semester}_${String(rps.tahun_ajaran || '').replace(/\//g, '-')}`.replace(/[^\w.-]+/g, '_')
}

export function downloadRpsWord(rps, mataKuliah) {
  const html = buildRpsHtml(rps, mataKuliah)
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${namaFile(rps, mataKuliah)}.doc`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Membuka jendela cetak; pengguna bisa memilih "Simpan sebagai PDF".
export function printRps(rps, mataKuliah) {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.open()
  win.document.write(buildRpsHtml(rps, mataKuliah))
  win.document.close()
  win.document.title = namaFile(rps, mataKuliah)
  win.focus()
  setTimeout(() => win.print(), 300)
  return true
}
