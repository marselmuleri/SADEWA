import { useEffect, useMemo, useRef, useState } from 'react'
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
  ClipboardList,
  GitCompareArrows,
  SlidersHorizontal,
  Grid3x3,
  Users,
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
import useDosenCourses from '../hooks/useDosenCourses'
import { getApiErrorMessage } from './superAdminHelpers'
import { exportToCsv } from '../utils/csvExport'
import useAuth from '../hooks/useAuth'
import { useDekanScope } from '../context/DekanScopeContext'
import ProdiSelector from '../components/ProdiSelector'
import { buildModel } from '../components/analitik/analitikModel'
import RingkasanEvaluasi from '../components/analitik/RingkasanEvaluasi'
import PerbandinganAngkatan from '../components/analitik/PerbandinganAngkatan'
import SimulatorThreshold from '../components/analitik/SimulatorThreshold'
import PetaKurikulum from '../components/analitik/PetaKurikulum'
import CpmkPendukungIk from '../components/analitik/CpmkPendukungIk'
import DrilldownModel from '../components/analitik/DrilldownModel'
import TrenAngkatan from '../components/analitik/TrenAngkatan'
import SearchableSelect from '../components/SearchableSelect'
import AnalitikMahasiswa from '../components/analitik/AnalitikMahasiswa'

const MODE_ANALISIS = [
  { id: 'mk', label: 'Per Mata Kuliah', icon: BookOpen },
  { id: 'mahasiswa', label: 'Per Mahasiswa', icon: Users },
]

