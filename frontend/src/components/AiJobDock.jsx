import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { SadewaLoader } from './brand/SadewaLogo'
import useAiJobs, { useDetikSejak } from '../hooks/useAiJobs'
import { JUDUL, formatDurasi, labelTahapAktif, namaMk } from '../utils/aiJob'
import { parsePartialJson } from '../utils/partialJson'

// Kartu kecil di pojok kanan bawah untuk proses AI yang dijalankan di latar belakang.
// Dosen bisa pindah halaman dan bekerja seperti biasa; begitu selesai, kartu berubah
// menjadi notifikasi "Lihat hasil" yang membuka hasilnya di halaman Dokumen.

const tombol =
  'rounded-[6px] px-2.5 py-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4A300]'

function progresRps(job) {
  if (job.jenis !== 'rps' || job.mode !== 'stream') return null
  const data = parsePartialJson(job.teks)
  const n = Array.isArray(data?.pertemuan) ? data.pertemuan.filter((p) => p?.bobot !== undefined).length : 0
  return n ? Math.min(16, n) : null
}

function KartuJob({ job }) {
  const navigate = useNavigate()
  const { batal, kembalikan, hapus, ulangi } = useAiJobs()
  const detik = useDetikSejak(job.mulaiPada, job.selesaiPada)
  const judul = JUDUL[job.jenis]
  const progres = job.status === 'running' ? progresRps(job) : null

  const buka = (aksi) => {
    kembalikan(job.jenis)
    navigate('/dokumen', { state: { aiJob: job.jenis, aksi } })
  }

  return (
    <div
      className="pointer-events-auto w-[320px] max-w-[calc(100vw-2rem)] animate-sel-isi rounded-[8px] border border-[#E2E8F0] bg-white p-3 shadow-lg"
      data-testid={`ai-dock-${job.jenis}`}
    >
      <div className="flex items-start gap-2.5">
        {job.status === 'running' ? (
          <SadewaLoader size={30} className="shrink-0" />
        ) : job.status === 'success' ? (
          <CheckCircle2 className="h-[30px] w-[30px] shrink-0 text-[#10B981]" aria-hidden="true" />
        ) : (
          <AlertCircle className="h-[30px] w-[30px] shrink-0 text-[#EF4444]" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <p className="text-xs font-semibold text-[#142B4A]">
            {job.status === 'running' ? judul.running : job.status === 'success' ? judul.success : judul.error}
          </p>
          <p className="truncate text-[11px] text-[#64748B]">{namaMk(job.mk)}</p>
          <p className="mt-1 line-clamp-2 text-[11px] text-[#142B4A]">
            {job.status === 'error'
              ? job.error
              : job.status === 'success'
              ? `Selesai dalam ${formatDurasi(detik)} dan tersimpan sebagai draf.`
              : `${labelTahapAktif(job, detik)} · ${formatDurasi(detik)}`}
          </p>
        </div>
        {job.status !== 'running' ? (
          <button
            type="button"
            onClick={() => hapus(job.jenis)}
            aria-label="Tutup notifikasi"
            className="rounded-[4px] p-0.5 text-[#64748B] hover:bg-[#F2F4F7] hover:text-[#142B4A]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {progres ? (
        <div className="mt-2.5 flex items-center gap-2" aria-hidden="true">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F2F4F7]">
            <div className="h-full rounded-full bg-[#F4A300] transition-[width] duration-500" style={{ width: `${(progres / 16) * 100}%` }} />
          </div>
          <span className="text-[10px] tabular-nums text-[#64748B]">{progres}/16 pertemuan</span>
        </div>
      ) : null}

      <div className="mt-2.5 flex justify-end gap-1.5">
        {job.status === 'running' ? (
          <>
            <button type="button" onClick={() => batal(job.jenis)} className={`${tombol} border border-[#CBD5E1] text-[#142B4A] hover:border-[#EF4444] hover:text-[#B91C1C]`}>
              Batalkan
            </button>
            <button type="button" onClick={() => buka('buka')} className={`${tombol} bg-[#1A3A6B] text-white hover:bg-[#142B4A]`}>
              Lihat proses
            </button>
          </>
        ) : job.status === 'success' ? (
          <button type="button" onClick={() => buka('lihat')} className={`${tombol} bg-[#1A3A6B] text-white hover:bg-[#142B4A]`} data-testid={`ai-dock-lihat-${job.jenis}`}>
            Lihat hasil
          </button>
        ) : (
          <button type="button" onClick={() => ulangi(job.jenis)} className={`${tombol} bg-[#1A3A6B] text-white hover:bg-[#142B4A]`}>
            Coba lagi
          </button>
        )}
      </div>
    </div>
  )
}

export default function AiJobDock() {
  const { jobs } = useAiJobs()
  const tampil = Object.values(jobs).filter((j) => j.latar)

  // Judul tab ikut memberi tahu saat proses latar belakang selesai (berguna bila tab lain sedang dibuka).
  const judulAsli = useRef(typeof document !== 'undefined' ? document.title : '')
  const adaSelesai = tampil.some((j) => j.status === 'success')
  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    if (adaSelesai) {
      judulAsli.current = document.title.replace(/^\(\d+\) /, '')
      document.title = `(1) Hasil AI siap · ${judulAsli.current}`
    }
    return () => {
      if (adaSelesai) document.title = judulAsli.current
    }
  }, [adaSelesai])

  if (!tampil.length) return null
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2" aria-label="Proses AI di latar belakang">
      {tampil.map((job) => (
        <KartuJob key={job.jenis} job={job} />
      ))}
    </div>
  )
}
