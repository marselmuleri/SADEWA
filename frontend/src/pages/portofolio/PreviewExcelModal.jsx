import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Loader2, MinusCircle, RefreshCw } from 'lucide-react'
import Modal from '../../components/Modal'
import { ActionButton } from '../../components/PageChrome'
import api from '../../services/api'
import { getApiErrorMessage } from '../superAdminHelpers'
import { blobErrorMessage, formatNilai, unduhExcelPortofolio } from './portofolioShared'

const STATUS = {
  lengkap: { icon: CheckCircle2, warna: 'text-emerald-600', label: 'Lengkap' },
  perlu_dilengkapi: { icon: AlertTriangle, warna: 'text-amber-600', label: 'Perlu dilengkapi' },
  kosong: { icon: MinusCircle, warna: 'text-[#94A3B8]', label: 'Belum ada data' },
}

function Angka({ label, value, caption }) {
  return (
    <div className="rounded-[6px] border border-[#E2E8F0] bg-white px-3 py-2.5">
      <div className="text-[11px] font-semibold text-[#64748B]">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums text-[#142B4A]">{value}</div>
      {caption && <div className="text-[11px] text-[#94A3B8]">{caption}</div>}
    </div>
  )
}

// Ringkasan isi file Excel portofolio; pengguna meninjau dulu lalu mengonfirmasi unduhan.
export default function PreviewExcelModal({ mk, onClose, pushToast }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mengunduh, setMengunduh] = useState(false)
  const [ulang, setUlang] = useState(0)

  useEffect(() => {
    if (!mk) return undefined
    let aktif = true
    setData(null)
    setError(null)
    setLoading(true)
    api
      .get(`/portofolio/${mk.id}/export/preview`)
      .then((res) => aktif && setData(res.data))
      .catch((err) => aktif && setError(getApiErrorMessage(err, 'Gagal menyiapkan ringkasan file Excel')))
      .finally(() => aktif && setLoading(false))
    return () => {
      aktif = false
    }
  }, [mk, ulang])

  const unduh = async () => {
    setMengunduh(true)
    try {
      await unduhExcelPortofolio(mk)
      pushToast?.('File Excel portofolio diunduh')
      onClose()
    } catch (err) {
      pushToast?.(await blobErrorMessage(err, 'Gagal membuat file Excel'), 'error')
    } finally {
      setMengunduh(false)
    }
  }

  const r = data?.ringkasan
  const sebaran = Object.entries(r?.sebaran_huruf || {})

  return (
    <Modal
      open={Boolean(mk)}
      title="Tinjau Isi Excel Portofolio"
      onClose={onClose}
      size="max-w-3xl"
      dismissible={!mengunduh}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
          Menyiapkan ringkasan isi file...
        </div>
      ) : error ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-[6px] border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex justify-end gap-2">
            <ActionButton variant="secondary" onClick={onClose}>Tutup</ActionButton>
            <ActionButton variant="secondary" onClick={() => setUlang((n) => n + 1)}>
              <RefreshCw className="h-4 w-4" />Coba lagi
            </ActionButton>
          </div>
        </div>
      ) : data ? (
        <div className="space-y-5" data-testid="preview-excel-portofolio">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#142B4A]">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-700" />
              <span className="break-all">{data.nama_file}</span>
            </div>
            <p className="mt-1 text-xs text-[#64748B]">
              {data.mata_kuliah.kode} · {data.mata_kuliah.nama} · {data.mata_kuliah.sks} SKS
              {data.mata_kuliah.pengampu.length > 0 && ` · ${data.mata_kuliah.pengampu.join(', ')}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Angka label="Mahasiswa dinilai" value={`${r.jumlah_dinilai}/${r.jumlah_mahasiswa}`} />
            <Angka label="Rata-rata nilai akhir" value={formatNilai(r.rata_rata_nilai_akhir)} />
            <Angka label="CPMK memenuhi target" value={`${r.cpmk_memenuhi}/${r.jumlah_cpmk}`} />
            <Angka label="Perlu remidi CPMK" value={r.jumlah_remidi} caption="mahasiswa" />
          </div>

          {sebaran.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="mr-1 font-semibold text-[#64748B]">Sebaran nilai huruf:</span>
              {sebaran.map(([huruf, n]) => (
                <span key={huruf} className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 tabular-nums text-[#142B4A]">
                  <strong>{huruf}</strong> {n}
                </span>
              ))}
            </div>
          )}

          {data.jumlah_perlu_dilengkapi > 0 && (
            <div className="flex items-start gap-2 rounded-[6px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {data.jumlah_perlu_dilengkapi} sheet belum lengkap. File tetap bisa diunduh; bagian yang belum diisi
                ditandai kuning di Excel.
              </span>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6D778E]">
              Isi file ({data.sheets.length} sheet)
            </h4>
            <ul className="divide-y divide-[#E2E8F0] rounded-[6px] border border-[#E2E8F0]">
              {data.sheets.map((s) => {
                const st = STATUS[s.status] || STATUS.lengkap
                const Icon = st.icon
                return (
                  <li key={s.nama} className="flex items-start gap-3 px-3 py-2.5">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${st.warna}`} aria-label={st.label} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono text-xs font-bold text-[#1A3A6B]">{s.nama}</span>
                        <span className="text-xs text-[#142B4A]">{s.isi}</span>
                      </div>
                      {s.catatan.map((c) => (
                        <div key={c} className="mt-0.5 text-[11px] text-amber-700">{c}</div>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-[11px] text-[#94A3B8]">
              Angka di atas dihitung oleh SADEWA. Di file Excel, nilai akhir, huruf, dan capaian berupa rumus yang
              dihitung otomatis saat file dibuka.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:justify-end">
            <ActionButton variant="secondary" onClick={onClose} disabled={mengunduh} data-testid="preview-excel-kembali">
              <ArrowLeft className="h-4 w-4" />Kembali
            </ActionButton>
            <ActionButton onClick={unduh} disabled={mengunduh} data-testid="preview-excel-unduh">
              {mengunduh ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {mengunduh ? 'Menyiapkan Excel...' : 'Unduh Excel'}
            </ActionButton>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
