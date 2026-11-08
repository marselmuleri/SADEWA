import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Circle } from 'lucide-react'

// Tahapan mengikuti pipeline asli di ai/src/sadewa_ai/rag_chain.py. Backend tidak
// mengirim progres, jadi tahap ditentukan dari waktu berjalan (estimasi). Tahap terakhir
// bertahan sampai respons benar-benar datang.
export const TAHAP_RPS = [
  { mulai: 0, label: 'Mengambil pedoman kurikulum dan data mata kuliah' },
  { mulai: 4, label: 'Mencari referensi RPS sejenis di web, bila tersedia' },
  { mulai: 10, label: 'Menyusun rencana 16 pertemuan' },
  {
    mulai: 32,
    label: 'Memeriksa aturan OBE: UTS minggu 8, UAS minggu 16, bobot 100',
    catatan: 'Bila belum sesuai aturan, draf disusun ulang otomatis (maksimal 2 kali).',
  },
]

export const TAHAP_NARASI = [
  { mulai: 0, label: 'Merangkum capaian CPL dan CPMK mata kuliah' },
  { mulai: 3, label: 'Mengambil pedoman evaluasi dari dokumen kurikulum' },
  { mulai: 8, label: 'Menyusun ringkasan, analisis, faktor penyebab, dan rekomendasi' },
  { mulai: 28, label: 'Memeriksa kelengkapan bagian laporan' },
]

const BATAS_LAMBAT = 45 // detik; setelah ini tampilkan pesan bahwa proses masih berjalan

const JUDUL = {
  rps: { running: 'Menyusun draf RPS', success: 'Draf RPS selesai', error: 'Draf RPS gagal disusun' },
  narasi: { running: 'Menyusun narasi evaluasi', success: 'Narasi selesai', error: 'Narasi gagal disusun' },
}

/** Hitung detik berjalan selama `aktif` true. Nilai terakhir dipertahankan setelah berhenti. */
export function useElapsedSeconds(aktif) {
  const [detik, setDetik] = useState(0)
  useEffect(() => {
    if (!aktif) return undefined
    const mulai = Date.now()
    setDetik(0)
    const id = setInterval(() => setDetik(Math.floor((Date.now() - mulai) / 1000)), 1000)
    return () => clearInterval(id)
  }, [aktif])
  return detik
}

// ---------------------------------------------------------------------------
// Animasi dekoratif
// ---------------------------------------------------------------------------
const LEBAR_BARIS = ['92%', '78%', '86%', '64%', '90%', '72%', '83%', '58%', '76%']

