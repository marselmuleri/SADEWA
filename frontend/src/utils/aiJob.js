// Definisi tahap proses AI dan pembantu tampilan, dipakai AiJobContext, AiLoadingStage, dan AiJobDock.
//
// Tahap mengikuti pipeline asli (ai/src/sadewa_ai/rag_chain.py). Bila endpoint streaming tersedia,
// backend mengirim event `tahap` sungguhan; bila tidak (mode cadangan), tahap diperkirakan dari
// waktu berjalan memakai nilai `mulai` (detik).

export const TAHAP = {
  rps: [
    { id: 'konteks', mulai: 0, label: 'Mengambil pedoman kurikulum' },
    { id: 'web', mulai: 4, label: 'Mencari referensi RPS sejenis di web' },
    { id: 'menulis', mulai: 10, label: 'Menyusun rencana 16 pertemuan' },
    {
      id: 'validasi',
      mulai: 32,
      label: 'Memeriksa aturan OBE: UTS minggu 8, UAS minggu 16, bobot 100',
      catatan: 'Bila belum sesuai aturan, draf disusun ulang otomatis (maksimal 2 kali).',
    },
    { id: 'simpan', mulai: Infinity, label: 'Menyimpan draf' },
  ],
  narasi: [
    { id: 'konteks', mulai: 0, label: 'Mengambil pedoman evaluasi dari dokumen kurikulum' },
    { id: 'menulis', mulai: 5, label: 'Menyusun ringkasan, analisis, faktor penyebab, dan rekomendasi' },
    { id: 'validasi', mulai: 28, label: 'Memeriksa kelengkapan bagian laporan' },
    { id: 'simpan', mulai: Infinity, label: 'Menyimpan narasi' },
  ],
}

export const JUDUL = {
  rps: { running: 'Menyusun draf RPS', success: 'Draf RPS selesai', error: 'Draf RPS gagal disusun' },
  narasi: { running: 'Menyusun narasi evaluasi', success: 'Narasi selesai', error: 'Narasi gagal disusun' },
}

export const BATAS_LAMBAT = 45 // detik; setelah ini tampilkan pesan bahwa proses masih berjalan

/**
 * Status tiap tahap untuk ditampilkan: 'selesai' | 'jalan' | 'menunggu', plus detail bila ada.
 * Mode stream memakai event asli; mode estimasi memakai waktu berjalan.
 */
export function statusTahap(job, detik) {
  const daftar = TAHAP[job.jenis] || []
  if (job.status === 'success') {
    return daftar.map((t) => ({ ...t, status: 'selesai', detail: job.tahap?.[t.id]?.detail }))
  }
  if (job.mode === 'stream') {
    const aktif = job.tahapAktif
    const idxAktif = daftar.findIndex((t) => t.id === aktif)
    return daftar.map((t, i) => {
      const ev = job.tahap?.[t.id]
      // Tahap setelah tahap aktif selalu "menunggu", termasuk saat draf diulang: hasil validasi
      // percobaan sebelumnya tidak boleh tampil seolah sudah lolos.
      if (idxAktif > -1 && i > idxAktif) return { ...t, status: 'menunggu' }
      let status = 'menunggu'
      if (t.id === aktif) status = ev?.status === 'selesai' ? 'selesai' : 'jalan'
      else if (ev) status = 'selesai'
      return { ...t, status, detail: ev?.detail }
    })
  }
  const terlihat = daftar.filter((t) => Number.isFinite(t.mulai))
  let aktif = 0
  terlihat.forEach((t, i) => {
    if (detik >= t.mulai) aktif = i
  })
  return terlihat.map((t, i) => ({ ...t, status: i < aktif ? 'selesai' : i === aktif ? 'jalan' : 'menunggu' }))
}

/** Label singkat tahap yang sedang berjalan (untuk dock dan pembaca layar). */
export function labelTahapAktif(job, detik) {
  if (job.status === 'success') return JUDUL[job.jenis]?.success || 'Selesai'
  if (job.status === 'error') return JUDUL[job.jenis]?.error || 'Gagal'
  const jalan = statusTahap(job, detik).find((t) => t.status === 'jalan')
  if (!jalan) return JUDUL[job.jenis]?.running || 'Memproses'
  if (job.percobaan > 1 && jalan.id === 'menulis') return `Menyusun ulang (percobaan ${job.percobaan})`
  return jalan.label
}

export function namaMk(mk) {
  if (!mk) return ''
  return [mk.kode, mk.nama].filter(Boolean).join(' · ')
}

export function formatDurasi(detik) {
  if (detik < 60) return `${detik} detik`
  const m = Math.floor(detik / 60)
  const s = detik % 60
  return s ? `${m} mnt ${s} dtk` : `${m} menit`
}