// Pemilih sudut pandang analisis: agregat per mata kuliah/prodi atau per mahasiswa.
function ModeAnalisisSwitch({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-[#CBD5E1] bg-white p-1 shadow-sm" role="radiogroup" aria-label="Mode analisis">
      {MODE_ANALISIS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          data-testid={`mode-analisis-${id}`}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            value === id ? 'bg-[#1A3A6B] text-white' : 'text-[#64748B] hover:text-[#142B4A]'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  )
}

// Tab Analitik OBE tingkat prodi (Kaprodi & Dekan)
const TABS = [
  { id: 'ringkasan', label: 'Ringkasan Evaluasi', icon: ClipboardList },
  { id: 'drilldown', label: 'Drill-Down CPL → IK → CPMK', icon: Layers3 },
  { id: 'perbandingan', label: 'Perbandingan Angkatan', icon: GitCompareArrows },
  { id: 'trending', label: 'Tren Antar Angkatan', icon: TrendingUp },
  { id: 'simulator', label: 'Simulator Threshold', icon: SlidersHorizontal },
  { id: 'peta', label: 'Peta Kurikulum', icon: Grid3x3 },
]

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
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCplId = searchParams.get('cpl_id')
  const analisisMode = searchParams.get('mode') === 'mahasiswa' ? 'mahasiswa' : 'mk'
  const setAnalisisMode = (mode) => {
    const next = new URLSearchParams(searchParams)
    if (mode === 'mahasiswa') next.set('mode', 'mahasiswa')
    else next.delete('mode')
    setSearchParams(next, { replace: true })
  }
  const { user, activeRole } = useAuth()
  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isDosen = currentRole === 'dosen'
  const isDekan = currentRole === 'dekan'

  // Dosen specific states
  const { courses: dosenCourses, loading: loadingDosenCourses, error: errorDosenCourses, reload: reloadDosenCourses } = useDosenCourses()
  const [selectedDosenMkId, setSelectedDosenMkId] = useState('')
  const [dosenMkData, setDosenMkData] = useState(null)
  const [loadingDosenMk, setLoadingDosenMk] = useState(false)
  const [errorDosenMk, setErrorDosenMk] = useState(null)
  // Tab analitik Dosen (fitur sama dengan Kaprodi, cakupan 1 mata kuliah)
  const [dosenTab, setDosenTab] = useState('ringkasan')
  const [dosenFocus, setDosenFocus] = useState(null)
  const [mkAnalitik, setMkAnalitik] = useState(null)
  const [loadingMkAnalitik, setLoadingMkAnalitik] = useState(false)
  const [errorMkAnalitik, setErrorMkAnalitik] = useState(null)
  // Kaprodi/Dekan: cakupan analitik. '' = seluruh prodi, selain itu id mata kuliah.
  const [scopeMkId, setScopeMkId] = useState('')
  const { selectedProdiId, selectedProdi } = useDekanScope()

  // Dari Ikhtisar (klik kartu CPL) langsung ke drill-down; selain itu mulai dari ringkasan.
  const [activeTab, setActiveTab] = useState(initialCplId ? 'drilldown' : 'ringkasan')

  // --- Data agregat Analitik OBE tingkat prodi (GET /analitik/prodi) ---
  const [analitikData, setAnalitikData] = useState(null)
  const [loadingAnalitik, setLoadingAnalitik] = useState(false)
  const [errorAnalitik, setErrorAnalitik] = useState(null)
  const pendingIkIdRef = useRef(null)

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
  // Kurikulum aktif prodi (ditetapkan Admin Prodi); seluruh analitik prodi memakai versi ini
  const [kurikulumAktif, setKurikulumAktif] = useState(null)
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
    if (isDosen) return
    if (isDekan && !selectedProdiId) {
      setCplList([])
      setSelectedCpl(null)
      setCourses([])
      setKurikulumAktif(null)
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

      const aktifParams = isDekan && selectedProdiId ? { program_studi_id: Number(selectedProdiId) } : {}
      const [cplRes, mkRes, aktifRes] = await Promise.all([
        api.get('/dashboard/cpl-overview', { params }),
        api.get('/mata-kuliah'),
        api.get('/kurikulum/versions/aktif', { params: aktifParams }),
      ])
      const list = Array.isArray(cplRes.data) ? cplRes.data : []
      setCplList(list)

      const aktif = aktifRes.data || null
      setKurikulumAktif(aktif)
      const aktifId = aktif?.kurikulum?.id
      const allCourses = Array.isArray(mkRes.data) ? mkRes.data : []
      setCourses(
        allCourses.filter((c) =>
          (!isDekan || String(c.program_studi_id) === String(selectedProdiId))
          && aktifId != null && String(c.kurikulum_version_id) === String(aktifId)
        )
      )

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

  // Data agregat untuk Ringkasan, Perbandingan, Simulator, Peta, dan Level 3 drill-down
  const fetchAnalitik = async () => {
    if (isDosen || (isDekan && !selectedProdiId)) {
      setAnalitikData(null)
      return
    }
    setLoadingAnalitik(true)
    setErrorAnalitik(null)
    try {
      const params = {}
      if (selectedSemester) params.semester = selectedSemester
      if (isDekan) params.program_studi_id = Number(selectedProdiId)
      const res = await api.get('/analitik/prodi', { params })
      setAnalitikData(res.data)
    } catch (err) {
      setErrorAnalitik(getApiErrorMessage(err, 'Gagal memuat data analitik prodi'))
      setAnalitikData(null)
    } finally {
      setLoadingAnalitik(false)
    }
  }

  useEffect(() => {
    fetchAnalitik()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDosen, isDekan, selectedProdiId, selectedSemester])

  const model = useMemo(() => buildModel(analitikData), [analitikData])

  // Navigasi dari kartu temuan / papan prioritas ke tab lain
  const handleNavigate = ({ tab, cplId, ikId, mkId }) => {
    if (cplId) {
      const target = cplList.find((c) => String(c.cpl_id) === String(cplId))
      pendingIkIdRef.current = ikId ?? null
      if (target) {
        if (selectedCpl?.cpl_id === target.cpl_id && ikId) {
          const ik = ikList.find((i) => i.ik_id === ikId)
          if (ik) setSelectedIk(ik)
        }
        setSelectedCpl(target)
      }
    }
    if (mkId) setSelectedMkId(String(mkId))
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 2. Fetch IK Breakdown when selected CPL or selectedSemester changes
  useEffect(() => {
    if (isDosen || !selectedCpl?.cpl_id) return
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
          const pending = list.find((i) => i.ik_id === pendingIkIdRef.current)
          setSelectedIk(pending || list[0])
        }
        pendingIkIdRef.current = null
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
    if (isDosen) return
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

  // Auto-select first course for Dosen
  useEffect(() => {
    if (isDosen && dosenCourses.length > 0 && !selectedDosenMkId) {
      setSelectedDosenMkId(dosenCourses[0].id)
    }
  }, [isDosen, dosenCourses, selectedDosenMkId])

  // Fetch Dosen course-level analysis from /dashboard/{matkul_id}
  useEffect(() => {
    if (!isDosen || !selectedDosenMkId) return
    let cancelled = false
    const fetchDosenMk = async () => {
      setLoadingDosenMk(true)
      setErrorDosenMk(null)
      try {
        const res = await api.get(`/dashboard/${selectedDosenMkId}`)
        if (!cancelled) {
          setDosenMkData(res.data)
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Gagal memuat dashboard mata kuliah:', err)
          setErrorDosenMk(getApiErrorMessage(err, 'Gagal memuat analisis mata kuliah'))
          setDosenMkData(null)
        }
      } finally {
        if (!cancelled) {
          setLoadingDosenMk(false)
        }
      }
    }
    fetchDosenMk()
    return () => {
      cancelled = true
    }
  }, [isDosen, selectedDosenMkId])

  const activeMkId = isDosen ? selectedDosenMkId : scopeMkId

  const fetchMkAnalitik = async () => {
    if (!activeMkId) {
      setMkAnalitik(null)
      return
    }
    setLoadingMkAnalitik(true)
    setErrorMkAnalitik(null)
    try {
      const res = await api.get(`/analitik/mata-kuliah/${activeMkId}`)
      setMkAnalitik(res.data)
    } catch (err) {
      setErrorMkAnalitik(getApiErrorMessage(err, 'Gagal memuat analitik mata kuliah'))
      setMkAnalitik(null)
    } finally {
      setLoadingMkAnalitik(false)
    }
  }

  useEffect(() => {
    setDosenFocus(null)
    fetchMkAnalitik()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMkId])

  // Ganti prodi (Dekan) -> kembali ke cakupan seluruh prodi
  useEffect(() => {
    setScopeMkId('')
  }, [selectedProdiId])

  const mkModel = useMemo(() => buildModel(mkAnalitik), [mkAnalitik])

  const handleNavigateDosen = ({ tab, cplId, ikId }) => {
    if (cplId) setDosenFocus({ cplId, ikId, t: Date.now() })
    setDosenTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNavigateMk = ({ tab, cplId, ikId }) => {
    if (cplId) setDosenFocus({ cplId, ikId, t: Date.now() })
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Isi tab untuk cakupan satu mata kuliah (Dosen, atau Kaprodi/Dekan yang memilih MK)
  const renderKontenMk = (tab, onNavigate) => {
    if (loadingMkAnalitik) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-white" />)}
        </div>
      )
    }
    if (errorMkAnalitik) {
      return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <span className="flex items-center gap-2"><AlertCircle className="h-5 w-5 shrink-0" />{errorMkAnalitik}</span>
          <ActionButton variant="secondary" onClick={fetchMkAnalitik}><RefreshCw className="h-4 w-4" />Coba lagi</ActionButton>
        </div>
      )
    }
    if (!mkModel) return null
    return (
      <>
        {mkModel.cpl.length > 0 && mkModel.cpl.every((c) => mkModel.values(c.cpl_id).length === 0) && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800" data-testid="notice-cpl-mk-kosong">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Capaian CPL untuk mata kuliah ini belum tersedia, sehingga analisis level CPL masih kosong. Jalankan
              kalkulasi ulang di halaman <span className="font-semibold">Penilaian</span> agar capaian CPL tercatat per mata kuliah.
              Analisis level CPMK tetap bisa dipakai.
            </span>
          </div>
        )}
        {tab === 'ringkasan' && <RingkasanEvaluasi model={mkModel} onNavigate={onNavigate} />}
        {tab === 'drilldown' && <DrilldownModel model={mkModel} focus={dosenFocus} />}
        {tab === 'perbandingan' && <PerbandinganAngkatan model={mkModel} />}
        {tab === 'trending' && <TrenAngkatan model={mkModel} />}
        {tab === 'simulator' && <SimulatorThreshold model={mkModel} />}
        {tab === 'peta' && <PetaKurikulum model={mkModel} />}
      </>
    )
  }

  if (isDosen) {
    const selectedCourse = dosenCourses.find((c) => String(c.id) === String(selectedDosenMkId))
    return (
      <div className="space-y-6 animate-[fadeUp_200ms_ease]">
        <PageHeader
          eyebrow="Analitik Capaian Mata Kuliah"
          title="Analisis Ketercapaian Pembelajaran"
          description="Fitur analitik yang sama dengan tingkat prodi, dengan cakupan mata kuliah yang Anda ampu, per mata kuliah maupun per mahasiswa."
          badge="Mode Dosen Pengampu"
          actions={
            <ActionButton variant="secondary" onClick={() => window.print()} data-testid="analysis-print-dosen">
              <Printer className="h-4 w-4" />
              Print
            </ActionButton>
          }
        />

        {/* Notice Cakupan Wewenang */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-xs text-[#142B4A]">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-[#1A3A6B] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm">Cakupan Analisis Dosen Pengampu</span>
              <p className="mt-1 text-[#64748B] leading-relaxed">
                {analisisMode === 'mahasiswa'
                  ? 'Mode per mahasiswa menampilkan mahasiswa peserta mata kuliah yang Anda ampu. Capaian CPL, IK, dan CPMK setiap mahasiswa hanya dihitung dari mata kuliah tersebut.'
                  : 'Semua angka di halaman ini hanya dihitung dari mata kuliah yang dipilih: CPL dan IK yang diukur mata kuliah ini, CPMK-nya, serta perbandingan antar angkatan mahasiswa yang mengikutinya.'}{' '}
                Analisis lintas mata kuliah tingkat prodi merupakan wewenang Kaprodi dan Dekan.
              </p>
            </div>
          </div>
        </div>

        <ModeAnalisisSwitch value={analisisMode} onChange={setAnalisisMode} />

        {analisisMode === 'mahasiswa' ? (
          <AnalitikMahasiswa isDosen courses={dosenCourses} />
        ) : (
        <>
        {/* Course Selector */}
        <SectionCard
          title="Pilih Mata Kuliah Pengampu"
          description="Pilih mata kuliah aktif untuk memuat ringkasan ketercapaian CPMK dan IK."
          action={
            selectedCourse && (
              <Badge tone="default">
                {selectedCourse.kode} · {selectedCourse.sks} SKS · {selectedCourse.semester} {selectedCourse.tahun_ajaran || '2024/2025'}
              </Badge>
            )
          }
        >
          {loadingDosenCourses ? (
            <div className="flex items-center gap-2 text-xs text-[#64748B] py-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#1A3A6B]" />
              <span>Memuat mata kuliah yang Anda ampu...</span>
            </div>
          ) : errorDosenCourses ? (
            <div className="py-4 text-center text-xs">
              <p className="font-semibold text-red-600 mb-1">Gagal memuat mata kuliah yang diampu</p>
              <p className="text-[#64748B] mb-2">{errorDosenCourses}</p>
              <button
                type="button"
                onClick={() => reloadDosenCourses()}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Muat Ulang</span>
              </button>
            </div>
          ) : dosenCourses.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#64748B]">
              Anda belum terdaftar sebagai pengampu mata kuliah pada semester ini.
            </div>
          ) : (
            <div className="max-w-md">
              <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                Mata Kuliah Yang Diampu
              </label>
              <SearchableSelect
                value={selectedDosenMkId}
                onChange={(val) => setSelectedDosenMkId(String(val))}
                buttonClassName="text-xs"
                data-testid="dosen-course-select"
                aria-label="Mata kuliah yang diampu"
                searchPlaceholder="Cari kode atau nama mata kuliah..."
                options={dosenCourses.map((c) => ({
                  value: c.id,
                  label: `${c.kode} - ${c.nama}`,
                  description: `${c.sks} SKS · Semester ${c.semester}`,
                  searchText: c.nama,
                }))}
              />
            </div>
          )}
        </SectionCard>

        {/* Course Dashboard Content */}
        {selectedDosenMkId && (
          loadingDosenMk ? (
            <div className="rounded-lg border border-[#E2E8F0] bg-white p-12 text-center text-xs text-[#64748B]">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#1A3A6B] mb-2" />
              <span>Memuat data evaluasi capaian mata kuliah...</span>
            </div>
          ) : errorDosenMk ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-xs text-amber-800">
              <AlertCircle className="h-6 w-6 mx-auto text-amber-600 mb-2" />
              <p className="font-semibold">{errorDosenMk}</p>
              <p className="text-[11px] text-amber-700 mt-1">
                Pastikan mahasiswa peserta dan komponen penilaian telah dikonfigurasikan serta kalkulasi evaluasi telah dijalankan.
              </p>
            </div>
          ) : dosenMkData ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase text-[#64748B]">Total Peserta</span>
                  <div className="mt-2 text-2xl font-bold text-[#142B4A]">
                    {dosenMkData.jumlah_peserta ?? 0}
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Mahasiswa terdaftar</span>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase text-[#64748B]">Rata-rata Nilai Akhir</span>
                  <div className="mt-2 text-2xl font-bold text-[#1A3A6B]">
                    {dosenMkData.rata_rata_nilai_akhir != null ? Number(dosenMkData.rata_rata_nilai_akhir).toFixed(1) : '-'}
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Skala 0 - 100</span>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase text-[#64748B]">Jumlah CPMK</span>
                  <div className="mt-2 text-2xl font-bold text-[#142B4A]">
                    {Array.isArray(dosenMkData.cpmk_breakdown) ? dosenMkData.cpmk_breakdown.length : 0}
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Sub-capaian mata kuliah</span>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase text-[#64748B]">Jumlah IK Terpetakan</span>
                  <div className="mt-2 text-2xl font-bold text-[#142B4A]">
                    {Array.isArray(dosenMkData.ik_breakdown) ? dosenMkData.ik_breakdown.length : 0}
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Indikator kinerja</span>
                </div>
              </div>

              {/* Tab analitik (fitur sama dengan Kaprodi, cakupan mata kuliah ini) */}
              <div className="flex overflow-x-auto border-b border-[#CBD5E1]" role="tablist">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={dosenTab === id}
                    onClick={() => setDosenTab(id)}
                    data-testid={`dosen-tab-${id}`}
                    className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      dosenTab === id ? 'border-[#1A3A6B] text-[#1A3A6B]' : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {id === 'peta' ? 'Peta CPMK × IK' : label}
                  </button>
                ))}
              </div>

              {renderKontenMk(dosenTab, handleNavigateDosen)}
            </div>
          ) : null
        )}
        </>
        )}
      </div>
    )
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
            {/* Opsi semester statis mengacu pada SemesterEnum (app/models/enums.py). Tab tren memakai filter angkatan sendiri. */}
            {analisisMode === 'mk' && activeTab !== 'trending' && !scopeMkId && (
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
          {kurikulumAktif && (
            <div
              data-testid="info-kurikulum-analitik"
              className={`flex flex-wrap items-center gap-2 rounded-[6px] border px-3.5 py-2.5 text-xs ${
                kurikulumAktif.kurikulum && kurikulumAktif.ditetapkan
                  ? 'border-[#CBD5E1] bg-white text-[#142B4A]'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              {kurikulumAktif.kurikulum ? (
                <span>
                  Kurikulum yang dianalisis: <strong>{kurikulumAktif.kurikulum.version_label}</strong>
                  {kurikulumAktif.ditetapkan
                    ? ' (ditetapkan Admin Prodi)'
                    : ' (belum ditetapkan Admin Prodi, sementara memakai versi published terbaru)'}
                </span>
              ) : (
                <span>Belum ada kurikulum yang dipublikasikan untuk prodi ini.</span>
              )}
            </div>
          )}

          <ModeAnalisisSwitch value={analisisMode} onChange={setAnalisisMode} />

          {analisisMode === 'mahasiswa' ? (
            <AnalitikMahasiswa programStudiId={isDekan ? selectedProdiId : null} courses={courses} />
          ) : (
          <>
          {/* Pemilih cakupan: seluruh prodi atau satu mata kuliah */}
          <SectionCard
            title="Cakupan Analisis"
            description="Analisis seluruh program studi, atau pilih satu mata kuliah untuk melihat fitur yang sama dengan cakupan mata kuliah tersebut."
            action={
              scopeMkId ? (
                <ActionButton variant="secondary" onClick={() => setScopeMkId('')} data-testid="btn-cakupan-prodi">
                  Kembali ke seluruh prodi
                </ActionButton>
              ) : null
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              <SearchableSelect
                value={scopeMkId}
                onChange={(val) => setScopeMkId(String(val))}
                className="w-full max-w-xl"
                buttonClassName="h-10 text-xs font-semibold"
                data-testid="select-cakupan-analitik"
                aria-label="Cakupan analitik"
                searchPlaceholder="Cari kode atau nama mata kuliah..."
                options={[
                  { value: '', label: `Semua Mata Kuliah (${courses.length})` },
                  ...courses.map((c) => ({
                    value: c.id,
                    label: `${c.kode} - ${c.nama}`,
                    description: `${c.sks} SKS · Semester ${c.semester}`,
                    searchText: c.nama,
                  })),
                ]}
              />
              <Badge tone={scopeMkId ? 'warning' : 'default'}>
                {scopeMkId ? 'Cakupan: satu mata kuliah' : 'Cakupan: seluruh prodi'}
              </Badge>
            </div>
          </SectionCard>

          {/* Tab Switcher */}
          <div className="flex overflow-x-auto border-b border-[#CBD5E1]" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                data-testid={`tab-${id}`}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  activeTab === id
                    ? 'border-[#1A3A6B] text-[#1A3A6B]'
                    : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {scopeMkId && id === 'peta' ? 'Peta CPMK × IK' : label}
              </button>
            ))}
          </div>

          {/* Cakupan satu mata kuliah: komponen yang sama dengan tampilan Dosen */}
          {scopeMkId && renderKontenMk(activeTab, handleNavigateMk)}

          {/* Tab berbasis /analitik/prodi */}
          {!scopeMkId && ['ringkasan', 'perbandingan', 'simulator', 'peta'].includes(activeTab) && (
            loadingAnalitik ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-white" />)}
              </div>
            ) : errorAnalitik ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
                <span className="flex items-center gap-2"><AlertCircle className="h-5 w-5 shrink-0" />{errorAnalitik}</span>
                <ActionButton variant="secondary" onClick={fetchAnalitik}><RefreshCw className="h-4 w-4" />Coba lagi</ActionButton>
              </div>
            ) : model ? (
              <>
                {activeTab === 'ringkasan' && <RingkasanEvaluasi model={model} onNavigate={handleNavigate} />}
                {activeTab === 'perbandingan' && <PerbandinganAngkatan model={model} />}
                {activeTab === 'simulator' && <SimulatorThreshold model={model} />}
                {activeTab === 'peta' && <PetaKurikulum model={model} />}
              </>
            ) : null
          )}

      {/* ==================================================== */}
      {/* TAB 1: DRILL-DOWN 3-LEVEL                            */}
      {/* ==================================================== */}
      {!scopeMkId && activeTab === 'drilldown' && (
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
                Level 3 · CPMK Pendukung {selectedIk ? selectedIk.kode : ''}
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

          {/* Level 3: CPMK pendukung IK terpilih (lintas mata kuliah) */}
          {selectedIk && model && (
            <CpmkPendukungIk model={model} ikId={selectedIk.ik_id} kodeIk={selectedIk.kode} />
          )}

          {/* Rincian per mata kuliah */}
          <SectionCard
            title="Rincian CPMK per Mata Kuliah"
            description="Detail ketercapaian CPMK dan kontribusi indikator kinerja pada mata kuliah terpilih."
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
              <div className="flex items-center gap-3">
                <span className="label-filter">Pilih Mata Kuliah:</span>
                <SearchableSelect
                  value={selectedMkId}
                  onChange={(val) => setSelectedMkId(String(val))}
                  className="w-80"
                  buttonClassName="h-9 text-xs font-semibold"
                  data-testid="select-level3-mk"
                  aria-label="Pilih mata kuliah"
                  searchPlaceholder="Cari kode atau nama mata kuliah..."
                  options={courses.map((c) => ({
                    value: c.id,
                    label: `${c.kode} - ${c.nama}`,
                    description: `${c.sks} SKS · Semester ${c.semester}`,
                    searchText: c.nama,
                  }))}
                />
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
      {!scopeMkId && activeTab === 'trending' && (
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
        </>
      )}
    </div>
  )
}
