import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, FileSpreadsheet, Loader2 } from 'lucide-react'
import { ActionButton, Badge, PageHeader } from '../../components/PageChrome'
import ToastContainer from '../../components/ToastContainer'
import useAuth from '../../hooks/useAuth'
import useToast from '../../hooks/useToast'
import api from '../../services/api'
import { getApiErrorMessage } from '../superAdminHelpers'
import BerkasSection from './BerkasSection'
import RppSection from './RppSection'
import EvaluasiSection from './EvaluasiSection'
import InfoSection from './InfoSection'
import { GrafikCapaianSection, NilaiCpSection, SebaranNilaiSection } from './CapaianSections'
import { PORTOFOLIO_SECTIONS, blobErrorMessage, sectionLabel, unduhExcelPortofolio } from './portofolioShared'

const SECTION_CAPAIAN = ['nilai-cp', 'grafik', 'sebaran']

export default function PortofolioDetailPage() {
  const { mkId, section } = useParams()
  const { user, activeRole } = useAuth()
  const role = activeRole || user?.role
  const { toasts, pushToast } = useToast()

  const [mk, setMk] = useState(null)
  const [mkError, setMkError] = useState(null)
  const [capaian, setCapaian] = useState(null)
  const [capaianError, setCapaianError] = useState(null)
  const [loadingCapaian, setLoadingCapaian] = useState(false)
  const [exporting, setExporting] = useState(false)

  const exportExcel = async () => {
    setExporting(true)
    try {
      await unduhExcelPortofolio(mk)
      pushToast('File Excel portofolio diunduh')
    } catch (err) {
      pushToast(await blobErrorMessage(err, 'Gagal membuat file Excel'), 'error')
    } finally {
      setExporting(false)
    }
  }

  const muatMk = useCallback(async () => {
    try {
      const res = await api.get('/portofolio/mata-kuliah')
      const found = (res.data || []).find((m) => String(m.id) === String(mkId))
      if (!found) {
        setMkError('Mata kuliah tidak ditemukan atau di luar wewenang Anda.')
        return
      }
      setMk(found)
      setMkError(null)
    } catch (err) {
      setMkError(getApiErrorMessage(err, 'Gagal memuat mata kuliah'))
    }
  }, [mkId])

  useEffect(() => {
    setMk(null)
    setCapaian(null)
    muatMk()
  }, [muatMk])

  const butuhCapaian = SECTION_CAPAIAN.includes(section)
  useEffect(() => {
    if (!butuhCapaian || capaian) return
    let aktif = true
    setLoadingCapaian(true)
    setCapaianError(null)
    api
      .get(`/portofolio/${mkId}/capaian`)
      .then((res) => aktif && setCapaian(res.data))
      .catch((err) => aktif && setCapaianError(getApiErrorMessage(err, 'Gagal memuat data capaian')))
      .finally(() => aktif && setLoadingCapaian(false))
    return () => {
      aktif = false
    }
  }, [butuhCapaian, capaian, mkId])

  const aktif = PORTOFOLIO_SECTIONS.find((s) => s.id === section)
  if (!aktif) return <Navigate to={`/portofolio/${mkId}/rps`} replace />

  const canWrite = role === 'dosen' && Boolean(mk?.is_pengampu)

  const renderIsi = () => {
    if (!mk) return null
    if (section === 'rps' || section === 'lampiran') {
      return <BerkasSection key={section} mkId={mk.id} jenis={section} canWrite={canWrite} pushToast={pushToast} onChanged={muatMk} />
    }
    if (section === 'rpp') {
      return <RppSection mkId={mk.id} canWrite={canWrite} pushToast={pushToast} onChanged={muatMk} />
    }
    if (section === 'evaluasi') {
      return <EvaluasiSection mkId={mk.id} canWrite={canWrite} pushToast={pushToast} />
    }
    if (section === 'info') {
      return <InfoSection mkId={mk.id} canWrite={canWrite} pushToast={pushToast} />
    }
    if (capaianError) {
      return (
        <div className="flex items-center gap-2 rounded-[6px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {capaianError}
        </div>
      )
    }
    if (loadingCapaian || !capaian) {
      return (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat data capaian...
        </div>
      )
    }
    if (section === 'nilai-cp') return <NilaiCpSection data={capaian} />
    if (section === 'grafik') return <GrafikCapaianSection data={capaian} />
    return <SebaranNilaiSection data={capaian} />
  }

  return (
    <div className="space-y-6">
      <Link to="/portofolio" className="btn-kembali">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke daftar portofolio
      </Link>

      {mkError ? (
        <div className="flex items-center gap-2 rounded-[6px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {mkError}
        </div>
      ) : !mk ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat mata kuliah...
        </div>
      ) : (
        <>
          <PageHeader
            eyebrow={`Portofolio · ${mk.kode}`}
            title={mk.nama}
            description={`${mk.sks} SKS · ${mk.semester} ${mk.tahun_ajaran} · ${mk.jumlah_peserta} peserta · Pengampu: ${mk.pengampu?.join(', ') || '-'}`}
            badge={canWrite ? undefined : 'Mode Lihat'}
            actions={
              <ActionButton onClick={exportExcel} disabled={exporting} data-testid="portofolio-export-excel">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                {exporting ? 'Menyiapkan Excel...' : 'Export Excel'}
              </ActionButton>
            }
          />

          <nav className="flex flex-wrap gap-1 border-b border-[#E2E8F0]" aria-label="Menu portofolio">
            {PORTOFOLIO_SECTIONS.map((s) => {
              const Icon = s.icon
              const isActive = s.id === section
              return (
                <Link
                  key={s.id}
                  to={`/portofolio/${mkId}/${s.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'border-[#F4A300] text-[#142B4A]'
                      : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {sectionLabel(s, canWrite)}
                  {s.id === 'rps' && mk.jumlah_rps === 0 ? <Badge tone="warning">Belum</Badge> : null}
                </Link>
              )
            })}
          </nav>

          {renderIsi()}
        </>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}
