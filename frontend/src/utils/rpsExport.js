// Dokumen Kontrak Kuliah + RPS (format resmi prodi): unduh Word (.doc) dan cetak / simpan PDF.
// Isi diambil dari rps.konten (format 2); draf format lama dikonversi otomatis lewat normalisasiRps.
// Identitas (fakultas, prodi, dosen) diambil dari GET /rps/identitas/{mata_kuliah_id}.

const esc = (val) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Logo universitas: taruh file di frontend/public/logo-universitas.png
export const LOGO_URL = '/logo-universitas.png'

export const UJIAN = { UTS: 'UJIAN TENGAH SEMESTER', UAS: 'UJIAN AKHIR SEMESTER' }

export function parseRpsKonten(konten) {
  if (!konten) return null
  if (typeof konten === 'object') return konten
  try {
    return JSON.parse(konten)
  } catch {
    return null
  }
}

const teks = (v) => (v == null ? '' : String(v).trim())
const daftar = (v) => {
  if (Array.isArray(v)) return v.map(teks).filter(Boolean)
  return teks(v) ? teks(v).split(/\n+/).map((s) => s.trim()).filter(Boolean) : []
}
export const daftarCpmk = (v) =>
  (Array.isArray(v) ? v : teks(v).split(/[,;\n]+/))
    .map(teks)
    .filter((s) => s && s !== '-')
    .map((s) => (/^\d+([.-]\d+)*$/.test(s) ? `CPMK ${s}` : s.replace(/^cpmk\s*[-_]?\s*/i, 'CPMK ')))

function jenisLama(materi) {
  const m = teks(materi).toUpperCase()
  if (m === 'UTS' || m === UJIAN.UTS) return 'UTS'
  if (m === 'UAS' || m === UJIAN.UAS) return 'UAS'
  return 'kuliah'
}

// Bentuk baku (format 2) untuk tampilan, editor, dan dokumen. Draf lama dikonversi.
export function normalisasiRps(konten) {
  const d = parseRpsKonten(konten) || {}
  const lama = d.format !== 2
  const pertemuan = (Array.isArray(d.pertemuan) ? d.pertemuan : [])
    .filter((p) => p && typeof p === 'object')
    .map((p) => {
      const jenis = lama ? jenisLama(p.materi) : p.jenis === 'UTS' || p.jenis === 'UAS' ? p.jenis : 'kuliah'
      const bobot = p.bobot === '' || p.bobot == null ? null : Number(p.bobot)
      if (jenis !== 'kuliah') return { minggu: Number(p.minggu) || 0, jenis, bobot }
      return {
        minggu: Number(p.minggu) || 0,
        jenis,
        kemampuan_akhir: teks(lama ? p.sub_cpmk : p.kemampuan_akhir),
        bahan_kajian_judul: teks(p.bahan_kajian_judul),
        bahan_kajian: teks(lama ? p.materi : p.bahan_kajian),
        metode: teks(p.metode),
        waktu: teks(p.waktu),
        pengalaman_belajar: daftar(p.pengalaman_belajar),
        target_cpmk: daftarCpmk(lama ? p.cpmk : p.target_cpmk),
        kriteria_indikator: daftar(p.kriteria_indikator),
        bobot: lama && bobot ? bobot : null,
      }
    })
    .sort((a, b) => a.minggu - b.minggu)
  return {
    format: 2,
    kode_mk: teks(d.kode_mk),
    semester_kurikulum: teks(d.semester_kurikulum),
    deskripsi_mk: teks(d.deskripsi_mk),
    cpl: (Array.isArray(d.cpl) ? d.cpl : []).map((c) => ({ kode: teks(c.kode), deskripsi: teks(c.deskripsi), label: teks(c.label) })),
    cpmk: (Array.isArray(d.cpmk) ? d.cpmk : []).map((c) => ({ kode: teks(c.kode), deskripsi: teks(c.deskripsi) })),
    penilaian: (Array.isArray(d.penilaian) ? d.penilaian : []).map((p) => ({
      poin: teks(p.poin),
      komponen: teks(p.komponen),
      rincian: daftar(p.rincian),
      bobot: p.bobot === '' || p.bobot == null ? null : Number(p.bobot),
      cpmk: daftarCpmk(p.cpmk),
    })),
    pertemuan,
    referensi: daftar(d.referensi),
  }
}