function VisualRps({ detik, selesai }) {
  // Sel ke-16 hanya terisi saat respons sukses, supaya tidak terlihat selesai sebelum waktunya.
  const terisi = selesai ? 16 : Math.min(15, Math.floor(detik / 2.6) + 1)
  const baris = selesai ? LEBAR_BARIS.length : Math.min(LEBAR_BARIS.length - 1, Math.floor(detik / 4.5) + 1)
  return (
    <div className="grid grid-cols-1 items-center gap-4 min-[420px]:grid-cols-[auto_1fr]" aria-hidden="true">
      <div className="grid grid-cols-4 gap-1.5 justify-self-center">
        {Array.from({ length: 16 }, (_, i) => {
          const no = i + 1
          const isi = no <= terisi
          const terbaru = isi && no === terisi && !selesai
          const label = no === 8 ? 'UTS' : no === 16 ? 'UAS' : no
          return (
            <div
              key={no}
              className={`flex h-9 w-9 items-center justify-center rounded-[5px] border text-[10px] font-semibold tabular-nums transition-colors duration-500 ${
                terbaru
                  ? 'animate-sel-isi border-[#F4A300] bg-[#F4A300] text-[#142B4A]'
                  : isi
                  ? 'border-[#F4A300]/60 bg-[#FFF4D6] text-[#7A5200]'
                  : 'border-[#E2E8F0] bg-[#F2F4F7] text-[#94A3B8]'
              }`}
            >
              {label}
            </div>
          )
        })}
      </div>
      <div className="rounded-md border border-[#E2E8F0] bg-white p-3">
        <div className="mb-2.5 h-2 w-2/5 rounded-full bg-[#1A3A6B]" />
        <div className="space-y-2">
          {LEBAR_BARIS.map((lebar, i) => (
            <div key={i} className="h-1.5 rounded-full bg-[#F2F4F7]" style={{ width: lebar }}>
              {i < baris && <div className="h-full origin-left animate-baris-tulis rounded-full bg-[#CBD5E1]" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const BAR_CAPAIAN = [
  { tinggi: 64, tunda: '0s' },
  { tinggi: 82, tunda: '0.4s' },
  { tinggi: 52, tunda: '0.8s', di_bawah: true },
  { tinggi: 76, tunda: '1.2s' },
  { tinggi: 70, tunda: '1.6s' },
]

function VisualNarasi({ selesai }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-4" aria-hidden="true">
      <div className="space-y-2">
        {['96%', '88%', '93%', '70%', '84%'].map((lebar, i) => (
          <div
            key={i}
            className={`h-2 rounded-full ${selesai ? 'bg-[#CBD5E1]' : 'ai-kilau animate-kilau'}`}
            style={{ width: lebar, animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <div className="flex h-14 items-end gap-1.5">
        {BAR_CAPAIAN.map((b, i) => (
          <div key={i} className="flex h-full w-3 items-end rounded-sm bg-[#F2F4F7]">
            <div
              className={`w-full origin-bottom rounded-sm ${b.di_bawah ? 'bg-[#F4A300]' : 'bg-[#1A3A6B]'} ${selesai ? '' : 'animate-bar-naik'}`}
              style={{ height: `${b.tinggi}%`, animationDelay: b.tunda }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
export default function AiLoadingStage({
  variant = 'rps',
  stages,
  elapsedSeconds = 0,
  status = 'running',
  onCancel,
  onRetry,
  onClose,
  errorMessage,
  compact = false,
}) {
  const tahap = stages || (variant === 'narasi' ? TAHAP_NARASI : TAHAP_RPS)
  const judul = JUDUL[variant] || JUDUL.rps
  const selesai = status === 'success'
  const lambat = status === 'running' && elapsedSeconds >= BATAS_LAMBAT
  let aktif = 0
  tahap.forEach((t, i) => { if (elapsedSeconds >= t.mulai) aktif = i })
  if (selesai) aktif = tahap.length

  if (status === 'error') {
    return (
      <div className={`flex flex-col items-start gap-3 ${compact ? 'p-4' : 'py-2'}`} role="alert" data-testid={`ai-error-${variant}`}>
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#EF4444]" />
          <div>
            <p className="text-sm font-semibold text-[#142B4A]">{judul.error}</p>
            <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{errorMessage || 'Terjadi kesalahan yang tidak diketahui.'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 self-end">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A3A6B]"
              data-testid={`ai-tutup-${variant}`}
            >
              Tutup
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-[6px] bg-[#1A3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4A300]"
              data-testid={`ai-coba-lagi-${variant}`}
            >
              Coba lagi
            </button>
          )}
        </div>
      </div>
    )
  }

  const teksStatus = selesai
    ? `${judul.success}.`
    : `Tahap ${aktif + 1} dari ${tahap.length}: ${lambat && aktif === tahap.length - 1 ? 'masih berjalan' : tahap[aktif].label}.`
  const catatan = lambat
    ? 'Proses masih berjalan dan bisa memakan waktu sampai 2 menit. Anda boleh menunggu atau membatalkan.'
    : !selesai && tahap[aktif]?.catatan
    ? tahap[aktif].catatan
    : ''

  return (
    <div className={`ai-gerak flex flex-col gap-4 ${compact ? 'p-4' : ''}`} data-testid={`ai-loading-${variant}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#142B4A]">
          {selesai && <CheckCircle2 className="h-5 w-5 text-[#10B981]" aria-hidden="true" />}
          {selesai ? judul.success : judul.running}
        </p>
        <span className="shrink-0 text-xs tabular-nums text-[#64748B]">
          {selesai ? `Selesai dalam ${elapsedSeconds} detik` : `Sudah ${elapsedSeconds} detik`}
        </span>
      </div>

      {variant === 'narasi' ? <VisualNarasi selesai={selesai} /> : <VisualRps detik={elapsedSeconds} selesai={selesai} />}

      <ol className="space-y-1.5" aria-hidden="true">
        {tahap.map((t, i) => {
          const done = i < aktif
          const jalan = i === aktif && !selesai
          const label = jalan && lambat && i === tahap.length - 1 ? 'Masih berjalan, bisa sampai 2 menit' : t.label
          return (
            <li key={t.label} className="flex min-h-[1.25rem] items-start gap-2 text-xs leading-snug">
              <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                ) : jalan ? (
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[#F4A300]">
                    <span className="h-1.5 w-1.5 animate-denyut rounded-full bg-[#F4A300]" />
                  </span>
                ) : (
                  <Circle className="h-3.5 w-3.5 text-[#CBD5E1]" />
                )}
              </span>
              <span className={done ? 'text-[#64748B]' : jalan ? 'font-semibold text-[#142B4A]' : 'text-[#94A3B8]'}>{label}</span>
            </li>
          )
        })}
      </ol>

      {/* Tinggi tetap supaya tata letak tidak bergeser saat catatan berganti */}
      <p className="min-h-[2rem] text-[11px] leading-snug text-[#64748B]">{catatan}</p>

      <div className="flex items-center justify-between gap-3 border-t border-[#E2E8F0] pt-3">
        <p className="text-[11px] text-[#94A3B8]">Estimasi tahapan berdasarkan waktu; hasil tampil begitu selesai.</p>
        {onCancel && !selesai && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#EF4444] hover:text-[#B91C1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A3A6B]"
            data-testid={`ai-batal-${variant}`}
          >
            Batalkan
          </button>
        )}
      </div>

      {/* Teks untuk pembaca layar; animasi di atas bersifat dekoratif */}
      <p className="sr-only" role="status" aria-live="polite">
        {teksStatus} {lambat ? 'Proses masih berjalan dan bisa memakan waktu sampai 2 menit.' : ''}
      </p>
    </div>
  )
}
