import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Circle, FileText, Lightbulb, MinusCircle } from 'lucide-react'
import { SadewaLoader } from './brand/SadewaLogo'
import { BATAS_LAMBAT, JUDUL, formatDurasi, labelTahapAktif, namaMk, statusTahap } from '../utils/aiJob'
import { parsePartialJson } from '../utils/partialJson'
import { TIPS, TIPS_TAHAP } from '../data/tipsObe'
import { useDetikSejak } from '../hooks/useAiJobs'

// Tampilan proses AI (Generate RPS / Narasi).
// Selama menunggu, dosen melihat: tahap yang benar-benar sedang berjalan, draf yang sedang ditulis
// AI (pratinjau langsung), data dan pedoman yang dipakai, serta tips OBE yang berganti.
// Bila backend belum mendukung streaming, tahap diperkirakan dari waktu dan pratinjau disimulasikan.

const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6D778E]'
const angka = (n, d = 1) => Number(n ?? 0).toLocaleString('id-ID', { maximumFractionDigits: d })

// ---------------------------------------------------------------------------
// Pratinjau draf
// ---------------------------------------------------------------------------

function PratinjauRps({ data, detik, mode, selesai }) {
  const pertemuan = Array.isArray(data?.pertemuan) ? data.pertemuan.filter((p) => p && p.minggu) : []
  // Pertemuan terakhir mungkin masih setengah jadi; hitung yang sudah punya bobot.
  const lengkap = pertemuan.filter((p) => p.bobot !== undefined && p.bobot !== null).length
  const terisi = selesai ? 16 : mode === 'stream' ? Math.min(16, lengkap) : Math.min(15, Math.floor(detik / 2.6) + 1)
  const terbaru = pertemuan.slice(-3).reverse()

  return (
    <div className="grid grid-cols-1 gap-4 min-[460px]:grid-cols-[auto_1fr]">
      <div className="grid grid-cols-4 gap-1.5 justify-self-center" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => {
          const no = i + 1
          const isi = no <= terisi
          const baru = isi && no === terisi && !selesai
          const label = no === 8 ? 'UTS' : no === 16 ? 'UAS' : no
          return (
            <div
              key={no}
              className={`flex h-9 w-9 items-center justify-center rounded-[5px] border text-[10px] font-semibold tabular-nums transition-colors duration-500 ${
                baru
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
      <div className="min-w-0 space-y-2">
        {mode === 'stream' && data?.kode_mk ? (
          <p className="truncate text-xs text-[#64748B]">
            <span className="font-semibold text-[#142B4A]">{data.kode_mk}</span>
            {data.cpmk?.length ? ` · ${data.cpmk.length} CPMK dirumuskan` : ''}
          </p>
        ) : null}
        {mode === 'stream' && terbaru.length ? (
          <ul className="space-y-1.5" aria-label="Pertemuan yang baru ditulis">
            {terbaru.map((p) => (
              <li key={p.minggu} className="animate-sel-isi rounded-[6px] border border-[#E2E8F0] bg-white px-2.5 py-1.5">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="shrink-0 rounded-[4px] bg-[#1A3A6B] px-1.5 py-0.5 font-semibold tabular-nums text-white">
                    Minggu {p.minggu}
                  </span>
                  {p.jenis === 'UTS' || p.jenis === 'UAS' ? (
                    <span className="truncate text-[#64748B]">{p.jenis}</span>
                  ) : Array.isArray(p.target_cpmk) && p.target_cpmk.length ? (
                    <span className="truncate text-[#64748B]">{p.target_cpmk.join(', ')}</span>
                  ) : p.cpmk && p.cpmk !== '-' ? (
                    <span className="truncate text-[#64748B]">{p.cpmk}</span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-[#142B4A]">
                  {p.jenis === 'UTS' ? 'Ujian Tengah Semester' : p.jenis === 'UAS' ? 'Ujian Akhir Semester'
                    : p.bahan_kajian_judul || p.materi || '…'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2 rounded-[6px] border border-dashed border-[#CBD5E1] p-3" aria-hidden="true">
            {['92%', '78%', '86%', '64%'].map((w, i) => (
              <div key={i} className="ai-kilau h-1.5 animate-kilau rounded-full" style={{ width: w, animationDelay: `${i * 0.15}s` }} />
            ))}
            <p className="pt-1 text-[11px] text-[#94A3B8]">
              {mode === 'stream' ? 'Pertemuan akan muncul di sini begitu AI mulai menulis.' : 'Draf tampil setelah selesai.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function PratinjauNarasi({ data, mode }) {
  const ringkasan = typeof data?.ringkasan_capaian === 'string' ? data.ringkasan_capaian : ''
  const analisis = Array.isArray(data?.analisis_cpl) ? data.analisis_cpl.filter((a) => a?.kode) : []
  const rekomendasi = Array.isArray(data?.rekomendasi_intervensi) ? data.rekomendasi_intervensi.filter((r) => r?.sasaran) : []

  if (mode !== 'stream' || !ringkasan) {
    return (
      <div className="space-y-2 rounded-[6px] border border-dashed border-[#CBD5E1] p-3" aria-hidden="true">
        {['96%', '88%', '93%', '70%'].map((w, i) => (
          <div key={i} className="ai-kilau h-2 animate-kilau rounded-full" style={{ width: w, animationDelay: `${i * 0.15}s` }} />
        ))}
        <p className="pt-1 text-[11px] text-[#94A3B8]">
          {mode === 'stream' ? 'Ringkasan akan muncul di sini begitu AI mulai menulis.' : 'Narasi tampil setelah selesai.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5 rounded-[6px] border border-[#E2E8F0] bg-white p-3">
      <p className="text-xs leading-relaxed text-[#142B4A]">
        {ringkasan}
        <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-denyut bg-[#F4A300]" aria-hidden="true" />
      </p>
      {analisis.length ? (
        <div className="flex flex-wrap gap-1.5">
          {analisis.map((a) => (
            <span
              key={a.kode}
              className={`animate-sel-isi rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold ${
                a.status === 'Tercapai'
                  ? 'border-[#10B981]/40 bg-[#ECFDF5] text-[#047857]'
                  : a.status
                  ? 'border-[#F4A300]/50 bg-[#FFF4D6] text-[#7A5200]'
                  : 'border-[#E2E8F0] bg-[#F2F4F7] text-[#64748B]'
              }`}
            >
              {a.kode}
              {a.status ? ` · ${a.status}` : ''}
            </span>
          ))}
        </div>
      ) : null}
      {rekomendasi.length ? (
        <p className="text-[11px] text-[#64748B]">{rekomendasi.length} rekomendasi intervensi disusun</p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Konteks: data dan pedoman yang dipakai AI
// ---------------------------------------------------------------------------

function DataCapaian({ capaian }) {
  const list = (Array.isArray(capaian) ? capaian : []).filter((c) => c && c.kode)
  if (!list.length) return null
  const terurut = [...list].sort((a, b) => (a.nilai_rata_rata ?? 0) - (b.nilai_rata_rata ?? 0))
  const terendah = terurut[0]
  const tampil = terurut.slice(0, 4)
  return (
    <div className="space-y-2">
      <p className="text-xs text-[#142B4A]">
        Menganalisis <span className="font-semibold">{list.length} capaian</span>. Terendah:{' '}
        <span className="font-semibold">{terendah.kode}</span>, rata-rata {angka(terendah.nilai_rata_rata)}
        {terendah.jumlah_mahasiswa
          ? `; ${terendah.jumlah_tercapai ?? 0} dari ${terendah.jumlah_mahasiswa} mahasiswa tercapai`
          : ''}
        .
      </p>
      <ul className="space-y-1.5">
        {tampil.map((c) => {
          const nilai = Math.max(0, Math.min(100, Number(c.nilai_rata_rata) || 0))
          return (
            <li key={c.kode} className="grid grid-cols-[72px_1fr_36px] items-center gap-2 text-[11px]">
              <span className="truncate font-semibold text-[#142B4A]">{c.kode}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-[#F2F4F7]">
                <span
                  className={`block h-full rounded-full ${c === terendah ? 'bg-[#F4A300]' : 'bg-[#1A3A6B]'}`}
                  style={{ width: `${nilai}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-[#64748B]">{angka(c.nilai_rata_rata)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SumberPedoman({ sumber, compact }) {
  const list = (Array.isArray(sumber) ? sumber : []).slice(0, compact ? 2 : 3)
  if (!list.length) return null
  return (
    <ul className="space-y-1.5">
      {list.map((s, i) => (
        <li key={`${s.file}-${s.page}-${i}`} className="flex gap-2 text-[11px]">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1A3A6B]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#142B4A]">
              {s.file}
              {s.page ? <span className="font-normal text-[#64748B]"> · hal. {s.page}</span> : null}
            </p>
            {s.snippet ? <p className="line-clamp-2 leading-snug text-[#64748B]">“{s.snippet}”</p> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

function Konteks({ job, compact }) {
  const info = job.info || {}
  const mk = info.mata_kuliah || job.mk || {}
  const adaSumber = Array.isArray(job.sumber) && job.sumber.length > 0
  const capaian = job.jenis === 'narasi' ? info.capaian : null
  if (job.mode !== 'stream' && !mk.nama) return null

  return (
    <section className="space-y-2.5 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-3" aria-label="Data yang dipakai AI">
      <p className={LABEL}>Yang dipakai AI</p>
      <p className="text-xs text-[#142B4A]">
        <span className="font-semibold">{namaMk(mk)}</span>
        {mk.sks ? ` · ${mk.sks} SKS` : ''}
        {mk.semester ? ` · ${mk.semester}` : ''}
        {info.topik ? (
          <>
            {' '}
            · fokus <span className="font-semibold">“{info.topik}”</span>
          </>
        ) : null}
      </p>
      {capaian ? <DataCapaian capaian={capaian} /> : null}
      {adaSumber ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-[#64748B]">Potongan pedoman yang dibaca:</p>
          <SumberPedoman sumber={job.sumber} compact={compact} />
        </div>
      ) : job.mode === 'stream' && job.status === 'running' ? (
        <p className="text-[11px] text-[#94A3B8]">Mencari potongan pedoman yang relevan…</p>
      ) : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Tips OBE bergantian
// ---------------------------------------------------------------------------

function TipObe({ jenis, tahapAktif, aktif }) {
  const daftar = TIPS[jenis] || TIPS.rps
  const [urutan, setUrutan] = useState(() => Math.floor(Math.random() * daftar.length))
  const [tahapDitampilkan, setTahapDitampilkan] = useState(null)

  // Saat tahap berganti: tampilkan tips khusus tahap itu bila ada; bila tidak, lanjut ke tips umum
  // supaya tips tahap sebelumnya tidak tertinggal.
  useEffect(() => {
    if (!tahapAktif) return
    setTahapDitampilkan(TIPS_TAHAP[tahapAktif] ? tahapAktif : null)
  }, [tahapAktif])

  useEffect(() => {
    if (!aktif) return undefined
    const id = setInterval(() => {
      setTahapDitampilkan(null)
      setUrutan((n) => (n + 1) % daftar.length)
    }, 8000)
    return () => clearInterval(id)
  }, [aktif, daftar.length])

  const teks = tahapDitampilkan ? TIPS_TAHAP[tahapDitampilkan] : daftar[urutan]
  return (
    <aside className="flex gap-2.5 rounded-[6px] border border-[#F4A300]/30 bg-[#FFFBEB] p-3" aria-label="Tips OBE">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" aria-hidden="true" />
      <div className="min-w-0">
        <p className={LABEL}>Tips OBE</p>
        <p key={teks} className="mt-1 animate-sel-isi text-xs leading-relaxed text-[#142B4A]">
          {teks}
        </p>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------

function DaftarTahap({ tahap, lambat }) {
  return (
    <ol className="space-y-1.5" aria-hidden="true">
      {tahap.map((t, i) => {
        const terakhir = i === tahap.length - 1
        const label = t.status === 'jalan' && lambat && terakhir ? 'Masih berjalan, bisa sampai 2 menit' : t.label
        return (
          <li key={t.id} className="flex min-h-[1.25rem] items-start gap-2 text-xs leading-snug">
            <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center">
              {t.status === 'selesai' ? (
                <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
              ) : t.status === 'jalan' ? (
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[#F4A300]">
                  <span className="h-1.5 w-1.5 animate-denyut rounded-full bg-[#F4A300]" />
                </span>
              ) : (
                <Circle className="h-3.5 w-3.5 text-[#CBD5E1]" />
              )}
            </span>
            <span className="min-w-0">
              <span
                className={
                  t.status === 'selesai'
                    ? 'text-[#64748B]'
                    : t.status === 'jalan'
                    ? 'font-semibold text-[#142B4A]'
                    : 'text-[#94A3B8]'
                }
              >
                {label}
              </span>
              {t.detail ? <span className="block text-[11px] text-[#64748B]">{t.detail}</span> : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function AiLoadingStage({ job, onCancel, onRetry, onClose, onBackground, compact = false }) {
  const detik = useDetikSejak(job?.mulaiPada, job?.selesaiPada)
  const draf = useMemo(() => parsePartialJson(job?.teks), [job?.teks])

  if (!job) return null
  const jenis = job.jenis
  const judul = JUDUL[jenis] || JUDUL.rps
  const selesai = job.status === 'success'
  const berjalan = job.status === 'running'
  const lambat = berjalan && detik >= BATAS_LAMBAT
  const tahap = statusTahap(job, detik)

  if (job.status === 'error') {
    return (
      <div className={`flex flex-col items-start gap-3 ${compact ? 'p-4' : 'py-2'}`} role="alert" data-testid={`ai-error-${jenis}`}>
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#EF4444]" />
          <div>
            <p className="text-sm font-semibold text-[#142B4A]">{judul.error}</p>
            <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{job.error || 'Terjadi kesalahan yang tidak diketahui.'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 self-end">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A3A6B]"
              data-testid={`ai-tutup-${jenis}`}
            >
              Tutup
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-[6px] bg-[#1A3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4A300]"
              data-testid={`ai-coba-lagi-${jenis}`}
            >
              Coba lagi
            </button>
          )}
        </div>
      </div>
    )
  }

  const catatanEstimasi = !selesai && job.mode !== 'stream' ? tahap.find((t) => t.status === 'jalan')?.catatan : ''
  const pratinjau =
    jenis === 'narasi' ? (
      <PratinjauNarasi data={draf} mode={job.mode} />
    ) : (
      <PratinjauRps data={draf} detik={detik} mode={job.mode} selesai={selesai} />
    )

  return (
    <div className={`ai-gerak flex flex-col gap-4 ${compact ? 'p-4' : ''}`} data-testid={`ai-loading-${jenis}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {selesai ? (
            <CheckCircle2 className="h-7 w-7 shrink-0 text-[#10B981]" aria-hidden="true" />
          ) : (
            <SadewaLoader size={compact ? 28 : 34} className="shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#142B4A]">{selesai ? judul.success : judul.running}</p>
            {job.mk ? <p className="truncate text-[11px] text-[#64748B]">{namaMk(job.mk)}</p> : null}
          </div>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-[#64748B]">
          {selesai ? `Selesai dalam ${formatDurasi(detik)}` : `Sudah ${formatDurasi(detik)}`}
        </span>
      </div>

      {job.percobaan > 1 && berjalan && job.pelanggaran?.length ? (
        <div className="flex gap-2 rounded-[6px] border border-[#F4A300]/40 bg-[#FFFBEB] p-2.5 text-[11px] text-[#7A5200]" role="note">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              Draf sebelumnya belum lolos aturan OBE ({job.pelanggaran.length} pelanggaran). AI sedang memperbaikinya.
            </p>
            <p className="mt-0.5 line-clamp-2">{job.pelanggaran.slice(0, 2).join(' ')}</p>
          </div>
        </div>
      ) : null}

      <div className={compact ? 'flex flex-col gap-4' : 'grid gap-4 md:grid-cols-[minmax(0,1fr)_230px]'}>
        <section className="min-w-0 space-y-2" aria-label="Pratinjau draf">
          <p className={LABEL}>{jenis === 'narasi' ? 'Narasi yang sedang ditulis' : 'Draf yang sedang ditulis'}</p>
          {pratinjau}
        </section>
        <section className="space-y-2" aria-label="Tahapan proses">
          <p className={LABEL}>Tahapan</p>
          <DaftarTahap tahap={tahap} lambat={lambat} />
        </section>
      </div>

      <div className={compact ? 'flex flex-col gap-3' : 'grid gap-3 md:grid-cols-2'}>
        <Konteks job={job} compact={compact} />
        {!selesai ? <TipObe jenis={jenis} tahapAktif={job.tahapAktif} aktif={berjalan} /> : null}
      </div>

      {lambat || catatanEstimasi ? (
        <p className="text-[11px] leading-snug text-[#64748B]">
          {lambat
            ? 'Proses masih berjalan dan bisa memakan waktu sampai 2 menit. Anda bisa melanjutkan pekerjaan lain dengan menjalankannya di latar belakang.'
            : catatanEstimasi}
        </p>
      ) : null}

      {berjalan ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-3">
          <p className="text-[11px] text-[#94A3B8]">
            {job.mode === 'stream'
              ? 'Hasil tersimpan otomatis sebagai draf begitu selesai.'
              : 'Estimasi tahapan berdasarkan waktu; hasil tampil begitu selesai.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="shrink-0 rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#EF4444] hover:text-[#B91C1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A3A6B]"
                data-testid={`ai-batal-${jenis}`}
              >
                Batalkan
              </button>
            )}
            {onBackground && (
              <button
                type="button"
                onClick={onBackground}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4A300]"
                data-testid={`ai-latar-${jenis}`}
              >
                <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Jalankan di latar belakang
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Teks untuk pembaca layar; animasi di atas bersifat dekoratif */}
      <p className="sr-only" role="status" aria-live="polite">
        {selesai ? `${judul.success}.` : `${labelTahapAktif(job, detik)}.`}
        {lambat ? ' Proses masih berjalan dan bisa memakan waktu sampai 2 menit.' : ''}
      </p>
    </div>
  )
}
