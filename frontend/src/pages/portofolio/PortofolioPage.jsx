import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, FileSpreadsheet, Loader2, RefreshCw, Search } from 'lucide-react'
import { ActionButton, PageHeader, SectionCard } from '../../components/PageChrome'
import ProdiSelector from '../../components/ProdiSelector'
import ToastContainer from '../../components/ToastContainer'
import { useDekanScope } from '../../context/DekanScopeContext'
import useAuth from '../../hooks/useAuth'
import useToast from '../../hooks/useToast'
import api from '../../services/api'
import { getApiErrorMessage } from '../superAdminHelpers'
import { PORTOFOLIO_SECTIONS, blobErrorMessage, sectionLabel, unduhExcelPortofolio } from './portofolioShared'

function Kelengkapan({ mk }) {
  const items = [
    { label: 'RPS', ok: mk.jumlah_rps > 0, text: mk.jumlah_rps > 0 ? 'Ada' : 'Belum' },
    { label: 'RPP', ok: mk.jumlah_rpp > 0, text: `${mk.jumlah_rpp} pertemuan` },
    { label: 'Lampiran', ok: mk.jumlah_lampiran > 0, text: `${mk.jumlah_lampiran} berkas` },
    { label: 'Nilai', ok: mk.jumlah_dinilai > 0, text: `${mk.jumlah_dinilai}/${mk.jumlah_peserta} mhs` },
  ]
  return (
    <ul className="space-y-1 text-xs">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.ok ? 'bg-emerald-500' : 'bg-[#CBD5E1]'}`} />
          <span className="w-16 text-[#64748B]">{it.label}</span>
          <span className={it.ok ? 'font-medium text-[#142B4A]' : 'text-[#94A3B8]'}>{it.text}</span>
        </li>
      ))}
    </ul>
  )
}

export default function PortofolioPage() {
  const { user, activeRole } = useAuth()
  const role = activeRole || user?.role
  const isDekan = role === 'dekan'
  const { selectedProdiId } = useDekanScope()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cari, setCari] = useState('')
  const [semester, setSemester] = useState('')
  const [exportingId, setExportingId] = useState(null)
  const { toasts, pushToast } = useToast()

  const exportExcel = async (mk) => {
    setExportingId(mk.id)
    try {
      await unduhExcelPortofolio(mk)
    } catch (err) {
      pushToast(await blobErrorMessage(err, 'Gagal membuat file Excel'), 'error')
    } finally {
      setExportingId(null)
    }
  }

  const muat = useCallback(async () => {
    if (isDekan && !selectedProdiId) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = isDekan ? { program_studi_id: selectedProdiId } : undefined
      const res = await api.get('/portofolio/mata-kuliah', { params })
      setRows(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat daftar mata kuliah'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [isDekan, selectedProdiId])

  useEffect(() => {
    muat()
  }, [muat])

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return rows.filter((mk) => {
      if (semester && mk.semester !== semester) return false
      if (!q) return true
      return [mk.kode, mk.nama, ...(mk.pengampu || [])].some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [rows, cari, semester])

  const deskripsi =
    role === 'dosen'
      ? 'Kelola portofolio mata kuliah yang Anda ampu: unggah RPS, isi RPP, unggah lampiran, dan tinjau capaian pembelajaran.'
      : 'Pantau kelengkapan portofolio setiap mata kuliah beserta capaian CPMK, CPL, dan sebaran nilainya.'

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laporan Mata Kuliah"
        title="Portofolio"
        description={deskripsi}
        actions={
          <ActionButton variant="secondary" onClick={muat} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Muat ulang
          </ActionButton>
        }
      />

      <ProdiSelector />

      <SectionCard
        title="Daftar Mata Kuliah"
        description={`${tampil.length} dari ${rows.length} mata kuliah`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <input
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari kode, nama, pengampu"
                className="h-9 w-56 rounded-[6px] border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs focus:border-[#1A3A6B] focus:outline-none"
              />
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              aria-label="Filter semester"
              className="h-9 rounded-[6px] border border-[#CBD5E1] bg-white px-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            >
              <option value="">Semua semester</option>
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
        }
      >
        {error ? (
          <div className="flex items-center gap-2 rounded-[6px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-[#64748B]">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat mata kuliah...
          </div>
        ) : isDekan && !selectedProdiId ? (
          <p className="py-10 text-center text-sm text-[#64748B]">Pilih program studi terlebih dahulu.</p>
        ) : tampil.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#64748B]">
            {rows.length === 0
              ? role === 'dosen'
                ? 'Anda belum ditugaskan sebagai pengampu mata kuliah mana pun.'
                : 'Belum ada mata kuliah.'
              : 'Tidak ada mata kuliah yang cocok dengan pencarian.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm" data-testid="portofolio-table">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">
                  <th className="w-10 py-2.5 pr-3">No</th>
                  <th className="py-2.5 pr-3">Mata Kuliah</th>
                  <th className="py-2.5 pr-3">Pengampu</th>
                  <th className="py-2.5 pr-3">Kelengkapan</th>
                  <th className="py-2.5">Portofolio</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((mk, idx) => {
                  const canWrite = role === 'dosen' && mk.is_pengampu
                  return (
                    <tr key={mk.id} className="border-b border-[#EEF2F6] align-top last:border-0">
                      <td className="py-3 pr-3 text-[#64748B]">{idx + 1}</td>
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-[#142B4A]">{mk.nama}</div>
                        <div className="mt-0.5 text-xs text-[#64748B]">
                          {mk.kode} · {mk.sks} SKS · {mk.semester} {mk.tahun_ajaran}
                        </div>
                        {isDekan && mk.program_studi_nama ? (
                          <div className="mt-0.5 text-xs text-[#94A3B8]">{mk.program_studi_nama}</div>
                        ) : null}
                        <div className="mt-0.5 text-xs text-[#94A3B8]">{mk.jumlah_peserta} peserta</div>
                      </td>
                      <td className="py-3 pr-3 text-xs text-[#142B4A]">
                        {mk.pengampu?.length ? (
                          <ul className="space-y-0.5">
                            {mk.pengampu.map((n) => (
                              <li key={n}>{n}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-[#94A3B8]">-</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <Kelengkapan mk={mk} />
                      </td>
                      <td className="py-3">
                        <ul className="space-y-1">
                          {PORTOFOLIO_SECTIONS.map((s) => {
                            const Icon = s.icon
                            return (
                              <li key={s.id}>
                                <Link
                                  to={`/portofolio/${mk.id}/${s.id}`}
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1A3A6B] hover:text-[#F4A300] hover:underline"
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                  {sectionLabel(s, canWrite)}
                                </Link>
                              </li>
                            )
                          })}
                          <li className="pt-1">
                            <button
                              type="button"
                              onClick={() => exportExcel(mk)}
                              disabled={exportingId === mk.id}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                            >
                              {exportingId === mk.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                              )}
                              Unduh Excel
                            </button>
                          </li>
                        </ul>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
