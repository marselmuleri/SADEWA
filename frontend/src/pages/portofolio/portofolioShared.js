import { BarChart3, ClipboardCheck, FileText, IdCard, LineChart, Paperclip, PencilLine, Upload } from 'lucide-react'
import api from '../../services/api'

// Enam menu Portofolio (mengikuti panduan referensi).
// labelTulis dipakai untuk dosen pengampu, labelLihat untuk Kaprodi/Dekan.
export const PORTOFOLIO_SECTIONS = [
  { id: 'rps', labelTulis: 'Upload RPS', labelLihat: 'Lihat RPS', icon: Upload },
  { id: 'rpp', labelTulis: 'Input RPP', labelLihat: 'Lihat RPP', icon: PencilLine },
  { id: 'lampiran', labelTulis: 'Upload Lampiran', labelLihat: 'Lihat Lampiran', icon: Paperclip },
  { id: 'nilai-cp', labelTulis: 'Lihat Nilai CP', labelLihat: 'Lihat Nilai CP', icon: FileText },
  { id: 'grafik', labelTulis: 'Lihat Grafik Capaian', labelLihat: 'Lihat Grafik Capaian', icon: LineChart },
  { id: 'sebaran', labelTulis: 'Lihat Sebaran Nilai', labelLihat: 'Lihat Sebaran Nilai', icon: BarChart3 },
  { id: 'evaluasi', labelTulis: 'Isi Evaluasi CPMK', labelLihat: 'Lihat Evaluasi CPMK', icon: ClipboardCheck },
  { id: 'info', labelTulis: 'Isi Data Portofolio', labelLihat: 'Lihat Data Portofolio', icon: IdCard },
]

function namaFileDariHeader(header, cadangan) {
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header || '')
  if (utf8) return decodeURIComponent(utf8[1])
  const biasa = /filename="?([^";]+)"?/i.exec(header || '')
  return biasa ? biasa[1] : cadangan
}

// Unduh portofolio lengkap (multi-sheet) sebagai file Excel.
export async function unduhExcelPortofolio(mk) {
  const res = await api.get(`/portofolio/${mk.id}/export`, { responseType: 'blob' })
  const nama = namaFileDariHeader(res.headers?.['content-disposition'], `Portofolio ${mk.kode || mk.id}.xlsx`)
  const url = URL.createObjectURL(res.data)
  const link = document.createElement('a')
  link.href = url
  link.download = nama
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function sectionLabel(section, canWrite) {
  return canWrite ? section.labelTulis : section.labelLihat
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function formatTanggal(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatNilai(value) {
  if (value === null || value === undefined) return '-'
  return Number(value).toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

// Respons error dari request blob berupa Blob, bukan JSON; ambil pesan "detail"-nya.
export async function blobErrorMessage(err, fallback) {
  const data = err?.response?.data
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text())
      if (typeof parsed?.detail === 'string') return parsed.detail
    } catch {
      // abaikan, pakai fallback
    }
  }
  return err?.message || fallback
}

async function ambilBlob(berkas) {
  const res = await api.get(`/portofolio/berkas/${berkas.id}/unduh`, { responseType: 'blob' })
  return new Blob([res.data], { type: berkas.content_type || res.data.type || 'application/octet-stream' })
}

export async function unduhBerkas(berkas) {
  const url = URL.createObjectURL(await ambilBlob(berkas))
  const link = document.createElement('a')
  link.href = url
  link.download = berkas.nama_file
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// PDF & gambar dibuka di tab baru; format lain langsung diunduh.
export async function bukaBerkas(berkas) {
  const nama = (berkas.nama_file || '').toLowerCase()
  const bisaDipratinjau = /\.(pdf|png|jpe?g|txt)$/.test(nama)
  if (!bisaDipratinjau) return unduhBerkas(berkas)
  // Tab dibuka sebelum await agar tidak diblokir sebagai pop-up.
  const tab = window.open('', '_blank')
  let blob
  try {
    blob = await ambilBlob(berkas)
  } catch (err) {
    tab?.close()
    throw err
  }
  const url = URL.createObjectURL(blob)
  if (tab) {
    tab.location.href = url
  } else {
    window.location.assign(url)
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