// Bobot UTS/UAS di tabel mingguan mengikuti Tabel Penilaian bila ada.
export function bobotUjian(rps, jenis, cadangan = null) {
  const baris = rps.penilaian.find((p) => p.komponen.toUpperCase() === jenis)
  return baris && baris.bobot != null ? baris.bobot : cadangan
}

export const totalBobotPenilaian = (rps) => rps.penilaian.reduce((s, p) => s + (Number(p.bobot) || 0), 0)

// 'CPMK 2.1', 'CPMK 5.1' -> 'CPMK 2.1, 5.1' (gaya kolom Target CPMK)
export const targetCpmkTeks = (kode) =>
  kode.length ? `CPMK ${kode.map((k) => k.replace(/^CPMK\s*/i, '')).join(', ')}` : ''

const angka = (n) => (n == null || Number.isNaN(n) ? '' : String(Math.round(n * 100) / 100))
const semesterAkademik = (s) => (String(s || '').toLowerCase() === 'genap' ? 'Genap' : 'Gasal')
const tanpaAwalan = (nama, awalan) => teks(nama).replace(new RegExp(`^${awalan}\\s+`, 'i'), '')

const paragrafBernomor = (items) =>
  items.map((t, i) => `<p class="hang">${i + 1}.&nbsp;&nbsp;${esc(t)}</p>`).join('')
const paragrafButir = (items, tanda) =>
  items.map((t) => `<p class="hang">${tanda}&nbsp;&nbsp;${esc(t)}</p>`).join('')

function kontrakHtml(rps, idt, meta) {
  const fakultas = tanpaAwalan(idt.fakultas, 'Fakultas')
  const kode = idt.kode || rps.kode_mk
  const dosen = idt.dosen?.length ? idt.dosen : ['-']

  // Baris berurutan dengan poin evaluasi sama digabung (rowspan), seperti "Kognitif / Pengetahuan".
  const grup = []
  rps.penilaian.forEach((p) => {
    const akhir = grup[grup.length - 1]
    if (akhir && akhir.poin === p.poin) akhir.items.push(p)
    else grup.push({ poin: p.poin, items: [p] })
  })
  const baris = grup
    .map((g, gi) =>
      g.items
        .map((p, i) => {
          const komponen = p.rincian.length
            ? `<p>${esc(p.komponen)}:</p>${paragrafBernomor(p.rincian)}`
            : `<p>${esc(p.komponen)}</p>`
          return `<tr>
${i === 0 ? `<td class="c" rowspan="${g.items.length}">${gi + 1}.</td><td rowspan="${g.items.length}">${esc(g.poin)}</td>` : ''}
<td>${komponen}</td><td class="c">${angka(p.bobot)}</td><td class="c">${esc(p.cpmk.join(', '))}</td></tr>`
        })
        .join(''),
    )
    .join('')

  return `<p class="judul">KONTRAK KULIAH</p>
<table class="identitas">
<tr><td class="lbl">Fakultas / Prodi</td><td class="tt">:</td><td>${esc(fakultas)} / ${esc(idt.program_studi)}</td></tr>
<tr><td class="lbl">Tahun Akademik</td><td class="tt">:</td><td>Semester ${semesterAkademik(meta.semester)} ${esc(meta.tahun_ajaran)}</td></tr>
<tr><td class="lbl">Mata Kuliah</td><td class="tt">:</td><td>${esc(kode)}- ${esc(idt.nama)} (${esc(idt.sks)} sks)</td></tr>
<tr><td class="lbl">Dosen</td><td class="tt">:</td><td>${dosen.map((n, i) => `${i + 1}. ${esc(n)}`).join('<br>')}</td></tr>
</table>
<p class="sub">Tabel Penilaian Mata Kuliah</p>
<table class="grid kontrak">
<colgroup><col style="width:5%"><col style="width:20%"><col style="width:38%"><col style="width:11%"><col style="width:26%"></colgroup>
<tr><th>No.</th><th>Poin Evaluasi</th><th>Komponen Evaluasi</th><th>Bobot (%)</th><th>Komponen CPMK yang Dinilai</th></tr>
${baris}
<tr><td class="c" colspan="3">Jumlah</td><td class="c">${angka(totalBobotPenilaian(rps))}</td><td></td></tr>
</table>`
}

