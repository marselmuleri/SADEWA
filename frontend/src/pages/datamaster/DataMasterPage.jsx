import { useState, useMemo, useEffect, Fragment } from 'react'
import {
  BookOpen,
  Target,
  Layers,
  Award,
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Filter,
  X,
} from 'lucide-react'
import { SectionCard, Badge } from '../../components/PageChrome'
import SearchableSelect from '../../components/SearchableSelect'
import useAuth from '../../hooks/useAuth'

export default function DataMasterPage({ section, data }) {
  const { user, activeRole } = useAuth()
  const currentRole = activeRole || user?.role || ''
  const isSingleProdiRole = ['admin_prodi', 'kaprodi', 'dosen'].includes(currentRole)
  const isDekan = currentRole === 'dekan'
  const {
    versions,
    cpls,
    iks,
    cpmks,
    mataKuliahs,
    prodis,
    loading,
    prodiMap,
    kurikulumMap,
    mataKuliahMap,
    cplMap,
    iksByCplId,
    cpmksByMkId,
    totalBobotPerMk,
  } = data
  const activeTab = section

  // State is kept per section so navigation does not load unrelated data.
  const [searchKurikulum, setSearchKurikulum] = useState('')
  const [searchCpl, setSearchCpl] = useState('')
  const [searchIk, setSearchIk] = useState('')
  const [searchCpmk, setSearchCpmk] = useState('')

  // Filter states
  const [filterProdiId, setFilterProdiId] = useState('ALL')
  const [filterKurikulumId, setFilterKurikulumId] = useState('ALL')
  const [filterMataKuliahId, setFilterMataKuliahId] = useState('ALL')
  const [filterStatusKurikulum, setFilterStatusKurikulum] = useState('ALL')
  const [filterLevelTaksonomi, setFilterLevelTaksonomi] = useState('ALL')
  const [filterStatusBobot, setFilterStatusBobot] = useState('ALL') // 'ALL' | '100' | 'NOT_100'

  // Expandable row states (Sets of IDs)
  const [expandedKurikulumIds, setExpandedKurikulumIds] = useState(new Set())
  const [expandedCplIds, setExpandedCplIds] = useState(new Set())
  const [expandedIkIds, setExpandedIkIds] = useState(new Set())
  const [expandedCpmkIds, setExpandedCpmkIds] = useState(new Set())

  // Pagination states
  const [pageSize, setPageSize] = useState(10)
  const [pageKurikulum, setPageKurikulum] = useState(1)
  const [pageCpl, setPageCpl] = useState(1)
  const [pageIk, setPageIk] = useState(1)
  const [pageCpmk, setPageCpmk] = useState(1)

  // A role/account change can happen without a full page reload. Reset every
  // local filter so a saved selection from the previous account cannot apply.
  useEffect(() => {
    setFilterProdiId('ALL')
    setFilterKurikulumId('ALL')
    setFilterMataKuliahId('ALL')
    setFilterStatusKurikulum('ALL')
    setFilterLevelTaksonomi('ALL')
    setFilterStatusBobot('ALL')
    setSearchKurikulum('')
    setSearchCpl('')
    setSearchIk('')
    setSearchCpmk('')
    setExpandedKurikulumIds(new Set())
    setExpandedCplIds(new Set())
    setExpandedIkIds(new Set())
    setExpandedCpmkIds(new Set())
    setPageKurikulum(1)
    setPageCpl(1)
    setPageIk(1)
    setPageCpmk(1)
  }, [user?.id, currentRole])

  // Toggle expand helper
  const toggleExpand = (setFn, id) => {
    setFn((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Reset filters helper
  const handleResetFilters = () => {
    setFilterProdiId('ALL')
    setFilterKurikulumId('ALL')
    setFilterMataKuliahId('ALL')
    setFilterStatusKurikulum('ALL')
    setFilterLevelTaksonomi('ALL')
    setFilterStatusBobot('ALL')
    setSearchKurikulum('')
    setSearchCpl('')
    setSearchIk('')
    setSearchCpmk('')
    setPageKurikulum(1)
    setPageCpl(1)
    setPageIk(1)
    setPageCpmk(1)
  }

  // --- Dynamic Filter Options ---
  const availableProdiOptions = useMemo(() => {
    return prodis.map((p) => ({ id: p.id, label: `${p.nama} (${p.kode})` }))
  }, [prodis])

  const readOnlyProdiLabel = user?.program_studi_nama
    || (user?.program_studi_id ? `Prodi ID #${user.program_studi_id}` : 'Belum terhubung ke program studi')

  const availableKurikulumOptions = useMemo(() => {
    return versions.map((v) => ({
      id: v.id,
      label: `${v.version_label} (${v.semester})`,
    }))
  }, [versions])

  const availableMataKuliahOptions = useMemo(() => {
    return mataKuliahs.map((m) => ({
      id: m.id,
      label: `${m.kode} - ${m.nama}`,
    }))
  }, [mataKuliahs])

  const availableTaksonomiOptions = useMemo(() => {
    const set = new Set()
    cpmks.forEach((c) => {
      if (c.level_taksonomi) set.add(c.level_taksonomi)
    })
    return Array.from(set).sort()
  }, [cpmks])

  // --- Filtered Data ---
  // 1. Kurikulum
  const filteredKurikulum = useMemo(() => {
    return versions.filter((item) => {
      const prodi = prodiMap.get(Number(item.program_studi_id))
      const searchTarget = `${item.version_label || ''} ${item.semester || ''} ${item.status || ''} ${prodi?.nama || ''} ${prodi?.kode || ''}`.toLowerCase()
      const matchesSearch = !searchKurikulum || searchTarget.includes(searchKurikulum.toLowerCase().trim())
      const matchesProdi = filterProdiId === 'ALL' || String(item.program_studi_id) === String(filterProdiId)
      const matchesStatus = filterStatusKurikulum === 'ALL' || item.status === filterStatusKurikulum
      return matchesSearch && matchesProdi && matchesStatus
    })
  }, [versions, searchKurikulum, filterProdiId, filterStatusKurikulum, prodiMap])

  // 2. CPL
  const filteredCpls = useMemo(() => {
    return cpls.filter((item) => {
      const prodi = prodiMap.get(Number(item.program_studi_id))
      const kur = kurikulumMap.get(Number(item.kurikulum_version_id))
      const searchTarget = `${item.kode || ''} ${item.deskripsi || ''} ${prodi?.nama || ''} ${kur?.version_label || ''}`.toLowerCase()
      const matchesSearch = !searchCpl || searchTarget.includes(searchCpl.toLowerCase().trim())
      const matchesProdi = filterProdiId === 'ALL' || String(item.program_studi_id) === String(filterProdiId)
      const matchesKurikulum = filterKurikulumId === 'ALL' || String(item.kurikulum_version_id) === String(filterKurikulumId)
      return matchesSearch && matchesProdi && matchesKurikulum
    })
  }, [cpls, searchCpl, filterProdiId, filterKurikulumId, prodiMap, kurikulumMap])

  // 3. IK
  const filteredIks = useMemo(() => {
    return iks.filter((item) => {
      const parentCpl = cplMap.get(Number(item.cpl_id))
      const prodi = parentCpl ? prodiMap.get(Number(parentCpl.program_studi_id)) : null
      const searchTarget = `${item.kode || ''} ${item.deskripsi || ''} ${parentCpl?.kode || ''} ${parentCpl?.deskripsi || ''} ${prodi?.nama || ''}`.toLowerCase()
      const matchesSearch = !searchIk || searchTarget.includes(searchIk.toLowerCase().trim())
      const matchesCpl = filterKurikulumId === 'ALL' || (parentCpl && String(parentCpl.kurikulum_version_id) === String(filterKurikulumId))
      const matchesProdi = filterProdiId === 'ALL' || (parentCpl && String(parentCpl.program_studi_id) === String(filterProdiId))
      return matchesSearch && matchesCpl && matchesProdi
    })
  }, [iks, searchIk, filterKurikulumId, filterProdiId, cplMap, prodiMap])

  // 4. CPMK
  const filteredCpmks = useMemo(() => {
    return cpmks.filter((item) => {
      const mk = mataKuliahMap.get(Number(item.mata_kuliah_id))
      const prodi = mk ? prodiMap.get(Number(mk.program_studi_id)) : null
      const searchTarget = `${item.kode || ''} ${item.deskripsi || ''} ${item.level_taksonomi || ''} ${mk?.kode || ''} ${mk?.nama || ''} ${prodi?.nama || ''}`.toLowerCase()
      const matchesSearch = !searchCpmk || searchTarget.includes(searchCpmk.toLowerCase().trim())
      const matchesMk = filterMataKuliahId === 'ALL' || String(item.mata_kuliah_id) === String(filterMataKuliahId)
      const matchesProdi = filterProdiId === 'ALL' || (mk && String(mk.program_studi_id) === String(filterProdiId))
      const matchesKurikulum = filterKurikulumId === 'ALL' || (mk && String(mk.kurikulum_version_id) === String(filterKurikulumId))
      const matchesTaksonomi = filterLevelTaksonomi === 'ALL' || item.level_taksonomi === filterLevelTaksonomi

      let matchesBobot = true
      if (filterStatusBobot !== 'ALL') {
        const total = totalBobotPerMk.get(Number(item.mata_kuliah_id)) || 0
        if (filterStatusBobot === '100') {
          matchesBobot = total === 100
        } else if (filterStatusBobot === 'NOT_100') {
          matchesBobot = total !== 100
        }
      }

      return matchesSearch && matchesMk && matchesProdi && matchesKurikulum && matchesTaksonomi && matchesBobot
    })
  }, [cpmks, searchCpmk, filterMataKuliahId, filterProdiId, filterKurikulumId, filterLevelTaksonomi, filterStatusBobot, mataKuliahMap, prodiMap, totalBobotPerMk])

  // --- Pagination Slices ---
  const paginatedKurikulum = useMemo(() => {
    const start = (pageKurikulum - 1) * pageSize
    return filteredKurikulum.slice(start, start + pageSize)
  }, [filteredKurikulum, pageKurikulum, pageSize])

  const paginatedCpls = useMemo(() => {
    const start = (pageCpl - 1) * pageSize
    return filteredCpls.slice(start, start + pageSize)
  }, [filteredCpls, pageCpl, pageSize])

  const paginatedIks = useMemo(() => {
    const start = (pageIk - 1) * pageSize
    return filteredIks.slice(start, start + pageSize)
  }, [filteredIks, pageIk, pageSize])

  const paginatedCpmks = useMemo(() => {
    const start = (pageCpmk - 1) * pageSize
    return filteredCpmks.slice(start, start + pageSize)
  }, [filteredCpmks, pageCpmk, pageSize])

  // Count active filters
  const hasActiveFilters =
    filterProdiId !== 'ALL' ||
    filterKurikulumId !== 'ALL' ||
    filterMataKuliahId !== 'ALL' ||
    filterStatusKurikulum !== 'ALL' ||
    filterLevelTaksonomi !== 'ALL' ||
    filterStatusBobot !== 'ALL' ||
    Boolean(searchKurikulum || searchCpl || searchIk || searchCpmk)

  return (
    <div>
      <SectionCard>
        {/* Global Toolbar: Search & Dynamic Filters */}
        <div className="py-4 border-b border-[#E2E8F0] space-y-3">
          <div className="flex flex-col gap-3">
            {/* Search Input per Tab */}
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
              <input
                type="text"
                data-testid={`input-search-${activeTab}`}
                value={
                  activeTab === 'kurikulum'
                    ? searchKurikulum
                    : activeTab === 'cpl'
                    ? searchCpl
                    : activeTab === 'ik'
                    ? searchIk
                    : searchCpmk
                }
                onChange={(e) => {
                  const val = e.target.value
                  if (activeTab === 'kurikulum') {
                    setSearchKurikulum(val)
                    setPageKurikulum(1)
                  } else if (activeTab === 'cpl') {
                    setSearchCpl(val)
                    setPageCpl(1)
                  } else if (activeTab === 'ik') {
                    setSearchIk(val)
                    setPageIk(1)
                  } else {
                    setSearchCpmk(val)
                    setPageCpmk(1)
                  }
                }}
                placeholder={
                  activeTab === 'kurikulum'
                    ? 'Cari label versi, semester, status, prodi...'
                    : activeTab === 'cpl'
                    ? 'Cari kode CPL, deskripsi, prodi, kurikulum...'
                    : activeTab === 'ik'
                    ? 'Cari kode IK, deskripsi, kode CPL induk...'
                    : 'Cari kode CPMK, deskripsi, level taksonomi, mata kuliah...'
                }
                className="w-full pl-10 pr-9 py-2.5 text-sm rounded-md border border-[#CBD5E1] bg-white text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
              />
              {(activeTab === 'kurikulum' ? searchKurikulum : activeTab === 'cpl' ? searchCpl : activeTab === 'ik' ? searchIk : searchCpmk) && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'kurikulum') setSearchKurikulum('')
                    else if (activeTab === 'cpl') setSearchCpl('')
                    else if (activeTab === 'ik') setSearchIk('')
                    else setSearchCpmk('')
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#142B4A]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              {/* Role prodi memakai label read-only; hanya Dekan yang boleh memilih prodi. */}
              {isSingleProdiRole && (
                <div data-testid="datamaster-prodi-readonly" className="inline-flex items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm text-[#142B4A]">
                  <span className="font-semibold">Program Studi:</span>
                  <span className="font-medium">{readOnlyProdiLabel}</span>
                </div>
              )}

              {/* Filter Program Studi khusus Dekan, dari daftar prodi fakultasnya. */}
              {isDekan && availableProdiOptions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-prodi" className="label-filter">
                    Prodi:
                  </label>
                  <SearchableSelect
                    id="filter-prodi"
                    data-testid="filter-prodi"
                    value={filterProdiId}
                    onChange={(val) => {
                      setFilterProdiId(String(val))
                      setPageKurikulum(1)
                      setPageCpl(1)
                      setPageIk(1)
                      setPageCpmk(1)
                    }}
                    className="w-56"
                    buttonClassName="px-3 py-2 text-sm"
                    searchPlaceholder="Cari program studi..."
                    options={[
                      { value: 'ALL', label: `Semua Program Studi (${availableProdiOptions.length})` },
                      ...availableProdiOptions.map((opt) => ({ value: opt.id, label: opt.label })),
                    ]}
                  />
                </div>
              )}

              {/* Filter Kurikulum (Tab CPL, IK, CPMK) */}
              {activeTab !== 'kurikulum' && availableKurikulumOptions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-kurikulum" className="label-filter">
                    Kurikulum:
                  </label>
                  <select
                    id="filter-kurikulum"
                    data-testid="filter-kurikulum"
                    value={filterKurikulumId}
                    onChange={(e) => {
                      setFilterKurikulumId(e.target.value)
                      setPageCpl(1)
                      setPageIk(1)
                      setPageCpmk(1)
                    }}
                    className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
                  >
                    <option value="ALL">Semua Versi</option>
                    {availableKurikulumOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filter Mata Kuliah (Khusus Tab CPMK) */}
              {activeTab === 'cpmk' && availableMataKuliahOptions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-mk" className="label-filter">
                    Mata Kuliah:
                  </label>
                  <SearchableSelect
                    id="filter-mk"
                    data-testid="filter-mata-kuliah"
                    value={filterMataKuliahId}
                    onChange={(val) => {
                      setFilterMataKuliahId(String(val))
                      setPageCpmk(1)
                    }}
                    className="w-56"
                    buttonClassName="px-3 py-2 text-sm"
                    searchPlaceholder="Cari kode atau nama mata kuliah..."
                    options={[
                      { value: 'ALL', label: `Semua Mata Kuliah (${availableMataKuliahOptions.length})` },
                      ...availableMataKuliahOptions.map((opt) => ({ value: opt.id, label: opt.label })),
                    ]}
                  />
                </div>
              )}

              {/* Filter Level Taksonomi (Khusus Tab CPMK) */}
              {activeTab === 'cpmk' && availableTaksonomiOptions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-taksonomi" className="label-filter">
                    Taksonomi:
                  </label>
                  <select
                    id="filter-taksonomi"
                    data-testid="filter-taksonomi"
                    value={filterLevelTaksonomi}
                    onChange={(e) => {
                      setFilterLevelTaksonomi(e.target.value)
                      setPageCpmk(1)
                    }}
                    className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
                  >
                    <option value="ALL">Semua Level</option>
                    {availableTaksonomiOptions.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Level {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filter Status Bobot MK (Khusus Tab CPMK) */}
              {activeTab === 'cpmk' && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-bobot" className="label-filter">
                    Bobot MK:
                  </label>
                  <select
                    id="filter-bobot"
                    data-testid="filter-status-bobot"
                    value={filterStatusBobot}
                    onChange={(e) => {
                      setFilterStatusBobot(e.target.value)
                      setPageCpmk(1)
                    }}
                    className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
                  >
                    <option value="ALL">Semua Status Bobot</option>
                    <option value="100">Total Pas 100%</option>
                    <option value="NOT_100">Perlu Perhatian (!= 100%)</option>
                  </select>
                </div>
              )}

              {/* Filter Status Kurikulum (Khusus Tab Kurikulum) */}
              {activeTab === 'kurikulum' && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="filter-status" className="label-filter">
                    Status:
                  </label>
                  <select
                    id="filter-status"
                    data-testid="filter-status-kurikulum"
                    value={filterStatusKurikulum}
                    onChange={(e) => {
                      setFilterStatusKurikulum(e.target.value)
                      setPageKurikulum(1)
                    }}
                    className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              )}

              {/* Reset Filter Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  data-testid="btn-reset-filters"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-[#F1F5F9] px-3 py-2 text-sm font-semibold text-[#142B4A] hover:bg-[#E2E8F0] transition-colors"
                  title="Reset seluruh filter dan kata kunci pencarian"
                >
                  <X className="h-4 w-4" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* --- Content Area per Tab --- */}
        <div className="pt-2">
          {loading ? (
            <div className="py-20 text-center text-[#64748B]">
              <div className="inline-flex flex-col items-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-[#1A3A6B]" />
                <span className="text-xs font-medium">Memuat data master akademik...</span>
              </div>
            </div>
          ) : activeTab === 'kurikulum' ? (
            /* =========================================================================
               TAB 1: KURIKULUM
            ========================================================================= */
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" data-testid="table-kurikulum">
                  <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center"></th>
                      <th className="py-3 px-3 w-12 text-center">No</th>
                      <th className="py-3 px-4">Versi Kurikulum</th>
                      <th className="py-3 px-4 w-32">Semester</th>
                      {!isSingleProdiRole && <th className="py-3 px-4">Program Studi</th>}
                      <th className="py-3 px-4 w-28 text-center">Status</th>
                      <th className="py-3 px-4 w-40">Tanggal Terbit</th>
                      <th className="py-3 px-4 w-40">Dibuat Pada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {paginatedKurikulum.length === 0 ? (
                      <tr>
                        <td colSpan={isSingleProdiRole ? 7 : 8} className="py-16 text-center text-[#64748B]">
                          <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                            <BookOpen className="h-8 w-8 text-[#CBD5E1]" />
                            <p className="font-semibold text-sm text-[#142B4A]">
                              {hasActiveFilters
                                ? 'Tidak ada versi kurikulum yang cocok'
                                : 'Belum Ada Data Versi Kurikulum'}
                            </p>
                            <p className="text-xs text-[#64748B]">
                              {hasActiveFilters
                                ? 'Coba sesuaikan kata kunci pencarian atau ubah filter program studi/status.'
                                : 'Belum ada data versi kurikulum yang tercatat untuk program studi Anda di server.'}
                            </p>
                            {hasActiveFilters && (
                              <button
                                type="button"
                                onClick={handleResetFilters}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A]"
                              >
                                Reset Filter
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedKurikulum.map((ver, idx) => {
                        const isExpanded = expandedKurikulumIds.has(ver.id)
                        const prodi = prodiMap.get(Number(ver.program_studi_id))
                        const relatedCpls = cpls.filter((c) => Number(c.kurikulum_version_id) === Number(ver.id))
                        const relatedMks = mataKuliahs.filter((m) => Number(m.kurikulum_version_id) === Number(ver.id))

                        return (
                          <Fragment key={ver.id}>
                            <tr
                              className={`hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                                isExpanded ? 'bg-[#F8FAFC]' : ''
                              }`}
                              onClick={() => toggleExpand(setExpandedKurikulumIds, ver.id)}
                            >
                              <td className="py-3 px-3 text-center text-[#64748B]">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 mx-auto text-[#1A3A6B]" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 mx-auto text-[#94A3B8]" />
                                )}
                              </td>
                              <td className="py-3 px-3 text-center text-[#64748B]">
                                {(pageKurikulum - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-[#142B4A]">{ver.version_label}</div>
                                <div className="text-[11px] text-[#64748B]">ID #{ver.id}</div>
                              </td>
                              <td className="py-3 px-4 text-[#142B4A] font-medium">
                                {ver.semester}
                              </td>
                              {!isSingleProdiRole && (
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-[#142B4A]">
                                    {prodi?.nama || `Prodi ID #${ver.program_studi_id}`}
                                  </div>
                                  <div className="text-[11px] text-[#64748B]">
                                    {prodi?.kode ? `Kode: ${prodi.kode}` : ''}
                                  </div>
                                </td>
                              )}
                              <td className="py-3 px-4 text-center">
                                <Badge tone={ver.status === 'published' ? 'success' : 'warning'}>
                                  {ver.status === 'published' ? 'Published' : 'Draft'}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-[#64748B]">
                                {ver.published_at
                                  ? new Date(ver.published_at).toLocaleDateString('id-ID', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : '-'}
                              </td>
                              <td className="py-3 px-4 text-[#64748B]">
                                {ver.created_at
                                  ? new Date(ver.created_at).toLocaleDateString('id-ID', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : '-'}
                              </td>
                            </tr>

                            {/* Expanded Detail Row */}
                            {isExpanded && (
                              <tr className="bg-[#F8FAFC]/90">
                                <td colSpan={isSingleProdiRole ? 7 : 8} className="p-4 pl-12 border-t border-[#E2E8F0]">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="rounded border border-[#E2E8F0] bg-white p-3 space-y-2">
                                      <div className="text-xs font-semibold text-[#142B4A] flex items-center justify-between">
                                        <span>Capaian Pembelajaran (CPL) Terkait</span>
                                        <Badge tone="default">{relatedCpls.length} CPL</Badge>
                                      </div>
                                      {relatedCpls.length === 0 ? (
                                        <p className="text-[11px] text-[#64748B] italic">
                                          Belum ada CPL yang terhubung dengan versi kurikulum ini.
                                        </p>
                                      ) : (
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                          {relatedCpls.map((c) => (
                                            <div
                                              key={c.id}
                                              className="text-[11px] flex items-center justify-between border-b border-[#F1F5F9] pb-1"
                                            >
                                              <span className="font-mono font-bold text-[#1A3A6B]">{c.kode}</span>
                                              <span className="truncate max-w-[240px] text-[#64748B]">
                                                {c.deskripsi}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div className="rounded border border-[#E2E8F0] bg-white p-3 space-y-2">
                                      <div className="text-xs font-semibold text-[#142B4A] flex items-center justify-between">
                                        <span>Mata Kuliah Terkait</span>
                                        <Badge tone="default">{relatedMks.length} MK</Badge>
                                      </div>
                                      {relatedMks.length === 0 ? (
                                        <p className="text-[11px] text-[#64748B] italic">
                                          Belum ada mata kuliah yang terhubung dengan versi kurikulum ini.
                                        </p>
                                      ) : (
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                          {relatedMks.map((m) => (
                                            <div
                                              key={m.id}
                                              className="text-[11px] flex items-center justify-between border-b border-[#F1F5F9] pb-1"
                                            >
                                              <span className="font-mono font-bold text-[#1A3A6B]">
                                                {m.kode} - {m.nama}
                                              </span>
                                              <span className="text-[#64748B]">{m.sks} SKS · Smt {m.semester}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {renderPagination(
                filteredKurikulum.length,
                pageKurikulum,
                setPageKurikulum,
                pageSize,
                setPageSize
              )}
            </div>
          ) : activeTab === 'cpl' ? (
            /* =========================================================================
               TAB 2: CPL (CAPAIAN PEMBELAJARAN LULUSAN)
            ========================================================================= */
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" data-testid="table-cpl">
                  <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center"></th>
                      <th className="py-3 px-3 w-12 text-center">No</th>
                      <th className="py-3 px-4 w-28">Kode CPL</th>
                      <th className="py-3 px-4">Deskripsi Capaian Pembelajaran</th>
                      {!isSingleProdiRole && <th className="py-3 px-4 w-48">Program Studi</th>}
                      <th className="py-3 px-4 w-36">Kurikulum</th>
                      <th className="py-3 px-4 w-32 text-center">Threshold</th>
                      <th className="py-3 px-4 w-28 text-center">Anak IK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {paginatedCpls.length === 0 ? (
                      <tr>
                        <td colSpan={isSingleProdiRole ? 7 : 8} className="py-16 text-center text-[#64748B]">
                          <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                            <Target className="h-8 w-8 text-[#CBD5E1]" />
                            <p className="font-semibold text-sm text-[#142B4A]">
                              {hasActiveFilters
                                ? 'Tidak ada CPL yang cocok'
                                : 'Belum Ada Data CPL'}
                            </p>
                            <p className="text-xs text-[#64748B]">
                              {hasActiveFilters
                                ? 'Coba sesuaikan kata kunci pencarian atau ubah filter program studi/kurikulum.'
                                : 'Belum ada data Capaian Pembelajaran Lulusan yang tercatat di server.'}
                            </p>
                            {hasActiveFilters && (
                              <button
                                type="button"
                                onClick={handleResetFilters}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A]"
                              >
                                Reset Filter
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedCpls.map((cpl, idx) => {
                        const isExpanded = expandedCplIds.has(cpl.id)
                        const prodi = prodiMap.get(Number(cpl.program_studi_id))
                        const kur = kurikulumMap.get(Number(cpl.kurikulum_version_id))
                        const childIks = iksByCplId.get(Number(cpl.id)) || []

                        return (
                          <Fragment key={cpl.id}>
                            <tr
                              className={`hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                                isExpanded ? 'bg-[#F8FAFC]' : ''
                              }`}
                              onClick={() => toggleExpand(setExpandedCplIds, cpl.id)}
                            >
                              <td className="py-3 px-3 text-center text-[#64748B]">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 mx-auto text-[#1A3A6B]" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 mx-auto text-[#94A3B8]" />
                                )}
                              </td>
                              <td className="py-3 px-3 text-center text-[#64748B]">
                                {(pageCpl - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-[#1A3A6B]">
                                {cpl.kode}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-[#142B4A]">{cpl.deskripsi}</div>
                              </td>
                              {!isSingleProdiRole && (
                                <td className="py-3 px-4">
                                  <div className="font-medium text-[#142B4A]">
                                    {prodi?.nama || `Prodi ID #${cpl.program_studi_id}`}
                                  </div>
                                  <div className="text-[11px] text-[#64748B]">{prodi?.kode || ''}</div>
                                </td>
                              )}
                              <td className="py-3 px-4 text-[#64748B]">
                                <span className="font-medium text-[#142B4A]">
                                  {kur?.version_label || `Kurikulum ID #${cpl.kurikulum_version_id}`}
                                </span>
                                {kur?.semester && (
                                  <span className="block text-[11px]">{kur.semester}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-[#142B4A]">
                                {cpl.threshold_capaian}%
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F1F5F9] border border-[#E2E8F0] text-[#142B4A]">
                                  <Layers className="h-3 w-3 text-[#1A3A6B]" />
                                  <span>{childIks.length} IK</span>
                                </span>
                              </td>
                            </tr>

                            {/* Expanded Row: Hierarki OBE Level 1 -> Level 2 (CPL -> IK) */}
                            {isExpanded && (
                              <tr className="bg-[#F8FAFC]/90">
                                <td colSpan={isSingleProdiRole ? 7 : 8} className="p-4 pl-12 border-t border-[#E2E8F0]">
                                  <div className="rounded border border-[#CBD5E1]/80 bg-white p-4 space-y-3">
                                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-xs text-[#142B4A]">
                                          Hierarki OBE: Indikator Kinerja (IK) turunan dari {cpl.kode}
                                        </span>
                                        <Badge tone="default">{childIks.length} Indikator</Badge>
                                      </div>
                                      <div className="text-[11px] text-[#64748B]">
                                        Tiap IK adalah instrumen ukur operasional dari CPL ini
                                      </div>
                                    </div>

                                    {childIks.length === 0 ? (
                                      <p className="text-xs text-[#64748B] italic py-2">
                                        Belum ada Indikator Kinerja (IK) yang dipetakan ke CPL ini.
                                      </p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                          <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                                            <tr>
                                              <th className="py-2 px-3 w-16 text-center">Urutan</th>
                                              <th className="py-2 px-3 w-28">Kode IK</th>
                                              <th className="py-2 px-3">Deskripsi Indikator Kinerja</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-[#F1F5F9]">
                                            {childIks
                                              .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
                                              .map((ik) => (
                                                <tr key={ik.id} className="hover:bg-slate-50">
                                                  <td className="py-2 px-3 text-center font-mono font-semibold text-[#64748B]">
                                                    {ik.urutan ?? '-'}
                                                  </td>
                                                  <td className="py-2 px-3 font-mono font-bold text-[#1A3A6B]">
                                                    {ik.kode}
                                                  </td>
                                                  <td className="py-2 px-3 text-[#142B4A]">
                                                    {ik.deskripsi}
                                                  </td>
                                                </tr>
                                              ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {renderPagination(
                filteredCpls.length,
                pageCpl,
                setPageCpl,
                pageSize,
                setPageSize
              )}
            </div>
          ) : activeTab === 'ik' ? (
            /* =========================================================================
               TAB 3: IK (INDIKATOR KINERJA)
            ========================================================================= */
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" data-testid="table-ik">
                  <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center"></th>
                      <th className="py-3 px-3 w-12 text-center">No</th>
                      <th className="py-3 px-4 w-28">Kode IK</th>
                      <th className="py-3 px-4 w-20 text-center">Urutan</th>
                      <th className="py-3 px-4">Deskripsi Indikator Kinerja</th>
                      <th className="py-3 px-4 w-64">CPL Induk</th>
                      {!isSingleProdiRole && <th className="py-3 px-4 w-44">Program Studi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {paginatedIks.length === 0 ? (
                      <tr>
                        <td colSpan={isSingleProdiRole ? 6 : 7} className="py-16 text-center text-[#64748B]">
                          <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                            <Layers className="h-8 w-8 text-[#CBD5E1]" />
                            <p className="font-semibold text-sm text-[#142B4A]">
                              {hasActiveFilters
                                ? 'Tidak ada Indikator Kinerja yang cocok'
                                : 'Belum Ada Data Indikator Kinerja'}
                            </p>
                            <p className="text-xs text-[#64748B]">
                              {hasActiveFilters
                                ? 'Coba sesuaikan kata kunci pencarian atau ubah filter program studi/kurikulum.'
                                : 'Belum ada data Indikator Kinerja yang tercatat di server.'}
                            </p>
                            {hasActiveFilters && (
                              <button
                                type="button"
                                onClick={handleResetFilters}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A]"
                              >
                                Reset Filter
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedIks.map((ik, idx) => {
                        const isExpanded = expandedIkIds.has(ik.id)
                        const parentCpl = cplMap.get(Number(ik.cpl_id))
                        const prodi = parentCpl ? prodiMap.get(Number(parentCpl.program_studi_id)) : null
                        const kur = parentCpl ? kurikulumMap.get(Number(parentCpl.kurikulum_version_id)) : null

                        return (
                          <Fragment key={ik.id}>
                            <tr
                              className={`hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                                isExpanded ? 'bg-[#F8FAFC]' : ''
                              }`}
                              onClick={() => toggleExpand(setExpandedIkIds, ik.id)}
                            >
                              <td className="py-3 px-3 text-center text-[#64748B]">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 mx-auto text-[#1A3A6B]" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 mx-auto text-[#94A3B8]" />
                                )}
                              </td>
                              <td className="py-3 px-3 text-center text-[#64748B]">
                                {(pageIk - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-[#1A3A6B]">
                                {ik.kode}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F1F5F9] font-mono text-[11px] font-bold text-[#142B4A]">
                                  {ik.urutan ?? '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-[#142B4A]">{ik.deskripsi}</div>
                              </td>
                              <td className="py-3 px-4">
                                {parentCpl ? (
                                  <div>
                                    <span className="font-mono font-bold text-[#1A3A6B]">{parentCpl.kode}</span>
                                    <span className="block text-[11px] text-[#64748B] line-clamp-1">
                                      {parentCpl.deskripsi}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[#94A3B8]">CPL ID #{ik.cpl_id}</span>
                                )}
                              </td>
                              {!isSingleProdiRole && (
                                <td className="py-3 px-4">
                                  <div className="font-medium text-[#142B4A]">
                                    {prodi?.nama || '-'}
                                  </div>
                                  <div className="text-[11px] text-[#64748B]">{prodi?.kode || ''}</div>
                                </td>
                              )}
                            </tr>

                            {/* Expanded Detail Row for IK */}
                            {isExpanded && (
                              <tr className="bg-[#F8FAFC]/90">
                                <td colSpan={isSingleProdiRole ? 6 : 7} className="p-4 pl-12 border-t border-[#E2E8F0]">
                                  <div className="rounded border border-[#CBD5E1]/80 bg-white p-4 space-y-2">
                                    <div className="text-xs font-semibold text-[#142B4A] flex items-center gap-2 border-b border-[#E2E8F0] pb-2">
                                      <span>Rincian Indikator Kinerja & CPL Induk</span>
                                      <Badge tone="default">{ik.kode}</Badge>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                                      <div>
                                        <span className="text-[#64748B] block text-[11px]">Deskripsi Lengkap IK:</span>
                                        <p className="font-medium text-[#142B4A] mt-0.5">{ik.deskripsi}</p>
                                      </div>
                                      <div>
                                        <span className="text-[#64748B] block text-[11px]">CPL Induk:</span>
                                        {parentCpl ? (
                                          <div className="mt-0.5">
                                            <p className="font-semibold text-[#1A3A6B]">
                                              {parentCpl.kode} (Threshold: {parentCpl.threshold_capaian}%)
                                            </p>
                                            <p className="text-[#64748B] text-[11px] mt-0.5">{parentCpl.deskripsi}</p>
                                            <p className="text-[10px] text-[#94A3B8] mt-1">
                                              Kurikulum: {kur?.version_label || `ID #${parentCpl.kurikulum_version_id}`}
                                            </p>
                                          </div>
                                        ) : (
                                          <p className="text-[#94A3B8]">CPL ID #{ik.cpl_id}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {renderPagination(
                filteredIks.length,
                pageIk,
                setPageIk,
                pageSize,
                setPageSize
              )}
            </div>
          ) : (
            /* =========================================================================
               TAB 4: CPMK (CAPAIAN PEMBELAJARAN MATA KULIAH)
            ========================================================================= */
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" data-testid="table-cpmk">
                  <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center"></th>
                      <th className="py-3 px-3 w-12 text-center">No</th>
                      <th className="py-3 px-4 w-32">Kode CPMK</th>
                      <th className="py-3 px-4">Deskripsi Capaian Mata Kuliah</th>
                      <th className="py-3 px-4 w-28 text-center">Taksonomi</th>
                      <th className="py-3 px-4 w-28 text-center">Bobot</th>
                      <th className="py-3 px-4 w-64">Mata Kuliah Induk</th>
                      <th className="py-3 px-4 w-44 text-center">Status Bobot MK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {paginatedCpmks.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-[#64748B]">
                          <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                            <Award className="h-8 w-8 text-[#CBD5E1]" />
                            <p className="font-semibold text-sm text-[#142B4A]">
                              {hasActiveFilters
                                ? 'Tidak ada CPMK yang cocok'
                                : 'Belum Ada Data CPMK'}
                            </p>
                            <p className="text-xs text-[#64748B]">
                              {hasActiveFilters
                                ? 'Coba sesuaikan kata kunci pencarian atau ubah filter mata kuliah/taksonomi/bobot.'
                                : 'Belum ada data Capaian Pembelajaran Mata Kuliah yang tercatat di server.'}
                            </p>
                            {hasActiveFilters && (
                              <button
                                type="button"
                                onClick={handleResetFilters}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A]"
                              >
                                Reset Filter
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedCpmks.map((cpmk, idx) => {
                        const isExpanded = expandedCpmkIds.has(cpmk.id)
                        const mk = mataKuliahMap.get(Number(cpmk.mata_kuliah_id))
                        const prodi = mk ? prodiMap.get(Number(mk.program_studi_id)) : null
                        const totalBobotMk = totalBobotPerMk.get(Number(cpmk.mata_kuliah_id)) || 0
                        const siblingCpmks = cpmksByMkId.get(Number(cpmk.mata_kuliah_id)) || []
                        const is100Percent = totalBobotMk === 100

                        return (
                          <Fragment key={cpmk.id}>
                            <tr
                              className={`hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                                isExpanded ? 'bg-[#F8FAFC]' : ''
                              }`}
                              onClick={() => toggleExpand(setExpandedCpmkIds, cpmk.id)}
                            >
                              <td className="py-3 px-3 text-center text-[#64748B]">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 mx-auto text-[#1A3A6B]" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 mx-auto text-[#94A3B8]" />
                                )}
                              </td>
                              <td className="py-3 px-3 text-center text-[#64748B]">
                                {(pageCpmk - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-[#1A3A6B]">
                                {cpmk.kode}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-[#142B4A]">{cpmk.deskripsi}</div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#F1F5F9] border border-[#CBD5E1] text-[#142B4A]">
                                  {cpmk.level_taksonomi || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-[#142B4A]">
                                {cpmk.bobot}%
                              </td>
                              <td className="py-3 px-4">
                                {mk ? (
                                  <div>
                                    <div className="font-semibold text-[#142B4A]">
                                      {mk.kode} - {mk.nama}
                                    </div>
                                    <div className="text-[11px] text-[#64748B]">
                                      {mk.sks} SKS · Smt {mk.semester} {prodi ? `· ${prodi.kode}` : ''}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[#94A3B8]">MK ID #{cpmk.mata_kuliah_id}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {is100Percent ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                    <span>Total: 100%</span>
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200"
                                    title="Peringatan OBE: Total bobot seluruh CPMK untuk mata kuliah ini belum mencapai 100%"
                                  >
                                    <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                    <span>{totalBobotMk}% (!= 100%)</span>
                                  </span>
                                )}
                              </td>
                            </tr>

                            {/* Expanded Detail Row for CPMK */}
                            {isExpanded && (
                              <tr className="bg-[#F8FAFC]/90">
                                <td colSpan={8} className="p-4 pl-12 border-t border-[#E2E8F0]">
                                  <div className="rounded border border-[#CBD5E1]/80 bg-white p-4 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-xs text-[#142B4A]">
                                          Mata Kuliah: {mk ? `${mk.kode} - ${mk.nama}` : `ID #${cpmk.mata_kuliah_id}`}
                                        </span>
                                        <Badge tone={is100Percent ? 'success' : 'warning'}>
                                          Akumulasi Bobot: {totalBobotMk}% / 100%
                                        </Badge>
                                      </div>
                                      {!is100Percent && (
                                        <div className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                                          <AlertTriangle className="h-3.5 w-3.5" />
                                          <span>Sesuai PRD: Total bobot CPMK mata kuliah idealnya tepat 100%.</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Sibling CPMK breakdown for this course */}
                                    <div className="space-y-1.5">
                                      <div className="text-[11px] font-semibold text-[#64748B]">
                                        Daftar CPMK pada mata kuliah ini ({siblingCpmks.length} CPMK):
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {siblingCpmks.map((sc) => (
                                          <div
                                            key={sc.id}
                                            className={`rounded border p-2.5 text-xs transition-colors ${
                                              sc.id === cpmk.id
                                                ? 'border-[#1A3A6B] bg-[#1A3A6B]/5 font-semibold'
                                                : 'border-[#E2E8F0] bg-white'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="font-mono text-[#1A3A6B]">{sc.kode}</span>
                                              <span className="font-mono text-[11px] text-[#64748B]">
                                                Bobot: {sc.bobot}%
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-[#64748B] mt-1 line-clamp-2">
                                              {sc.deskripsi}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {renderPagination(
                filteredCpmks.length,
                pageCpmk,
                setPageCpmk,
                pageSize,
                setPageSize
              )}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// Reusable Pagination Controller
function renderPagination(totalItems, currentPage, setPage, pageSize, setPageSize) {
  if (totalItems === 0) return null

  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E2E8F0] px-4 py-3 text-xs text-[#64748B]">
      <div className="flex items-center gap-2">
        <span>
          Menampilkan <span className="font-semibold text-[#142B4A]">{startItem}</span> -{' '}
          <span className="font-semibold text-[#142B4A]">{endItem}</span> dari{' '}
          <span className="font-semibold text-[#142B4A]">{totalItems}</span> data
        </span>
        <span className="text-[#CBD5E1]">|</span>
        <label htmlFor="select-page-size" className="sr-only">Baris per halaman</label>
        <select
          id="select-page-size"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value))
            setPage(1)
          }}
          className="rounded border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
        >
          <option value={10}>10 baris</option>
          <option value={25}>25 baris</option>
          <option value={50}>50 baris</option>
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="rounded border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] disabled:opacity-40 transition-colors"
        >
          Sebelumnya
        </button>

        <span className="px-2 text-xs font-medium text-[#142B4A]">
          Halaman {currentPage} dari {totalPages}
        </span>

        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="rounded border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] disabled:opacity-40 transition-colors"
        >
          Berikutnya
        </button>
      </div>
    </div>
  )
}
