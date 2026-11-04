import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Network,
  Search,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  BookOpen,
  Filter,
} from 'lucide-react'
import { PageHeader, SectionCard, Badge } from '../../components/PageChrome'
import Modal from '../../components/Modal'
import KurikulumVersionSelector from '../../components/KurikulumVersionSelector'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import useAuth from '../../hooks/useAuth'
import { getApiErrorMessage } from '../superAdminHelpers'

export default function PemetaanIkPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const cplIdParam = searchParams.get('cplId')
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()
  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isAdminProdi = currentRole === 'admin_prodi'

  // View Mode: 'all_ik' (Tabel Semua IK) | 'cpl_summary' (Ringkasan per CPL)
  const [viewMode, setViewMode] = useState(cplIdParam ? 'cpl_summary' : 'cpl_summary')

  // Versions state
  const [versions, setVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [loadingVersions, setLoadingVersions] = useState(true)

  // Master Data
  const [cplList, setCplList] = useState([])
  const [ikList, setIkList] = useState([])
  const [mkList, setMkList] = useState([])
  const [cpmkList, setCpmkList] = useState([])
  const [loadingMaster, setLoadingMaster] = useState(false)
  const [errorMaster, setErrorMaster] = useState(null)

  // Selected CPL Filter for 'cpl_summary'
  const [activeCplId, setActiveCplId] = useState(cplIdParam ? Number(cplIdParam) : null)

  // On-demand Mapping Cache: Map(cpmk_id -> list[CPMKIKMapItem])
  const mappingCacheRef = useRef(new Map())
  const [mappingLoadedCount, setMappingLoadedCount] = useState(0)
  const [loadingMappings, setLoadingMappings] = useState(false)
  const [mappingProgress, setMappingProgress] = useState(0)

  // Detail Modal for Single IK
  const [selectedIkForDetail, setSelectedIkForDetail] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Table search
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Fetch versions
  const fetchVersions = async () => {
    setLoadingVersions(true)
    try {
      const res = await api.get('/kurikulum/versions')
      const list = Array.isArray(res.data) ? res.data : []
      setVersions(list)
      if (list.length > 0 && !selectedVersionId) {
        setSelectedVersionId(list[0].id)
      }
    } catch (err) {
      setErrorMaster(getApiErrorMessage(err, 'Gagal memuat versi kurikulum'))
    } finally {
      setLoadingVersions(false)
    }
  }

  // 2. Fetch Master Data for Version (CPL, IK, MK, CPMK - without fetching all map-ik)
  const fetchMasterData = async (versionId) => {
    if (!versionId) return
    setLoadingMaster(true)
    setErrorMaster(null)
    try {
      const [cplRes, ikRes, mkRes, cpmkRes] = await Promise.all([
        api.get('/cpl', { params: { kurikulum_version_id: versionId } }),
        api.get('/ik'),
        api.get('/mata-kuliah', { params: { kurikulum_version_id: versionId } }),
        api.get('/cpmk'),
      ])

      const fetchedCpls = Array.isArray(cplRes.data) ? cplRes.data : []
      const fetchedIks = Array.isArray(ikRes.data) ? ikRes.data : []
      const fetchedMks = Array.isArray(mkRes.data) ? mkRes.data : []
      const fetchedCpmks = Array.isArray(cpmkRes.data) ? cpmkRes.data : []

      // Scope IKs to the version's CPLs
      const cplIdSet = new Set(fetchedCpls.map((c) => c.id))
      const scopedIks = fetchedIks.filter((ik) => cplIdSet.has(ik.cpl_id))

      // Scope CPMKs to the version's MKs
      const mkIdSet = new Set(fetchedMks.map((m) => m.id))
      const scopedCpmks = fetchedCpmks.filter((c) => mkIdSet.has(c.mata_kuliah_id))

      setCplList(fetchedCpls)
      setIkList(scopedIks)
      setMkList(fetchedMks)
      setCpmkList(scopedCpmks)

      // Set initial active CPL if not already set or invalid
      if (fetchedCpls.length > 0) {
        if (!activeCplId || !cplIdSet.has(activeCplId)) {
          setActiveCplId(cplIdParam ? Number(cplIdParam) : fetchedCpls[0].id)
        }
      } else {
        setActiveCplId(null)
      }
    } catch (err) {
      setErrorMaster(getApiErrorMessage(err, 'Gagal memuat data pemetaan kurikulum'))
    } finally {
      setLoadingMaster(false)
    }
  }

  useEffect(() => {
    fetchVersions()
  }, [])

  useEffect(() => {
    if (selectedVersionId) {
      mappingCacheRef.current.clear()
      setMappingLoadedCount(0)
      fetchMasterData(selectedVersionId)
    }
  }, [selectedVersionId])

  // Synchronize cplIdParam when changed from outside
  useEffect(() => {
    if (cplIdParam) {
      setActiveCplId(Number(cplIdParam))
      setViewMode('cpl_summary')
    }
  }, [cplIdParam])

  // Map MK by ID
  const mkMap = useMemo(() => {
    const map = new Map()
    for (const m of mkList) map.set(m.id, m)
    return map
  }, [mkList])

  // Map CPL by ID
  const cplMap = useMemo(() => {
    const map = new Map()
    for (const c of cplList) map.set(c.id, c)
    return map
  }, [cplList])

  // On-demand loader for CPMK mappings with max 5 concurrent requests and memory caching
  const loadMappingsForCpmks = async (targetCpmkList) => {
    const cache = mappingCacheRef.current
    const missingIds = targetCpmkList.map((c) => c.id).filter((id) => !cache.has(id))
    if (missingIds.length === 0) return

    setLoadingMappings(true)
    setMappingProgress(0)

    const CONCURRENCY = 5
    let index = 0
    let completed = 0

    const worker = async () => {
      while (index < missingIds.length) {
        const id = missingIds[index++]
        try {
          const res = await api.get(`/cpmk/${id}/map-ik`)
          cache.set(id, Array.isArray(res.data) ? res.data : [])
        } catch {
          cache.set(id, [])
        }
        completed++
        setMappingProgress(Math.round((completed / missingIds.length) * 100))
      }
    }

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, missingIds.length) },
      () => worker()
    )
    await Promise.all(workers)

    setLoadingMappings(false)
    setMappingLoadedCount(cache.size)
  }

  // Auto-fetch mapping when active CPL is selected in 'cpl_summary' mode
  useEffect(() => {
    if (cpmkList.length > 0) {
      // In cpl_summary or all_ik, we can trigger loading for current active version's CPMKs
      loadMappingsForCpmks(cpmkList)
    }
  }, [activeCplId, cpmkList])

  // Calculate inverted mapping: Map(ik_id -> list of { cpmk, mk, bobot })
  const ikMappingSummary = useMemo(() => {
    const summary = new Map() // ik_id -> array of items
    const cache = mappingCacheRef.current

    for (const cpmk of cpmkList) {
      const maps = cache.get(cpmk.id) || []
      const mk = mkMap.get(cpmk.mata_kuliah_id)
      for (const m of maps) {
        const current = summary.get(m.ik_id) || []
        current.push({
          cpmk_id: cpmk.id,
          cpmk_kode: cpmk.kode,
          cpmk_deskripsi: cpmk.deskripsi,
          cpmk_bobot: Number(cpmk.bobot),
          mk_id: mk?.id,
          mk_kode: mk?.kode || '-',
          mk_nama: mk?.nama || 'Mata Kuliah Tidak Ditemukan',
          mk_semester: mk?.semester || '-',
          bobot: Number(m.bobot),
        })
        summary.set(m.ik_id, current)
      }
    }
    return summary
  }, [cpmkList, mkMap, mappingLoadedCount])

  // Active CPL object
  const activeCpl = useMemo(() => {
    return cplList.find((c) => c.id === activeCplId) || cplList[0] || null
  }, [cplList, activeCplId])

  // IKs of active CPL
  const activeCplIks = useMemo(() => {
    if (!activeCpl) return []
    return ikList.filter((ik) => ik.cpl_id === activeCpl.id)
  }, [ikList, activeCpl])

  // Total weight for active CPL summary
  const activeCplTotalBobot = useMemo(() => {
    let sum = 0
    for (const ik of activeCplIks) {
      const mappings = ikMappingSummary.get(ik.id) || []
      for (const m of mappings) {
        sum += m.bobot
      }
    }
    return Math.round(sum * 100) / 100
  }, [activeCplIks, ikMappingSummary])

  // Open detail modal for an IK
  const handleOpenDetailModal = (ik) => {
    setSelectedIkForDetail(ik)
    setIsDetailModalOpen(true)
    // Ensure mappings for all CPMKs are loaded
    if (mappingCacheRef.current.size < cpmkList.length) {
      loadMappingsForCpmks(cpmkList)
    }
  }

  // Filtered IKs for 'all_ik' view
  const filteredAllIks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return ikList
    return ikList.filter((ik) => {
      const cpl = cplMap.get(ik.cpl_id)
      return (
        (ik.kode || '').toLowerCase().includes(q) ||
        (ik.deskripsi || '').toLowerCase().includes(q) ||
        (cpl?.kode || '').toLowerCase().includes(q)
      )
    })
  }, [ikList, cplMap, searchQuery])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="STRUKTUR PEMETAAN KURIKULUM OBE"
        title="Pemetaan Indikator Kinerja (IK) ke Mata Kuliah"
        description="Pantau bagaimana setiap Indikator Kinerja CPL didukung oleh Capaian Pembelajaran Mata Kuliah (CPMK) beserta distribusi bobotnya."
        badge={isAdminProdi ? 'Admin Prodi' : 'Mode Lihat'}
      />

      {/* Selector Versi Kurikulum */}
      <KurikulumVersionSelector
        versions={versions}
        selectedVersionId={selectedVersionId}
        onSelectVersion={(id) => {
          setSelectedVersionId(id)
          setSearchParams({})
        }}
        onRefreshVersions={fetchVersions}
        canManage={isAdminProdi}
        loading={loadingVersions}
      />

      {errorMaster && (
        <div className="flex items-center gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMaster}</span>
        </div>
      )}

      {/* View Switcher Tabs & Progress bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('cpl_summary')}
            data-testid="tab-cpl-summary"
            className={`flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'cpl_summary'
                ? 'bg-[#1A3A6B] text-white shadow-sm'
                : 'bg-white text-[#64748B] hover:text-[#142B4A] border border-[#CBD5E1]'
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            <span>Ringkasan per CPL</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all_ik')}
            data-testid="tab-all-ik"
            className={`flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'all_ik'
                ? 'bg-[#1A3A6B] text-white shadow-sm'
                : 'bg-white text-[#64748B] hover:text-[#142B4A] border border-[#CBD5E1]'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Semua Indikator Kinerja</span>
          </button>
        </div>

        {/* On-demand Mapping Loader Indicator */}
        {loadingMappings && (
          <div className="flex items-center gap-2 text-xs text-[#64748B] bg-white border border-[#E2E8F0] px-3 py-1 rounded-[6px]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1A3A6B]" />
            <span>Sinkronisasi data pemetaan CPMK ({mappingProgress}%)...</span>
          </div>
        )}
      </div>

      {/* VIEW 1: RINGKASAN PER CPL */}
      {viewMode === 'cpl_summary' && (
        <div className="space-y-6">
          {/* CPL Selection Bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[#E2E8F0] bg-white p-3 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6D778E] mr-1">
              Pilih CPL:
            </span>
            {cplList.length === 0 ? (
              <span className="text-xs text-[#94A3B8]">Belum ada CPL</span>
            ) : (
              cplList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveCplId(c.id)
                    setSearchParams({ cplId: String(c.id) })
                  }}
                  data-testid={`cpl-filter-pill-${c.id}`}
                  className={`inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1 text-xs font-semibold transition-colors ${
                    activeCpl?.id === c.id
                      ? 'border border-[#1A3A6B] bg-[#1A3A6B] text-white'
                      : 'border border-[#CBD5E1] bg-white text-[#142B4A] hover:border-[#1A3A6B]'
                  }`}
                >
                  <span>{c.kode}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      activeCpl?.id === c.id ? 'bg-white/20 text-white' : 'bg-[#F2F4F7] text-[#64748B]'
                    }`}
                  >
                    {ikList.filter((ik) => ik.cpl_id === c.id).length} IK
                  </span>
                </button>
              ))
            )}
          </div>

          {activeCpl ? (
            <SectionCard
              title={`Ringkasan Pemetaan — ${activeCpl.kode}`}
              description={activeCpl.deskripsi}
              action={
                <div className="flex items-center gap-2">
                  <Badge tone="default">Target: {activeCpl.threshold_capaian}%</Badge>
                  <Link
                    to={`/kurikulum/cpl/${activeCpl.id}/indikator`}
                    className="inline-flex items-center gap-1 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B]"
                  >
                    <span>Kelola IK</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs" data-testid="cpl-mapping-summary-table">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#6D778E]">
                      <th className="py-3 px-4 w-32">Indikator Kinerja</th>
                      <th className="py-3 px-4">Deskripsi Indikator</th>
                      <th className="py-3 px-4 w-96">Mata Kuliah & CPMK Pemeta</th>
                      <th className="py-3 px-4 text-right w-28">Subtotal Bobot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {activeCplIks.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-xs text-[#94A3B8]">
                          Belum ada Indikator Kinerja untuk CPL ini.
                        </td>
                      </tr>
                    ) : (
                      activeCplIks.map((ik) => {
                        const mappings = ikMappingSummary.get(ik.id) || []
                        const subtotalBobot = mappings.reduce((acc, m) => acc + m.bobot, 0)
                        return (
                          <tr key={ik.id} className="transition-colors hover:bg-[#F8FAFC]">
                            <td className="py-3 px-4 font-mono font-bold text-[#1A3A6B] align-top">
                              {ik.kode}
                            </td>
                            <td className="py-3 px-4 text-[#142B4A] leading-relaxed align-top">
                              {ik.deskripsi}
                            </td>
                            <td className="py-3 px-4 align-top">
                              {mappings.length === 0 ? (
                                <span className="text-xs text-[#94A3B8] italic">
                                  Belum dipetakan ke mata kuliah manapun
                                </span>
                              ) : (
                                <div className="space-y-1.5">
                                  {mappings.map((m, idx) => (
                                    <div
                                      key={`${m.cpmk_id}-${idx}`}
                                      className="flex items-center justify-between gap-2 rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-xs"
                                    >
                                      <div className="truncate">
                                        <span className="font-semibold text-[#142B4A]">
                                          {m.mk_kode} - {m.mk_nama}
                                        </span>
                                        <span className="text-[#64748B] ml-1.5 font-mono text-[11px]">
                                          ({m.cpmk_kode})
                                        </span>
                                      </div>
                                      <span className="font-bold text-[#1A3A6B] shrink-0 font-mono">
                                        {m.bobot}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right align-top">
                              <span
                                className={`font-mono font-bold text-xs ${
                                  subtotalBobot > 0 ? 'text-[#1A3A6B]' : 'text-[#94A3B8]'
                                }`}
                              >
                                {subtotalBobot}%
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  {/* BARIS TOTAL PER CPL */}
                  {activeCplIks.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-[#1A3A6B] bg-[#F8FAFC] font-semibold text-[#142B4A]">
                        <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                          TOTAL KONTRIBUSI BOBOT ({activeCpl.kode}):
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-sm text-[#1A3A6B]" data-testid="cpl-total-bobot">
                          {activeCplTotalBobot}%
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </SectionCard>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#CBD5E1] p-10 text-center text-xs text-[#94A3B8]">
              Pilih salah satu CPL di atas untuk melihat ringkasan pemetaan.
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SEMUA INDIKATOR KINERJA */}
      {viewMode === 'all_ik' && (
        <SectionCard
          title="Tabel Semua Indikator Kinerja"
          description={`Menampilkan ${filteredAllIks.length} IK terdaftar pada kurikulum ini.`}
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
              <input
                type="search"
                placeholder="Cari IK, CPL, atau deskripsi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-all-ik-input"
                className="h-8 w-64 rounded-[6px] border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none"
              />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs" data-testid="all-ik-table">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#6D778E]">
                  <th className="py-3 px-4 w-28">Kode IK</th>
                  <th className="py-3 px-4 w-28">CPL Induk</th>
                  <th className="py-3 px-4">Deskripsi Indikator</th>
                  <th className="py-3 px-4 text-center w-36">Mata Kuliah Pemeta</th>
                  <th className="py-3 px-4 text-right w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {loadingMaster ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-[#64748B]">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                        <span>Memuat data indikator...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredAllIks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-[#94A3B8]">
                      Tidak ada Indikator Kinerja yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredAllIks.map((ik) => {
                    const cpl = cplMap.get(ik.cpl_id)
                    const mappings = ikMappingSummary.get(ik.id) || []
                    const totalBobot = mappings.reduce((acc, m) => acc + m.bobot, 0)
                    return (
                      <tr key={ik.id} className="transition-colors hover:bg-[#F8FAFC]" data-testid={`ik-row-${ik.id}`}>
                        <td className="py-3 px-4 font-mono font-bold text-[#1A3A6B]">{ik.kode}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#64748B]">
                          {cpl?.kode || '-'}
                        </td>
                        <td className="py-3 px-4 text-[#142B4A] leading-relaxed">{ik.deskripsi}</td>
                        <td className="py-3 px-4 text-center">
                          {mappings.length > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-[4px] border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                              {mappings.length} MK ({totalBobot}%)
                            </span>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(ik)}
                            data-testid={`ik-detail-button-${ik.id}`}
                            className="inline-flex items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                          >
                            <Eye className="h-3 w-3 text-[#1A3A6B]" />
                            <span>Detail</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* MODAL DETAIL SATU IK */}
      <Modal
        open={isDetailModalOpen}
        title={`Detail Pemetaan Indikator — ${selectedIkForDetail?.kode || ''}`}
        onClose={() => setIsDetailModalOpen(false)}
        size="max-w-2xl"
      >
        {selectedIkForDetail && (
          <div className="space-y-4">
            <div className="rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1A3A6B] font-mono">{selectedIkForDetail.kode}</span>
                <span className="text-[#64748B]">
                  (CPL Induk: {cplMap.get(selectedIkForDetail.cpl_id)?.kode || '-'})
                </span>
              </div>
              <p className="text-[#142B4A] leading-relaxed">{selectedIkForDetail.deskripsi}</p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#142B4A] uppercase tracking-wider">
                Mata Kuliah & CPMK yang Memetakan IK Ini:
              </h4>

              {(() => {
                const mappings = ikMappingSummary.get(selectedIkForDetail.id) || []
                if (loadingMappings) {
                  return (
                    <div className="py-6 text-center text-xs text-[#64748B]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B] inline mr-2" />
                      <span>Mengambil data pemetaan...</span>
                    </div>
                  )
                }
                if (mappings.length === 0) {
                  return (
                    <div className="rounded-[6px] border border-dashed border-[#CBD5E1] p-4 text-center text-xs text-[#94A3B8]">
                      Belum ada mata kuliah atau CPMK yang memetakan indikator ini.
                    </div>
                  )
                }

                const total = mappings.reduce((acc, m) => acc + m.bobot, 0)

                return (
                  <div className="space-y-2">
                    <div className="overflow-x-auto border border-[#E2E8F0] rounded-[6px]">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-semibold text-[#6D778E]">
                            <th className="p-2.5">Mata Kuliah</th>
                            <th className="p-2.5">CPMK</th>
                            <th className="p-2.5 text-right w-24">Bobot ke IK</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                          {mappings.map((m, idx) => (
                            <tr key={`${m.cpmk_id}-${idx}`}>
                              <td className="p-2.5 font-medium text-[#142B4A]">
                                {m.mk_kode} - {m.mk_nama}
                              </td>
                              <td className="p-2.5 font-mono text-[#64748B]">
                                {m.cpmk_kode}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-[#1A3A6B]">
                                {m.bobot}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-[#F8FAFC] border-t border-[#E2E8F0] font-bold">
                            <td colSpan={2} className="p-2.5 text-right uppercase">
                              Total Bobot:
                            </td>
                            <td className="p-2.5 text-right font-mono text-[#1A3A6B]">
                              {total}%
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="rounded-[6px] border border-[#CBD5E1] px-4 py-1.5 text-xs font-semibold text-[#142B4A]"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
