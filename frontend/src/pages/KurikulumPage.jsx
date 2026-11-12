import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  BookOpen,
  Target,
  Layers,
  Loader2,
  Sliders,
  AlertCircle,
  Network,
  BarChart3,
} from 'lucide-react'
import { PageHeader, SectionCard, StatCard, Badge } from '../components/PageChrome'
import Modal from '../components/Modal'
import useAuth from '../hooks/useAuth'
import useToast from '../hooks/useToast'
import api from '../services/api'
import { getApiErrorMessage } from './superAdminHelpers'
import { useDekanScope } from '../context/DekanScopeContext'
import ProdiSelector from '../components/ProdiSelector'

export default function KurikulumPage() {
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()
  const { selectedProdiId } = useDekanScope()

  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isDekan = currentRole === 'dekan'
  const isKaprodi = currentRole === 'kaprodi'
  const isDosen = currentRole === 'dosen'
  const isAdminProdi = currentRole === 'admin_prodi'

  // Active view tab: 'cpl' | 'matrix'
  const [activeTab, setActiveTab] = useState('cpl')

  // Versions state
  const [versions, setVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [loadingVersions, setLoadingVersions] = useState(true)

  // Data states (Purely from backend, no mock demo fallbacks)
  const [cplList, setCplList] = useState([])
  const [ikList, setIkList] = useState([])
  const [mkList, setMkList] = useState([])
  const [cpmkList, setCpmkList] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [errorData, setErrorData] = useState(null)

  // Accordion state
  const [expandedCplIds, setExpandedCplIds] = useState(new Set())

  // Kaprodi Threshold Edit Modal
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false)
  const [targetCplForThreshold, setTargetCplForThreshold] = useState(null)
  const [thresholdValue, setThresholdValue] = useState('')
  const [thresholdSubmitting, setThresholdSubmitting] = useState(false)

  // 1. Fetch versions
  const fetchVersions = async () => {
    setLoadingVersions(true)
    setErrorData(null)
    try {
      const res = await api.get('/kurikulum/versions')
      let list = Array.isArray(res.data) ? res.data : []
      if (isDekan && selectedProdiId) {
        list = list.filter((v) => String(v.program_studi_id) === String(selectedProdiId))
      }
      setVersions(list)
      if (list.length > 0) {
        // Default: kurikulum aktif (yang dipakai Analitik OBE)
        setSelectedVersionId((list.find((v) => v.is_aktif) || list[0]).id)
      } else {
        setSelectedVersionId(null)
      }
    } catch (err) {
      setErrorData(getApiErrorMessage(err, 'Gagal memuat versi kurikulum'))
      setVersions([])
      setSelectedVersionId(null)
    } finally {
      setLoadingVersions(false)
    }
  }

  // 2. Fetch CPL, IK, MK, CPMK for selected version
  const fetchCurriculumData = async (versionId) => {
    if (!versionId) {
      setCplList([])
      setIkList([])
      setMkList([])
      setCpmkList([])
      return
    }

    setLoadingData(true)
    setErrorData(null)
    try {
      const [cplRes, ikRes, mkRes, cpmkRes] = await Promise.all([
        api.get('/cpl', { params: { kurikulum_version_id: versionId } }),
        api.get('/ik'),
        api.get('/mata-kuliah', { params: { kurikulum_version_id: versionId } }),
        api.get('/cpmk'),
      ])

      let fetchedCpl = Array.isArray(cplRes.data) ? cplRes.data : []
      let fetchedIk = Array.isArray(ikRes.data) ? ikRes.data : []
      let fetchedMk = Array.isArray(mkRes.data) ? mkRes.data : []
      let fetchedCpmk = Array.isArray(cpmkRes.data) ? cpmkRes.data : []

      if (isDekan && selectedProdiId) {
        fetchedCpl = fetchedCpl.filter((c) => String(c.program_studi_id) === String(selectedProdiId))
        fetchedMk = fetchedMk.filter((m) => String(m.program_studi_id) === String(selectedProdiId))
      }

      // Filter IK by matching CPL IDs
      const cplIdSet = new Set(fetchedCpl.map((c) => c.id))
      fetchedIk = fetchedIk.filter((ik) => cplIdSet.has(ik.cpl_id))

      // Filter CPMK by matching MK IDs
      const mkIdSet = new Set(fetchedMk.map((m) => m.id))
      fetchedCpmk = fetchedCpmk.filter((cpmk) => mkIdSet.has(cpmk.mata_kuliah_id))

      setCplList(fetchedCpl)
      setIkList(fetchedIk)
      setMkList(fetchedMk)
      setCpmkList(fetchedCpmk)

      if (fetchedCpl.length > 0) {
        setExpandedCplIds(new Set([fetchedCpl[0].id]))
      }
    } catch (err) {
      setErrorData(getApiErrorMessage(err, 'Gagal memuat data kurikulum OBE'))
      setCplList([])
      setIkList([])
      setMkList([])
      setCpmkList([])
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchVersions()
  }, [isDekan, selectedProdiId])

  useEffect(() => {
    if (selectedVersionId) {
      fetchCurriculumData(selectedVersionId)
    }
  }, [selectedVersionId])

  // Current version object
  const currentVersion = useMemo(() => {
    return versions.find((v) => v.id === selectedVersionId) || versions[0] || null
  }, [versions, selectedVersionId])

  // Kurikulum yang dipakai Analitik OBE prodi
  const activeVersion = useMemo(() => versions.find((v) => v.is_aktif) || null, [versions])

  // Accordion toggle
  const toggleCplAccordion = (id) => {
    setExpandedCplIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Kaprodi: Open Threshold Modal
  const handleOpenThresholdModal = (cpl) => {
    setTargetCplForThreshold(cpl)
    setThresholdValue(String(cpl.threshold_capaian || 70.0))
    setIsThresholdModalOpen(true)
  }

  // Kaprodi: Save Threshold
  const handleSaveThreshold = async (e) => {
    e.preventDefault()
    if (!targetCplForThreshold) return
    const num = Number(thresholdValue)
    if (Number.isNaN(num) || num < 0 || num > 100) {
      pushToast('Nilai threshold harus berupa angka antara 0 hingga 100', 'error')
      return
    }

    setThresholdSubmitting(true)
    try {
      await api.put(`/cpl/${targetCplForThreshold.id}/threshold`, {
        threshold_capaian: num,
      })
      pushToast(`Target capaian untuk ${targetCplForThreshold.kode} berhasil diubah menjadi ${num}%`)
      setIsThresholdModalOpen(false)
      if (selectedVersionId) await fetchCurriculumData(selectedVersionId)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal mengubah threshold CPL'), 'error')
    } finally {
      setThresholdSubmitting(false)
    }
  }

  // If Admin Prodi navigates to root /kurikulum, redirect to CPL list
  if (isAdminProdi) {
    return <Navigate to="/kurikulum/cpl" replace />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="STRUKTUR KURIKULUM OBE"
        title="Kurikulum Outcome-Based Education (OBE)"
        description="Pantau Capaian Pembelajaran Lulusan (CPL), Indikator Kinerja (IK), dan pemetaan ketercapaian kompetensi."
        badge={isKaprodi ? 'Kaprodi (Mode Lihat + Edit Target)' : isDekan ? 'Dekan (Mode Lihat)' : 'Dosen (Mode Lihat)'}
      />

      {/* Dekan Prodi Selector */}
      {isDekan && <ProdiSelector />}

      {isDekan && !selectedProdiId ? (
        <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-6 text-center text-xs text-amber-900">
          Silakan pilih Program Studi di atas untuk melihat struktur kurikulum OBE fakultas.
        </div>
      ) : (
        <>
          {/* Header Bar: Version Selector */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="label-filter">
                Versi Kurikulum:
              </span>
              {loadingVersions ? (
                <div className="flex items-center gap-2 text-xs text-[#64748B]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1A3A6B]" />
                  <span>Memuat versi...</span>
                </div>
              ) : versions.length > 0 ? (
                <div className="relative inline-block">
                  <select
                    value={selectedVersionId || ''}
                    onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                    data-testid="select-version"
                    className="h-10 appearance-none rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] pl-3 pr-9 text-sm font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.version_label} {v.status === 'published' ? '✓' : '(Draft)'}{v.is_aktif ? ' · Aktif' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                </div>
              ) : (
                <span className="text-xs text-[#94A3B8]">Belum ada versi kurikulum</span>
              )}

              {currentVersion && (
                <Badge tone={currentVersion.status === 'published' ? 'success' : 'warning'}>
                  {currentVersion.status === 'published' ? 'Published' : 'Draft'}
                </Badge>
              )}
              {currentVersion?.is_aktif && <Badge tone="default">Kurikulum Aktif</Badge>}
            </div>
          </div>

          {/* Kurikulum yang sedang dipakai Analitik OBE */}
          {!loadingVersions && (
            <div
              data-testid="info-kurikulum-aktif"
              className={`flex flex-wrap items-center gap-2 rounded-[8px] border p-3.5 text-xs ${
                activeVersion?.aktif_ditetapkan
                  ? 'border-[#CBD5E1] bg-[#F8FAFC] text-[#142B4A]'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              {activeVersion ? (
                <span>
                  Kurikulum yang digunakan untuk Analitik OBE: <strong>{activeVersion.version_label}</strong>
                  {activeVersion.tahun ? ` (${activeVersion.tahun})` : ''}
                  {activeVersion.aktif_ditetapkan
                    ? ', ditetapkan oleh Admin Prodi.'
                    : '. Belum ditetapkan Admin Prodi, jadi sementara memakai versi terbaru yang sudah dipublikasikan.'}
                </span>
              ) : (
                <span>Belum ada kurikulum yang dipublikasikan, sehingga Analitik OBE belum dapat ditampilkan.</span>
              )}
              {activeVersion && currentVersion && currentVersion.id !== activeVersion.id && (
                <button
                  type="button"
                  onClick={() => setSelectedVersionId(activeVersion.id)}
                  className="ml-auto font-semibold text-[#1A3A6B] underline-offset-2 hover:underline"
                >
                  Lihat kurikulum aktif
                </button>
              )}
            </div>
          )}

          {errorData && (
            <div className="flex items-center gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorData}</span>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total CPL" value={cplList.length} caption="Capaian Lulusan" icon={<Target className="h-5 w-5" />} />
            <StatCard label="Total IK" value={ikList.length} caption="Indikator Kinerja" icon={<Layers className="h-5 w-5" />} />
            <StatCard label="Mata Kuliah" value={mkList.length} caption="Mata Kuliah Aktif" icon={<BookOpen className="h-5 w-5" />} />
            <StatCard label="Total CPMK" value={cpmkList.length} caption="Capaian MK" icon={<Network className="h-5 w-5" />} />
          </div>

          {/* View Tab Nav */}
          <div className="flex items-center gap-6 border-b border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setActiveTab('cpl')}
              data-testid="tab-view-cpl"
              className={`flex items-center gap-2 pb-3.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === 'cpl'
                  ? 'border-[#1A3A6B] text-[#1A3A6B]'
                  : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
              }`}
            >
              <Target className="h-4 w-4" />
              <span>CPL &amp; Indikator Kinerja</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              data-testid="tab-view-matrix"
              className={`flex items-center gap-2 pb-3.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === 'matrix'
                  ? 'border-[#1A3A6B] text-[#1A3A6B]'
                  : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
              }`}
            >
              <Network className="h-4 w-4" />
              <span>Matriks Pemetaan CPMK - IK</span>
            </button>
          </div>

          {/* TAB 1: CPL & IK Accordion */}
          {activeTab === 'cpl' && (
            <div className="space-y-4">
              {loadingData ? (
                <div className="py-12 text-center text-xs text-[#64748B]">
                  <Loader2 className="h-5 w-5 animate-spin text-[#1A3A6B] inline mr-2" />
                  <span>Memuat data CPL dan Indikator...</span>
                </div>
              ) : cplList.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[#CBD5E1] p-10 text-center text-xs text-[#94A3B8]">
                  Belum ada data CPL untuk kurikulum ini.
                </div>
              ) : (
                cplList.map((cpl) => {
                  const iksUnderCpl = ikList.filter((ik) => ik.cpl_id === cpl.id)
                  const isExpanded = expandedCplIds.has(cpl.id)
                  return (
                    <div
                      key={cpl.id}
                      className="rounded-[8px] border border-[#E2E8F0] bg-white overflow-hidden shadow-sm transition-shadow hover:shadow"
                      data-testid={`cpl-card-${cpl.id}`}
                    >
                      <div
                        className="flex items-start justify-between gap-4 p-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                        onClick={() => toggleCplAccordion(cpl.id)}
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            type="button"
                            className="mt-0.5 rounded-[4px] p-0.5 text-[#64748B] hover:bg-[#E2E8F0]"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-[#1A3A6B]">{cpl.kode}</span>
                              <Badge tone="default">Target: {cpl.threshold_capaian}%</Badge>
                              <span className="text-[11px] text-[#64748B]">({iksUnderCpl.length} Indikator Kinerja)</span>
                            </div>
                            <p className="text-xs text-[#142B4A] leading-relaxed max-w-3xl">{cpl.deskripsi}</p>
                          </div>
                        </div>

                        {/* Kaprodi Threshold Edit Button */}
                        {isKaprodi && (
                          <div
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenThresholdModal(cpl)}
                              data-testid={`edit-threshold-${cpl.id}`}
                              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                            >
                              <Sliders className="h-3 w-3 text-[#1A3A6B]" />
                              <span>Ubah Target Capaian</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* IK Table inside CPL Accordion */}
                      {isExpanded && (
                        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] p-4">
                          <h4 className="text-[11px] font-bold text-[#6D778E] uppercase tracking-wider mb-2">
                            Indikator Kinerja ({cpl.kode}):
                          </h4>
                          {iksUnderCpl.length === 0 ? (
                            <p className="text-xs text-[#94A3B8] italic">Belum ada indikator kinerja di bawah CPL ini.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-[6px] border border-[#E2E8F0] bg-white">
                              <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#6D778E]">
                                    <th className="py-2.5 px-3 w-28">Kode IK</th>
                                    <th className="py-2.5 px-3">Deskripsi Indikator</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E2E8F0]">
                                  {iksUnderCpl.map((ik) => (
                                    <tr key={ik.id} className="hover:bg-[#F8FAFC]">
                                      <td className="py-2 px-3 font-mono font-bold text-[#1A3A6B]">{ik.kode}</td>
                                      <td className="py-2 px-3 text-[#142B4A] leading-relaxed">{ik.deskripsi}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* TAB 2: Matriks Pemetaan CPMK - IK */}
          {activeTab === 'matrix' && (
            <SectionCard
              title="Matriks Pemetaan CPMK ke Indikator Kinerja (IK)"
              description="Visualisasi hubungan antara capaian pembelajaran mata kuliah dan indikator kinerja program studi."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-[#E2E8F0] text-left">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-semibold text-[#6D778E]">
                      <th className="p-3 w-32 border-r border-[#E2E8F0]">Mata Kuliah</th>
                      <th className="p-3 w-48 border-r border-[#E2E8F0]">CPMK</th>
                      {ikList.map((ik) => (
                        <th key={ik.id} className="p-2.5 text-center font-mono w-20 border-r border-[#E2E8F0]">
                          <span title={ik.deskripsi} className="cursor-help">
                            {ik.kode}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {cpmkList.length === 0 ? (
                      <tr>
                        <td colSpan={ikList.length + 2} className="p-8 text-center text-[#94A3B8]">
                          Belum ada CPMK untuk dipetakan ke IK.
                        </td>
                      </tr>
                    ) : (
                      cpmkList.map((cpmk) => {
                        const mk = mkList.find((m) => m.id === cpmk.mata_kuliah_id)
                        return (
                          <tr key={cpmk.id} className="hover:bg-[#F8FAFC]">
                            <td className="p-3 font-semibold text-[#142B4A] border-r border-[#E2E8F0]">
                              {mk?.kode || '-'}
                            </td>
                            <td className="p-3 border-r border-[#E2E8F0]">
                              <span className="font-mono font-bold text-[#1A3A6B] mr-1.5">{cpmk.kode}</span>
                              <span className="text-[#64748B] text-[11px]">({cpmk.bobot}%)</span>
                            </td>
                            {ikList.map((ik) => (
                              <td key={ik.id} className="p-2.5 text-center font-mono border-r border-[#E2E8F0]">
                                -
                              </td>
                            ))}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Modal Edit Threshold Khusus Kaprodi */}
          {isKaprodi && (
            <Modal
              open={isThresholdModalOpen}
              title={`Ubah Target Capaian — ${targetCplForThreshold?.kode || ''}`}
              onClose={() => setIsThresholdModalOpen(false)}
            >
              <form onSubmit={handleSaveThreshold} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                    Target Capaian (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={thresholdValue}
                    onChange={(e) => setThresholdValue(e.target.value)}
                    data-testid="input-threshold-value"
                    className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
                  />
                  <span className="text-[11px] text-[#64748B] mt-1 block">
                    Batas kelulusan standar untuk CPL ini (default: 70.0%).
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setIsThresholdModalOpen(false)}
                    className="rounded-[6px] border border-[#CBD5E1] px-3.5 py-1.5 text-xs font-semibold text-[#142B4A]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={thresholdSubmitting}
                    data-testid="submit-threshold-button"
                    className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
                  >
                    {thresholdSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Simpan Target</span>
                  </button>
                </div>
              </form>
            </Modal>
          )}
        </>
      )}
    </div>
  )
}