function rpsHtml(rps, idt, logoSrc) {
  const fakultas = tanpaAwalan(idt.fakultas, 'Fakultas').toUpperCase()
  const prodi = tanpaAwalan(idt.program_studi, '(S1|S2|S3|D3|D4)').toUpperCase()
  const kode = idt.kode || rps.kode_mk
  const dosen = idt.dosen?.length ? idt.dosen : ['-']
  const logo = logoSrc ? `<img src="${esc(logoSrc)}" width="62" height="62" alt="Logo">` : ''

  const baris = (judul, items, render) =>
    items.length
      ? items
          .map((it, i) => `<tr>${i === 0 ? `<td class="lbl" rowspan="${items.length}">${judul}</td>` : ''}<td colspan="4">${render(it)}</td></tr>`)
          .join('')
      : `<tr><td class="lbl">${judul}</td><td colspan="4">-</td></tr>`

  const mingguan = rps.pertemuan
    .map((p) => {
      if (p.jenis !== 'kuliah') {
        return `<tr><td class="c">${esc(p.minggu)}</td><td class="c b" colspan="7">${UJIAN[p.jenis]}</td><td class="c">${angka(bobotUjian(rps, p.jenis, p.bobot))}</td></tr>`
      }
      const bahan = p.bahan_kajian_judul
        ? `<b>${esc(p.bahan_kajian_judul)}:</b> ${esc(p.bahan_kajian)}`
        : esc(p.bahan_kajian)
      const kriteria = p.kriteria_indikator.length > 1 ? paragrafButir(p.kriteria_indikator, '-') : esc(p.kriteria_indikator[0] || '')
      return `<tr>
<td class="c">${esc(p.minggu)}</td><td>${esc(p.kemampuan_akhir)}</td><td>${bahan}</td><td>${esc(p.metode)}</td>
<td class="c">${esc(p.waktu)}</td><td>${paragrafButir(p.pengalaman_belajar, '&#9679;')}</td>
<td>${esc(targetCpmkTeks(p.target_cpmk))}</td><td>${kriteria}</td><td class="c">${angka(p.bobot)}</td></tr>`
    })
    .join('')

  return `<table class="grid tebal awal">
<colgroup><col style="width:13%"><col style="width:41%"><col style="width:46%"></colgroup>
<tr><td class="c logo" rowspan="2">${logo}</td><td class="c b" colspan="2">RENCANA PEMBELAJARAN SEMESTER</td></tr>
<tr><td class="b">Program Studi: ${esc(prodi)}</td><td class="b">Fakultas: ${esc(fakultas)}</td></tr>
</table>
<table class="grid tebal sambung">
<colgroup><col style="width:22.5%"><col style="width:12%"><col style="width:13%"><col style="width:8%"><col style="width:44.5%"></colgroup>
<tr><td class="lbl">Mata Kuliah:</td><td>${esc(idt.nama)}</td><td><b>Kode:</b><br>${esc(kode)}</td><td><b>SKS:</b><br>${esc(idt.sks)}</td><td><b>Sem:</b><br>${esc(rps.semester_kurikulum)}</td></tr>
<tr><td class="lbl">Dosen Pengampu:</td><td colspan="4">${paragrafBernomor(dosen)}</td></tr>
${baris('Capaian Pembelajaran Lulusan', rps.cpl, (c) => `<p class="just">${esc(c.kode)} : ${esc(c.deskripsi)}${c.label ? ` <b>(${esc(c.label)})</b>` : ''}</p>`)}
${baris('Capaian Pembelajaran Mata Kuliah:', rps.cpmk, (c) => `<p class="just">${esc(c.kode)} : ${esc(c.deskripsi)}</p>`)}
<tr><td class="lbl">Deskripsi Singkat Mata Kuliah:</td><td colspan="4"><p class="just">${esc(rps.deskripsi_mk)}</p></td></tr>
</table>
<table class="grid tebal sambung mingguan">
<colgroup><col style="width:5.5%"><col style="width:15%"><col style="width:15.5%"><col style="width:8%"><col style="width:6.5%"><col style="width:16%"><col style="width:8.5%"><col style="width:19.5%"><col style="width:5.5%"></colgroup>
<thead>
<tr class="nomor"><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th colspan="2">8</th></tr>
<tr><th rowspan="2">Perte-<br>muan</th><th rowspan="2">Kemampuan Akhir Tiap Tahapan Pembelajaran</th><th rowspan="2">Bahan Kajian/ Pokok Bahasan</th><th rowspan="2">Metode Pembela-<br>jaran</th><th rowspan="2">Waktu (menit)</th><th rowspan="2">Pengalaman Belajar Mahasiswa</th><th rowspan="2">Target CPMK</th><th colspan="2">Penilaian</th></tr>
<tr><th>Kriteria &amp; Indikator</th><th>Bobot (%)</th></tr>
</thead>
<tbody>${mingguan}</tbody>
</table>
<table class="grid tebal sambung akhir">
<colgroup><col style="width:22.5%"><col style="width:77.5%"></colgroup>
<tr><td class="lbl">Daftar Referensi:</td><td>${rps.referensi.length ? paragrafBernomor(rps.referensi) : '-'}</td></tr>
</table>`
}

