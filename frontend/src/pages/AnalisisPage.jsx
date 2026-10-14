import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart3,
  ChevronRight,
  LineChart as LineChartIcon,
  Layers3,
  BookOpen,
  Filter,
  Download,
  Printer,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Info,
  Building2,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { ActionButton, Badge, PageHeader, SectionCard } from '../components/PageChrome'
import api from '../services/api'
import { getApiErrorMessage } from './superAdminHelpers'
import { exportToCsv } from '../utils/csvExport'
import useAuth from '../hooks/useAuth'
import { useDekanScope } from '../context/DekanScopeContext'
import ProdiSelector from '../components/ProdiSelector'

const CHART_COLORS = [
  '#1A3A6B', // Navy institusional
  '#F4A300', // Orange aksen
  '#10B981', // Emerald sukses
  '#6366F1', // Indigo
  '#F43F5E', // Rose
  '#0EA5E9', // Sky blue
  '#8B5CF6', // Purple
  '#D97706', // Amber
]

export default function AnalisisPage() {
  const [searchParams] = useSearchParams()
  const initialCplId = searchParams.get('cpl_id')
  const { user, activeRole } = useAuth()
  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isDekan = currentRole === 'dekan'
  const { selectedProdiId, selectedProdi } = useDekanScope()

  const [activeTab, setActiveTab] = useState('drilldown') // 'drilldown' | 'trending'

  // Nilai semester mengacu pada SemesterEnum (app/models/enums.py): "Ganjil" | "Genap"
  const [selectedSemester, setSelectedSemester] = useState('')

  // --- State Level 1: CPL Overview ---
  const [cplList, setCplList] = useState([])
  const [selectedCpl, setSelectedCpl] = useState(null)
  const [loadingCpl, setLoadingCpl] = useState(false)
  const [errorCpl, setErrorCpl] = useState(null)

  // --- State Level 2: IK Breakdown ---
  const [ikList, setIkList] = useState([])
  const [selectedIk, setSelectedIk] = useState(null)
  const [loadingIk, setLoadingIk] = useState(false)
  const [errorIk, setErrorIk] = useState(null)

  // --- State Level 3: Mata Kuliah & CPMK Detail ---
  const [courses, setCourses] = useState([])
  const [selectedMkId, setSelectedMkId] = useState('')
  const [mkDashboard, setMkDashboard] = useState(null)
  const [loadingMk, setLoadingMk] = useState(false)
  const [errorMk, setErrorMk] = useState(null)

  // --- State Trending ---
  const [trendingRaw, setTrendingRaw] = useState([])
  const [loadingTrending, setLoadingTrending] = useState(false)
  const [errorTrending, setErrorTrending] = useState(null)
  const [filterYearStart, setFilterYearStart] = useState('')
  const [filterYearEnd, setFilterYearEnd] = useState('')
  const [selectedTrendingCpls, setSelectedTrendingCpls] = useState([])

  // 1. Fetch CPL Overview & Courses on mount / semester change
  const fetchCplOverview = async () => {
    if (isDekan && !selectedProdiId) {
      setCplList([])
      setSelectedCpl(null)
      setCourses([])
      setLoadingCpl(false)
      setErrorCpl(null)
      return
    }

    setLoadingCpl(true)
    setErrorCpl(null)
    try {
      const params = {}
      if (selectedSemester) params.semester = selectedSemester
      if (isDekan && selectedProdiId) params.program_studi_id = Number(selectedProdiId)

      const [cplRes, mkRes] = await Promise.all([
        api.get('/dashboard/cpl-overview', { params }),
        api.get('/mata-kuliah'),
      ])
      const list = Array.isArray(cplRes.data) ? cplRes.data : []
      setCplList(list)
      
      const allCourses = Array.isArray(mkRes.data) ? mkRes.data : []
      if (isDekan && selectedProdiId) {
        setCourses(allCourses.filter((c) => String(c.program_studi_id) === String(selectedProdiId)))
      } else {
        setCourses(allCourses)
      }

      if (list.length > 0) {
        if (selectedCpl) {
          const matched = list.find((c) => String(c.cpl_id) === String(selectedCpl.cpl_id))
          setSelectedCpl(matched || list[0])
        } else if (initialCplId) {
          const matched = list.find((c) => String(c.cpl_id) === String(initialCplId))
          setSelectedCpl(matched || list[0])
        } else {
          setSelectedCpl(list[0])
        }
      } else {
        setSelectedCpl(null)
      }
    } catch (err) {
      console.error('Gagal memuat overview CPL:', err)
      setErrorCpl(getApiErrorMessage(err, 'Gagal memuat daftar ketercapaian CPL'))
    } finally {
      setLoadingCpl(false)
    }
  }

  useEffect(() => {
    fetchCplOverview()
  }, [selectedSemester, isDekan, selectedProdiId])

  // 2. Fetch IK Breakdown when selected CPL or selectedSemester changes
  useEffect(() => {
    if (!selectedCpl?.cpl_id) return
    const fetchIkBreakdown = async () => {
      setLoadingIk(true)
      setErrorIk(null)
      setSelectedIk(null)
      try {
        const params = {}
        if (selectedSemester) params.semester = selectedSemester
        const res = await api.get(`/dashboard/ik-breakdown/${selectedCpl.cpl_id}`, { params })
        const list = Array.isArray(res.data) ? res.data : []
        setIkList(list)
        if (list.length > 0) {
          setSelectedIk(list[0])
        }
      } catch (err) {
        console.warn('Gagal memuat IK breakdown:', err)
        setErrorIk(getApiErrorMessage(err, 'Belum ada data evaluasi IK untuk CPL ini.'))
        setIkList([])
      } finally {
        setLoadingIk(false)
      }
    }
    fetchIkBreakdown()
  }, [selectedCpl?.cpl_id, selectedSemester])

  // 3. Fetch Mata Kuliah detail for Level 3
  useEffect(() => {
    if (courses.length > 0 && !selectedMkId) {
      setSelectedMkId(String(courses[0].id))
    }
  }, [courses, selectedMkId])

  useEffect(() => {
    if (!selectedMkId) return
    const fetchMkDetail = async () => {
      setLoadingMk(true)
      setErrorMk(null)
      try {
        const res = await api.get(`/dashboard/${selectedMkId}`)
        setMkDashboard(res.data)
      } catch (err) {
        console.warn('Gagal memuat detail dashboard MK:', err)
        setErrorMk(getApiErrorMessage(err, 'Belum ada data peserta atau evaluasi untuk mata kuliah ini.'))
        setMkDashboard(null)
      } finally {
        setLoadingMk(false)
      }
    }
    fetchMkDetail()
  }, [selectedMkId])

  // 4. Fetch Trending Data
  const fetchTrendingData = async () => {
    if (isDekan && !selectedProdiId) {
      setTrendingRaw([])
      setLoadingTrending(false)
      setErrorTrending(null)
      return
    }

    setLoadingTrending(true)
    setErrorTrending(null)
    try {
      const params = {}
      if (isDekan && selectedProdiId) params.program_studi_id = Number(selectedProdiId)
      if (filterYearStart) params.year_start = Number(filterYearStart)
      if (filterYearEnd) params.year_end = Number(filterYearEnd)
      if (selectedTrendingCpls.length > 0) {
        params.cpl_ids = selectedTrendingCpls
      }

      const res = await api.get('/trending/cpl-by-angkatan', { params })
      const data = Array.isArray(res.data) ? res.data : []
      setTrendingRaw(data)
    } catch (err) {
      console.error('Gagal memuat data trending:', err)
      setErrorTrending(getApiErrorMessage(err, 'Gagal memuat analisis tren CPL'))
    } finally {
      setLoadingTrending(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'trending') {
      fetchTrendingData()
    }
  }, [activeTab, filterYearStart, filterYearEnd, selectedTrendingCpls, isDekan, selectedProdiId])

  // Transform raw trending data for Recharts LineChart
  const { chartData, cplKeys, trendingYears } = useMemo(() => {
    if (!Array.isArray(trendingRaw) || trendingRaw.length === 0) {
      return { chartData: [], cplKeys: [], trendingYears: [] }
    }

    const angkatanMap = {}
    const keysSet = new Set()
    const yearsSet = new Set()

    trendingRaw.forEach((row) => {
      const year = row.angkatan
      yearsSet.add(year)
      const cplKey = row.cpl_kode || `CPL-${row.cpl_id}`
      keysSet.add(cplKey)

      if (!angkatanMap[year]) {
        angkatanMap[year] = { angkatan: year }
      }
      angkatanMap[year][cplKey] = Number(row.rata_rata || 0)
    })

    const chartData = Object.values(angkatanMap).sort((a, b) => a.angkatan - b.angkatan)
    const cplKeys = Array.from(keysSet).sort()
    const trendingYears = Array.from(yearsSet).sort((a, b) => a - b)

    return { chartData, cplKeys, trendingYears }
  }, [trendingRaw])

  // Mathematical insights from trending
  const trendingInsights = useMemo(() => {
    if (chartData.length < 2 || cplKeys.length === 0) return []

    const firstPoint = chartData[0]
    const lastPoint = chartData[chartData.length - 1]
    const insights = []

    cplKeys.forEach((key) => {
      const vFirst = firstPoint[key]
      const vLast = lastPoint[key]

      if (vFirst !== undefined && vLast !== undefined) {
        const delta = Math.round((vLast - vFirst) * 10) / 10
        let status = 'neutral'
        let text = ''

        if (delta > 2) {
          status = 'positive'
          text = `Meningkat +${delta}% dari angkatan ${firstPoint.angkatan} (${vFirst}%) ke angkatan ${lastPoint.angkatan} (${vLast}%). Efektivitas kurikulum menunjukkan peningkatan positif.`
        } else if (delta < -2) {
          status = 'negative'
          text = `Mengalami penurunan ${delta}% dari angkatan ${firstPoint.angkatan} (${vFirst}%) ke angkatan ${lastPoint.angkatan} (${vLast}%). Memerlukan peninjauan proses pembelajaran dan RPS.`
        } else {
          status = 'neutral'
          text = `Ketercapaian stabil di kisaran ${vLast}% (${delta >= 0 ? '+' : ''}${delta}% dibandingkan angkatan ${firstPoint.angkatan}).`
        }

        insights.push({
          cplKode: key,
          delta,
          status,
          text,
          latestValue: vLast,
        })
      }
    })

    return insights
  }, [chartData, cplKeys])

  // Export IK Breakdown CSV
  const handleExportIkCsv = () => {
    if (ikList.length === 0) {
      alert('Tidak ada data IK untuk diekspor')
      return
    }
    const headers = [
      { key: 'kode', label: 'Kode IK' },
      { key: 'deskripsi', label: 'Indikator Kinerja' },
      { key: 'rata_rata', label: 'Rata-Rata Capaian (%)' },
      { key: 'jumlah_mahasiswa', label: 'Jumlah Mahasiswa' },
      { key: 'status', label: 'Status' },
    ]
    const rows = ikList.map((item) => ({
      ...item,
      status: Number(item.rata_rata) >= (selectedCpl?.threshold || 70) ? 'Tercapai' : 'Perlu Perhatian',
    }))
    exportToCsv(`IK_Breakdown_${selectedCpl?.kode || 'CPL'}`, headers, rows)
  }

  // Export Trending CSV
  const handleExportTrendingCsv = () => {
    if (trendingRaw.length === 0) {
      alert('Tidak ada data tren untuk diekspor')
      return
    }
    const headers = [
      { key: 'angkatan', label: 'Angkatan' },
      { key: 'cpl_kode', label: 'Kode CPL' },
      { key: 'cpl_id', label: 'ID CPL' },
      { key: 'rata_rata', label: 'Rata-Rata Capaian (%)' },
    ]
    exportToCsv(`Tren_CPL_${user?.program_studi_nama || 'Prodi'}`, headers, trendingRaw)
  }

  return (
    <div className="space-y-8 animate-[fadeUp_200ms_ease]">
      <PageHeader
        eyebrow="Analitik Capaian OBE"
        title="Analisis Ketercapaian & Tren Pembelajaran"
        description="Analisis multi-tingkat capaian OBE dari level CPL hingga CPMK, serta tren historis ketercapaian kompetensi antar angkatan."
        badge={isDekan ? 'Mode Lihat (Dekan)' : (user?.program_studi_nama || 'Program Studi')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Opsi semester statis mengacu pada SemesterEnum (app/models/enums.py) - hanya relevan untuk tab drilldown */}
            {activeTab === 'drilldown' && (
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="h-9 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                data-testid="analisis-semester-filter"
              >
                <option value="">Semua Semester</option>
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
              </select>
            )}
            <ActionButton variant="secondary" onClick={() => window.print()} data-testid="analysis-print">
              <Printer className="h-4 w-4" />
              Print
            </ActionButton>
          </div>
        }
      />

      {isDekan && <ProdiSelector />}

      {isDekan && !selectedProdiId ? (
        <div
          data-testid="dekan-analisis-empty-prodi"
          className="rounded-[6px] border border-dashed border-[#94A3B8] bg-white p-12 text-center"
        >
          <Building2 className="mx-auto h-10 w-10 text-[#64748B]" />
          <h3 className="mt-3 text-sm font-bold text-[#142B4A]">Pilih Program Studi</h3>
          <p className="mt-1 text-xs text-[#64748B] max-w-md mx-auto">
            Silakan pilih salah satu program studi di atas untuk memantau drill-down analitik OBE (CPL → IK → CPMK) dan evaluasi tren angkatan.
          </p>
        </div>
      ) : (
        <>
          {/* Tab Switcher */}
          <div className="flex border-b border-[#CBD5E1]">
            <button
              type="button"
              onClick={() => setActiveTab('drilldown')}
              data-testid="tab-drilldown"
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'drilldown'
                  ? 'border-[#1A3A6B] text-[#1A3A6B]'
                  : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
              }`}
            >
          <Layers3 className="h-4 w-4" />
          Drill-Down 3-Level (CPL → IK → CPMK)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trending')}
          data-testid="tab-trending"
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'trending'
              ? 'border-[#1A3A6B] text-[#1A3A6B]'
              : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Tren Antar Angkatan (Feature 7)
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: DRILL-DOWN 3-LEVEL                            */}
      {/* ==================================================== */}
      {activeTab === 'drilldown' && (
        <div className="space-y-6">
          {/* Breadcrumb Hierarchy */}
          <SectionCard title="Navigasi Hirarki OBE" description="Ketercapaian dihitung secara berjenjang dari CPL, IK, hingga CPMK.">
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#64748B]">
              <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 font-medium">
                Level 1 · CPL Overview
              </span>
              <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
              <span className="rounded-md border border-[#1A3A6B]/20 bg-white px-3 py-1.5 font-semibold text-[#1A3A6B]">
                {selectedCpl ? `${selectedCpl.kode} (${Number(selectedCpl.rata_rata).toFixed(1)}%)` : 'Pilih CPL'}
              </span>
              <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
              <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 font-medium">
                Level 2 · IK Breakdown
              </span>
              <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
              <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 font-medium">
                Level 3 · CPMK & Mata Kuliah
              </span>
            </div>
          </SectionCard>

          {errorCpl && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorCpl}</span>
            </div>
          )}

          {/* Grid Level 1 & Level 2 */}
          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            {/* Level 1: CPL Overview */}
            <SectionCard
              title="Level 1: Capaian Pembelajaran Lulusan (CPL)"
              description="Pilih salah satu CPL untuk melihat rincian Indikator Kinerja (IK) pendukungnya."
            >
              {loadingCpl ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded bg-[#F8FAFC]" />
                  ))}
                </div>
              ) : cplList.length === 0 ? (
                <div className="py-10 text-center text-sm text-[#64748B]">
                  Belum ada data capaian CPL yang tersedia untuk prodi ini.
                </div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {cplList.map((item) => {
                    const isSelected = selectedCpl?.cpl_id === item.cpl_id
                    const avg = Number(item.rata_rata || 0)
                    const th = Number(item.threshold || 70)
                    const isAchieved = avg >= th

                    return (
                      <button
                        key={item.cpl_id}
                        type="button"
                        onClick={() => setSelectedCpl(item)}
                        data-testid={`drilldown-cpl-${item.kode.toLowerCase()}`}
                        className={`w-full rounded-lg border p-4 text-left transition-all ${
                          isSelected
                            ? 'border-[#1A3A6B] bg-[#F8FAFC] shadow-sm ring-1 ring-[#1A3A6B]'
                            : 'border-[#E2E8F0] bg-white hover:border-[#1A3A6B]/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D778E]">
                              {item.kode}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-[#142B4A] line-clamp-1">
                              {item.deskripsi || item.kode}
                            </div>
                          </div>
                          <Badge tone={isAchieved ? 'success' : 'warning'}>
                            {isAchieved ? 'Tercapai' : 'Perlu Perhatian'}
                          </Badge>
                        </div>

                        <div className="mt-3 flex items-end justify-between text-xs text-[#64748B]">
                          <span>{item.jumlah_mahasiswa} mahasiswa dievaluasi</span>
                          <span className="text-base font-bold text-[#142B4A]">
                            {avg.toFixed(1)}%
                          </span>
                        </div>

                        <div className="mt-2 h-1.5 rounded-full bg-[#E2E8F0]">
                          <div
                            className={`h-1.5 rounded-full ${isAchieved ? 'bg-[#1A3A6B]' : 'bg-[#F4A300]'}`}
                            style={{ width: `${Math.min(avg, 100)}%` }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </SectionCard>

            {/* Level 2: IK Breakdown */}
            <SectionCard
              title={`Level 2: Rincian IK untuk ${selectedCpl ? selectedCpl.kode : '-'}`}
              description="Indikator Kinerja yang mengukur pencapaian CPL terpilih beserta rata-rata capaian."
              action={
                <ActionButton
                  variant="secondary"
                  onClick={handleExportIkCsv}
                  disabled={ikList.length === 0}
                  data-testid="btn-export-ik-csv"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </ActionButton>
              }
            >
              {loadingIk ? (
                <div className="space-y-3 py-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded bg-[#F8FAFC]" />
                  ))}
                </div>
              ) : errorIk ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
                  <Info className="h-6 w-6 mx-auto mb-2 text-amber-600" />
                  <p className="font-semibold">{errorIk}</p>
                </div>
              ) : ikList.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#64748B]">
                  Tidak ada Indikator Kinerja yang ditemukan untuk CPL ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm" data-testid="table-ik-breakdown">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
                        <th className="pb-3">Kode IK</th>
                        <th className="pb-3">Nama / Deskripsi Indikator</th>
                        <th className="pb-3">Ketercapaian</th>
                        <th className="pb-3 text-right">Mahasiswa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2F4F7]">
                      {ikList.map((ik) => {
                        const avg = Number(ik.rata_rata || 0)
                        const target = Number(selectedCpl?.threshold || 70)
                        const isAchieved = avg >= target
                        const isSelected = selectedIk?.ik_id === ik.ik_id

                        return (
                          <tr
                            key={ik.ik_id}
                            onClick={() => setSelectedIk(ik)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-[#F8FAFC]' : 'hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <td className="py-3.5 font-bold text-[#142B4A]">
                              <div className="flex items-center gap-1.5">
                                <span>{ik.kode}</span>
                                {isSelected && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#1A3A6B]" />
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 text-xs text-[#142B4A] max-w-xs pr-4">
                              {ik.deskripsi || '-'}
                            </td>
                            <td className="py-3.5">
                              <div className="w-32">
                                <div className="mb-1 flex items-center justify-between text-xs">
                                  <span className="font-bold text-[#142B4A]">{avg.toFixed(1)}%</span>
                                  <Badge tone={isAchieved ? 'success' : 'warning'}>
                                    {isAchieved ? 'Tercapai' : 'Kurang'}
                                  </Badge>
                                </div>
                                <div className="h-1.5 rounded-full bg-[#E2E8F0]">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      isAchieved ? 'bg-[#1A3A6B]' : 'bg-[#F4A300]'
                                    }`}
                                    style={{ width: `${Math.min(avg, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 text-right text-xs text-[#64748B]">
                              {ik.jumlah_mahasiswa} orang
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Level 3: Evaluasi CPMK per Mata Kuliah */}
          <SectionCard
            title="Level 3: Evaluasi CPMK Pendukung per Mata Kuliah"
            description="Detail ketercapaian CPMK dan kontribusi indikator kinerja pada mata kuliah terpilih."
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[#142B4A]">Pilih Mata Kuliah:</span>
                <select
                  value={selectedMkId}
                  onChange={(e) => setSelectedMkId(e.target.value)}
                  className="h-9 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                  data-testid="select-level3-mk"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.kode} - {c.nama} ({c.sks} SKS, Smt {c.semester})
                    </option>
                  ))}
                </select>
              </div>

              {/* Deviasi PRD Label Note */}
              <div className="flex items-center gap-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 text-[11px] text-[#64748B]">
                <Info className="h-3.5 w-3.5 text-[#1A3A6B] shrink-0" />
                <span>
                  Evaluasi CPMK diagregasi per mata kuliah melalui <code>/dashboard/{'{matkul_id}'}</code>
                </span>
              </div>
            </div>

            {loadingMk ? (
              <div className="space-y-3 py-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-[#F8FAFC]" />
                ))}
              </div>
            ) : errorMk ? (
              <div className="py-8 text-center text-xs text-[#64748B]">
                {errorMk}
              </div>
            ) : !mkDashboard ? (
              <div className="py-8 text-center text-xs text-[#64748B]">
                Pilih mata kuliah untuk melihat capaian CPMK.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Ringkasan Nilai Mata Kuliah */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center">
                    <span className="text-[11px] text-[#64748B]">Jumlah Mahasiswa Peserta</span>
                    <div className="mt-1 text-xl font-bold text-[#142B4A]">
                      {mkDashboard.jumlah_peserta}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center">
                    <span className="text-[11px] text-[#64748B]">Rata-Rata Nilai Akhir</span>
                    <div className="mt-1 text-xl font-bold text-[#142B4A]">
                      {mkDashboard.rata_rata_nilai_akhir
                        ? Number(mkDashboard.rata_rata_nilai_akhir).toFixed(1)
                        : '-'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center">
                    <span className="text-[11px] text-[#64748B]">Jumlah CPMK Terpetakan</span>
                    <div className="mt-1 text-xl font-bold text-[#142B4A]">
                      {mkDashboard.cpmk_breakdown?.length || 0}
                    </div>
                  </div>
                </div>

                {/* Tabel CPMK */}
                <div>
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#142B4A]">
                    Daftar Capaian CPMK Mata Kuliah
                  </h4>
                  {mkDashboard.cpmk_breakdown?.length === 0 ? (
                    <p className="text-xs text-[#64748B]">Belum ada data CPMK untuk mata kuliah ini.</p>
                  ) : (
                    <table className="w-full text-left text-sm" data-testid="table-level3-cpmk">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
                          <th className="pb-2">Kode CPMK</th>
                          <th className="pb-2">Rata-Rata Capaian</th>
                          <th className="pb-2">Mahasiswa Memenuhi</th>
                          <th className="pb-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F2F4F7]">
                        {mkDashboard.cpmk_breakdown.map((cpmk) => {
                          const avg = Number(cpmk.rata_rata || 0)
                          const isPass = avg >= 70
                          return (
                            <tr key={cpmk.cpmk_id} className="hover:bg-[#F8FAFC]">
                              <td className="py-3 font-bold text-[#142B4A]">{cpmk.kode}</td>
                              <td className="py-3">
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-xs text-[#142B4A]">
                                    {avg.toFixed(1)}%
                                  </span>
                                  <div className="h-1.5 w-24 rounded-full bg-[#E2E8F0]">
                                    <div
                                      className={`h-1.5 rounded-full ${isPass ? 'bg-[#10B981]' : 'bg-[#F4A300]'}`}
                                      style={{ width: `${Math.min(avg, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 text-xs text-[#64748B]">
                                {cpmk.jumlah_tercapai} / {cpmk.jumlah_peserta} mahasiswa
                              </td>
                              <td className="py-3 text-right">
                                <Badge tone={isPass ? 'success' : 'warning'}>
                                  {isPass ? 'Tercapai' : 'Perlu Evaluasi'}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: TRENDING ANALYSIS ANTAR ANGKATAN             */}
      {/* ==================================================== */}
      {activeTab === 'trending' && (
        <div className="space-y-6">
          {/* Controls & Filter */}
          <SectionCard
            title="Filter Periode Angkatan"
            description="Tentukan rentang tahun angkatan masuk mahasiswa untuk meneliti efektivitas kurikulum secara longitudinal."
            action={
              <ActionButton
                variant="secondary"
                onClick={handleExportTrendingCsv}
                disabled={trendingRaw.length === 0}
                data-testid="btn-export-trending-csv"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </ActionButton>
            }
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#142B4A]">Mulai Angkatan:</span>
                <input
                  type="number"
                  placeholder="Contoh: 2021"
                  value={filterYearStart}
                  onChange={(e) => setFilterYearStart(e.target.value)}
                  className="h-9 w-28 rounded-md border border-[#CBD5E1] bg-white px-2.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                  data-testid="input-trending-year-start"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#142B4A]">Sampai Angkatan:</span>
                <input
                  type="number"
                  placeholder="Contoh: 2024"
                  value={filterYearEnd}
                  onChange={(e) => setFilterYearEnd(e.target.value)}
                  className="h-9 w-28 rounded-md border border-[#CBD5E1] bg-white px-2.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                  data-testid="input-trending-year-end"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setFilterYearStart('')
                  setFilterYearEnd('')
                }}
                className="text-xs text-[#64748B] hover:text-[#1A3A6B] underline font-medium"
              >
                Reset Filter
              </button>
            </div>
          </SectionCard>

          {errorTrending && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorTrending}</span>
            </div>
          )}

          {/* Grid Chart & Insights */}
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            {/* Line Chart Tren CPL */}
            <SectionCard
              title="Grafik Tren Ketercapaian CPL Antar Angkatan"
              description="Pergerakan nilai rata-rata ketercapaian per CPL dari waktu ke waktu."
            >
              {loadingTrending ? (
                <div className="flex h-[360px] items-center justify-center">
                  <div className="text-xs text-[#64748B]">Memuat grafik tren CPL...</div>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex h-[360px] flex-col items-center justify-center text-center p-6 border border-dashed border-[#CBD5E1] rounded-lg">
                  <TrendingUp className="h-10 w-10 text-[#94A3B8] mb-2" />
                  <p className="font-semibold text-sm text-[#142B4A]">Belum Ada Data Historis Angkatan</p>
                  <p className="text-xs text-[#64748B] max-w-sm mt-1">
                    Data tren membutuhkan catatan kalkulasi CPL yang memiliki atribut angkatan mahasiswa.
                  </p>
                </div>
              ) : (
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ left: -10, right: 16, top: 12, bottom: 4 }}>
                      <CartesianGrid stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="angkatan" tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, '']} />
                      <Legend />
                      {cplKeys.map((key, idx) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={key}
                          stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            {/* Insight Deterministik (Murni Dihitung Matematis) */}
            <SectionCard
              title="Ringkasan Perubahan (Insight)"
              description="Perubahan dihitung secara deterministik dari data historis angkatan yang tersedia."
            >
              {loadingTrending ? (
                <div className="space-y-3 py-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded bg-[#F8FAFC]" />
                  ))}
                </div>
              ) : trendingInsights.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#64748B]">
                  Perlu minimal dua titik angkatan berbeda untuk menghitung perubahan tren.
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {trendingInsights.map((insight) => (
                    <div
                      key={insight.cplKode}
                      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[#142B4A]">
                          {insight.cplKode}
                        </span>
                        <Badge
                          tone={
                            insight.status === 'positive'
                              ? 'success'
                              : insight.status === 'negative'
                              ? 'danger'
                              : 'default'
                          }
                        >
                          {insight.delta > 0
                            ? `+${insight.delta}%`
                            : `${insight.delta}%`}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-[#64748B] leading-relaxed">
                        {insight.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Tabel Matriks Trending */}
          {chartData.length > 0 && (
            <SectionCard
              title="Tabel Matriks Capaian Antar Angkatan"
              description="Tabel rekapitulasi nilai rata-rata ketercapaian per CPL."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" data-testid="table-trending-matrix">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
                      <th className="pb-3">Tahun Angkatan</th>
                      {cplKeys.map((k) => (
                        <th key={k} className="pb-3 text-right">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F4F7]">
                    {chartData.map((row) => (
                      <tr key={row.angkatan} className="hover:bg-[#F8FAFC]">
                        <td className="py-3 font-bold text-[#142B4A]">{row.angkatan}</td>
                        {cplKeys.map((k) => (
                          <td key={k} className="py-3 text-right text-xs font-medium text-[#142B4A]">
                            {row[k] !== undefined ? `${Number(row[k]).toFixed(1)}%` : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      )}
        </>
      )}
    </div>
  )
}
