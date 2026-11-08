import { Outlet, useLocation } from 'react-router-dom'
import { AlertTriangle, Info, RefreshCw } from 'lucide-react'
import { PageHeader } from '../../components/PageChrome'
import useDataMaster from '../../hooks/useDataMaster'
import useAuth from '../../hooks/useAuth'

const sectionMeta = {
  kurikulum: {
    title: 'Versi Kurikulum',
    description: 'Tinjau versi kurikulum dan status penerbitannya pada program studi Anda.',
  },
  cpl: {
    title: 'CPL',
    description: 'Tinjau Capaian Pembelajaran Lulusan yang menjadi dasar struktur OBE.',
  },
  ik: {
    title: 'IK',
    description: 'Tinjau Indikator Kinerja yang menguraikan setiap Capaian Pembelajaran Lulusan.',
  },
  cpmk: {
    title: 'CPMK',
    description: 'Tinjau Capaian Pembelajaran Mata Kuliah dan akumulasi bobotnya.',
  },
  arsip: {
    title: 'Arsip Kurikulum',
    description: 'Tinjau data kurikulum yang sudah fix dipakai per versi kurikulum dan per semester.',
  },
}

export default function DataMasterLayout() {
  const { user, activeRole } = useAuth()
  const location = useLocation()
  const pathSection = location.pathname.split('/').filter(Boolean).at(-1)
  const legacySection = new URLSearchParams(location.search).get('tab')
  const section = sectionMeta[pathSection] ? pathSection : legacySection
  const activeSection = sectionMeta[section] ? section : 'kurikulum'
  const data = useDataMaster(activeSection)
  const { loading, error, reload } = data
  const meta = sectionMeta[activeSection]
  const currentRole = activeRole || user?.role || ''
  const isSingleProdiRole = ['admin_prodi', 'kaprodi', 'dosen'].includes(currentRole)
  const scopeDescription = isSingleProdiRole
    ? `Tinjau ${meta.title} pada program studi Anda.`
    : currentRole === 'dekan'
    ? `Tinjau ${meta.title} pada seluruh program studi di fakultas Anda.`
    : meta.description
  const scopeBanner = isSingleProdiRole
    ? 'Data yang ditampilkan berada dalam lingkup program studi Anda.'
    : currentRole === 'dekan'
    ? 'Data yang ditampilkan berada dalam lingkup fakultas Anda.'
    : ''

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DATA MASTER AKADEMIK"
        title={meta.title}
        description={scopeDescription}
        badge="Mode Lihat Saja"
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            data-testid="btn-reload-datamaster"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#142B4A] shadow-sm transition-colors hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A3A6B] focus-visible:ring-offset-2 disabled:opacity-50"
            title={`Muat ulang data ${meta.title}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#1A3A6B]' : 'text-[#64748B]'}`} />
            <span>Muat Ulang Data</span>
          </button>
        }
      />

      <div className="flex items-start gap-3 rounded-lg border border-[#CBD5E1]/80 bg-[#F8FAFC] p-4 text-xs leading-relaxed text-[#64748B]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1A3A6B]" />
        <div>
          <span className="font-semibold text-[#142B4A]">Informasi Halaman: </span>
          Halaman Data Master ini berstatus <span className="font-semibold text-[#142B4A]">Hanya-Lihat (View-Only)</span> untuk peninjauan entitas master kurikulum dan hierarki OBE. {scopeBanner} Penambahan, pengubahan, atau penghapusan dikelola melalui menu <span className="font-medium text-[#1A3A6B]">Kurikulum OBE</span> oleh pengguna berwenang.
        </div>
      </div>

      {error && !loading ? (
        <div data-testid="datamaster-error-banner" className="flex flex-col justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0 text-red-600" /><span className="font-medium">{error}</span></div>
          <button type="button" onClick={reload} className="inline-flex self-start rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 sm:self-auto">Coba Lagi</button>
        </div>
      ) : null}

      <Outlet context={{ section: activeSection, data }} />
    </div>
  )
}