// mode: 'word' (MS Word HTML), 'print' (jendela cetak), 'preview' (iframe di aplikasi)
export function buildRpsHtml(rpsRecord, identitas, { logoSrc = null, mode = 'print' } = {}) {
  const rps = normalisasiRps(rpsRecord.konten)
  const idt = identitas || {}
  const meta = { semester: rpsRecord.semester, tahun_ajaran: rpsRecord.tahun_ajaran }
  const judul = `RPS ${idt.kode || rps.kode_mk} ${idt.nama || ''}`.trim()
  const pemisahHalaman =
    mode === 'word'
      ? `<br clear="all" style="mso-special-character:line-break;page-break-before:always">`
      : '<div class="pisah-halaman"></div>'

  return `<!doctype html>
<html lang="id" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(judul)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4 landscape; margin: 1.5cm 1.6cm; }
  @page Halaman { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 1.5cm 1.6cm; }
  div.Halaman { page: Halaman; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000; margin: 0; }
  p { margin: 0; }
  .judul { text-align: center; font-weight: bold; font-size: 12pt; margin: 6pt 0 14pt; }
  .sub { font-weight: bold; font-size: 11pt; margin: 14pt 0 6pt; }
  table { border-collapse: collapse; width: 100%; }
  table.identitas td { font-size: 11pt; padding: 0 4pt 0 0; vertical-align: top; border: none; }
  table.identitas td.lbl { width: 105pt; }
  table.identitas td.tt { width: 8pt; }
  table.grid td, table.grid th { border: 1pt solid #000; padding: 2pt 4pt; vertical-align: top; text-align: left; }
  table.grid th { font-weight: bold; text-align: center; vertical-align: middle; }
  table.kontrak td, table.kontrak th { font-size: 11pt; vertical-align: middle; }
  table.tebal { border-left: 2.25pt solid #000; border-right: 2.25pt solid #000; }
  table.awal { border-top: 2.25pt solid #000; }
  table.akhir { border-bottom: 2.25pt solid #000; }
  table.sambung { margin-top: -1pt; }
  table.mingguan { border-top: 2.25pt solid #000; }
  table.mingguan tr.nomor th { border-bottom-width: 2.25pt; }
  table.mingguan thead { display: table-header-group; }
  table.mingguan tr { page-break-inside: avoid; }
  table.grid td.lbl { font-weight: bold; }
  td.logo { vertical-align: middle; text-align: center; }
  .c { text-align: center !important; }
  .b { font-weight: bold; }
  .just { text-align: justify; margin: 1pt 0; }
  .hang { margin-left: 12pt; text-indent: -12pt; }
  .pisah-halaman { page-break-before: always; break-before: page; }
  ${mode === 'preview' ? `
  html { background: #E2E8F0; }
  body { padding: 16px 0; }
  .lembar { background: #fff; width: 267mm; margin: 0 auto 16px; padding: 12mm 14mm; box-shadow: 0 1px 3px rgba(15,23,42,.18); }
  .pisah-halaman { display: none; }` : ''}
</style></head><body>
<div class="Halaman">
<div class="lembar">${kontrakHtml(rps, idt, meta)}</div>
${pemisahHalaman}
<div class="lembar">${rpsHtml(rps, idt, logoSrc)}</div>
</div>
</body></html>`
}

let logoCache
// Logo universitas sebagai data URI; null bila file belum ada.
export function muatLogo() {
  if (logoCache === undefined) {
    logoCache = fetch(LOGO_URL)
      .then((res) => {
        const tipe = res.headers.get('content-type') || ''
        if (!res.ok || !tipe.startsWith('image/')) return null
        return res.blob().then(
          (blob) =>
            new Promise((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result)
              reader.onerror = () => resolve(null)
              reader.readAsDataURL(blob)
            }),
        )
      })
      .catch(() => null)
  }
  return logoCache
}

function namaFile(rps, identitas) {
  const kode = identitas?.kode || parseRpsKonten(rps.konten)?.kode_mk || 'MK'
  return `RPS_${kode}_${rps.semester}_${String(rps.tahun_ajaran || '').replace(/\//g, '-')}`.replace(/[^\w.-]+/g, '_')
}

function base64Utf8(str) {
  const bytes = new TextEncoder().encode(str)
  let biner = ''
  for (let i = 0; i < bytes.length; i += 0x8000) biner += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(biner)
}
const baris76 = (b64) => b64.replace(/.{76}/g, '$&\r\n')

// Word tidak menyimpan gambar data URI dari HTML biasa; dengan logo dipakai MHTML (gambar ikut tertanam).
function bungkusMhtml(html, logoDataUri) {
  const batas = '----=_SADEWA_RPS_Batas'
  const [, tipe, data] = /^data:([^;]+);base64,(.*)$/.exec(logoDataUri) || []
  const htmlLogo = html.replace(logoDataUri, 'file:///C:/sadewa/logo-universitas')
  return [
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${batas}"; type="text/html"`,
    '',
    `--${batas}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    'Content-Location: file:///C:/sadewa/rps.htm',
    '',
    baris76(base64Utf8(htmlLogo)),
    '',
    `--${batas}`,
    `Content-Type: ${tipe}`,
    'Content-Transfer-Encoding: base64',
    'Content-Location: file:///C:/sadewa/logo-universitas',
    '',
    baris76(data),
    '',
    `--${batas}--`,
    '',
  ].join('\r\n')
}

export async function downloadRpsWord(rps, identitas) {
  const logo = await muatLogo()
  const html = buildRpsHtml(rps, identitas, { logoSrc: logo, mode: 'word' })
  const isi = logo ? bungkusMhtml(html, logo) : ['\ufeff', html].join('')
  const blob = new Blob([isi], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${namaFile(rps, identitas)}.doc`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Jendela dibuka lebih dulu (sinkron dengan klik) agar tidak diblokir pop-up blocker,
// lalu diisi setelah logo dimuat. Pengguna bisa memilih "Simpan sebagai PDF".
export function printRps(rps, identitas) {
  const win = window.open('', '_blank')
  if (!win) return false
  muatLogo().then((logo) => {
    win.document.open()
    win.document.write(buildRpsHtml(rps, identitas, { logoSrc: logo, mode: 'print' }))
    win.document.close()
    win.document.title = namaFile(rps, identitas)
    win.focus()
    setTimeout(() => win.print(), 400)
  })
  return true
}
