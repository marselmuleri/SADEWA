import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  FileText,
  Layers3,
  Users,
  Download,
  Printer,
  BookOpen,
  Award,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Sliders,
  Calculator,
  RefreshCw,
  AlertCircle,
  Building2,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import useAuth from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import useDosenCourses from '../hooks/useDosenCourses'
import api from '../services/api'
import { getApiErrorMessage } from './superAdminHelpers'
import { exportToCsv } from '../utils/csvExport'
import { useDekanScope } from '../context/DekanScopeContext'
import ProdiSelector from '../components/ProdiSelector'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, activeRole } = useAuth()
  const { role } = useRole()
  const currentRole = activeRole || role || user?.role || 'admin_prodi'
  const isDosen = currentRole === 'dosen'
  const isDekan = currentRole === 'dekan'
  const { selectedProdiId, selectedProdi } = useDekanScope()

  // Dosen specific states
  const { courses, loading: coursesLoading } = useDosenCourses()
  const [selectedMkId, setSelectedMkId] = useState('')
  const [mkDashboard, setMkDashboard] = useState(null)
  const [kalkulasiHasil, setKalkulasiHasil] = useState([])
  const [loadingDashboard, setLoadingDashboard] = useState(false)

  // Kaprodi / Admin Prodi / Dekan states
  const [cplOverview, setCplOverview] = useState([])
  const [activeCourses, setActiveCourses] = useState([])
  const [pendingReportsCount, setPendingReportsCount] = useState(0)
  const [kurikulumVersions, setKurikulumVersions] = useState([])
  const [trendingData, setTrendingData] = useState([])
  // Nilai semester mengacu pada SemesterEnum (app/models/enums.py): "Ganjil" | "Genap"
  const [selectedSemester, setSelectedSemester] = useState('')
  const [loadingAcademic, setLoadingAcademic] = useState(false)
  const [academicError, setAcademicError] = useState(null)

  // Default selected course for Dosen
  useEffect(() => {
    if (isDosen && courses.length > 0 && !selectedMkId) {
      setSelectedMkId(courses[0].id)
    }
  }, [isDosen, courses, selectedMkId])

  // Fetch course specific dashboard for Dosen
  useEffect(() => {
    if (!isDosen || !selectedMkId) return
    setLoadingDashboard(true)

    Promise.all([
      api.get(`/dashboard/${selectedMkId}`).catch(() => null),
      api.get(`/kalkulasi/${selectedMkId}`).catch(() => null),
    ])
      .then(([dashRes, kalkRes]) => {
        if (dashRes?.data) {
          setMkDashboard(dashRes.data)
        } else {
          setMkDashboard(null)
        }
        if (Array.isArray(kalkRes?.data)) {
          setKalkulasiHasil(kalkRes.data)
        }
      })
      .finally(() => setLoadingDashboard(false))
  }, [isDosen, selectedMkId])

  // Fetch Academic Dashboard for Kaprodi / Admin Prodi / Dekan
  const fetchAcademicDashboard = async () => {
    if (isDekan && !selectedProdiId) {
      setCplOverview([])
      setTrendingData([])
      setActiveCourses([])
      setLoadingAcademic(false)
      setAcademicError(null)
      return
    }

    setLoadingAcademic(true)
    setAcademicError(null)

    try {
      const cplParams = {}
      if (selectedSemester) cplParams.semester = selectedSemester
      if (isDekan && selectedProdiId) cplParams.program_studi_id = Number(selectedProdiId)

      const trendingParams = {}
      if (isDekan && selectedProdiId) trendingParams.program_studi_id = Number(selectedProdiId)

      const [cplRes, coursesRes, validasiRes, kurikulumRes, trendingRes] = await Promise.all([
        api.get('/dashboard/cpl-overview', { params: cplParams }),
        api.get('/mata-kuliah'),
        api.get('/validasi/laporan').catch(() => ({ data: [] })),
        api.get('/kurikulum/versions').catch(() => ({ data: [] })),
        api.get('/trending/cpl-by-angkatan', { params: trendingParams }).catch(() => ({ data: [] })),
      ])

      setCplOverview(Array.isArray(cplRes.data) ? cplRes.data : [])
      
      const allFetchedCourses = Array.isArray(coursesRes.data) ? coursesRes.data : []
      if (isDekan && selectedProdiId) {
        setActiveCourses(allFetchedCourses.filter((c) => String(c.program_studi_id) === String(selectedProdiId)))
      } else {
        setActiveCourses(allFetchedCourses)
      }

      const reports = Array.isArray(validasiRes.data) ? validasiRes.data : []
      const pendingCount = reports.filter((r) => r.status === 'submitted').length
      setPendingReportsCount(pendingCount)

      setKurikulumVersions(Array.isArray(kurikulumRes.data) ? kurikulumRes.data : [])
      setTrendingData(Array.isArray(trendingRes.data) ? trendingRes.data : [])
    } catch (err) {
      console.error('Gagal memuat dashboard akademik:', err)
      const msg = getApiErrorMessage(
        err,
        'Gagal memuat data dashboard akademik. Pastikan Anda memiliki akses atau data kalkulasi tersedia.'
      )
      setAcademicError(msg)
      setCplOverview([])
    } finally {
      setLoadingAcademic(false)
    }
  }

  useEffect(() => {
    if (!isDosen) {
      fetchAcademicDashboard()
    }
  }, [isDosen, selectedSemester, isDekan, selectedProdiId])

  // Map trending delta per CPL
  const cplTrendMap = useMemo(() => {
    const map = {}
    if (!Array.isArray(trendingData) || trendingData.length === 0) return map

    const grouped = {}
    trendingData.forEach((item) => {
      if (!grouped[item.cpl_id]) grouped[item.cpl_id] = []
      grouped[item.cpl_id].push(item)
    })

    Object.keys(grouped).forEach((cplId) => {
      const items = grouped[cplId].sort((a, b) => a.angkatan - b.angkatan)
      if (items.length >= 2) {
        const oldest = Number(items[0].rata_rata)
        const latest = Number(items[items.length - 1].rata_rata)
        const diff = Math.round((latest - oldest) * 10) / 10
        map[cplId] = {
          diff,
          oldestYear: items[0].angkatan,
          latestYear: items[items.length - 1].angkatan,
        }
      }
    })
    return map
  }, [trendingData])

  // Active curriculum version label
  const activeVersion = useMemo(() => {
    return kurikulumVersions.find((v) => v.status === 'published') || kurikulumVersions[0] || null
  }, [kurikulumVersions])

  // ==========================================
  // VIEW KHUSUS DOSEN
  // ==========================================
  if (isDosen) {
    const cpmkItems = mkDashboard?.cpmk_breakdown || []
    const ikItems = mkDashboard?.ik_breakdown || []
    const selectedCourseObj = courses.find((c) => String(c.id) === String(selectedMkId)) || null

    return (
      <div className="space-y-8 animate-[fadeUp_200ms_ease]">
        <PageHeader
          eyebrow="Dashboard Evaluasi Dosen"
          title={`Evaluasi Pembelajaran: ${selectedCourseObj ? selectedCourseObj.nama : 'Pilih Mata Kuliah'}`}
          description="Pantau ketercapaian CPMK dan Indikator Kinerja (IK) untuk kelas mata kuliah yang Anda ampu secara objektif berbasis OBE."
          badge="Mode Dosen Pengampu"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton variant="secondary" onClick={() => window.print()} data-testid="dashboard-print">
                <Printer className="h-4 w-4" />
                Print
              </ActionButton>
            </div>
          }
        />

        <SectionCard title="Pilih Mata Kuliah Diampu">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-full sm:w-80">
              <select
                value={selectedMkId}
                onChange={(e) => setSelectedMkId(e.target.value)}
                disabled={coursesLoading || courses.length === 0}
                className="h-10 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                data-testid="select-dosen-course"
              >
                {coursesLoading ? (
                  <option value="">Memuat daftar mata kuliah...</option>
                ) : courses.length === 0 ? (
                  <option value="">Belum ada penugasan mata kuliah</option>
                ) : (
                  courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.kode} - {c.nama} ({c.sks} SKS, Smt {c.semester})
                    </option>
                  ))
                )}
              </select>
            </div>
            {selectedCourseObj && (
              <Badge tone="default">
                Tahun Ajaran: {selectedCourseObj.tahun_ajaran || '2025/2026'} · Semester {selectedCourseObj.semester}
              </Badge>
            )}
          </div>
        </SectionCard>

        {/* Metrik Dosen */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Peserta Kuliah"
            value={mkDashboard?.jumlah_peserta ?? 0}
            caption="Mahasiswa terdaftar"
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Rata-Rata Nilai Akhir"
            value={mkDashboard?.rata_rata_nilai_akhir ? Number(mkDashboard.rata_rata_nilai_akhir).toFixed(1) : '-'}
            caption="Skala 0 - 100"
            icon={<Award className="h-4 w-4" />}
          />
          <StatCard
            label="CPMK Terpetakan"
            value={cpmkItems.length}
            caption="Capaian Mata Kuliah"
            icon={<Layers3 className="h-4 w-4" />}
          />
          <StatCard
            label="Kontribusi IK"
            value={ikItems.length}
            caption="Indikator Kinerja Prodi"
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>

        {/* Breakdown CPMK & IK */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Ketercapaian CPMK"
            description="Capaian Pembelajaran Mata Kuliah berdasarkan kalkulasi nilai mahasiswa."
          >
            {loadingDashboard ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-[#F8FAFC]" />
                ))}
              </div>
            ) : cpmkItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B]">
                Belum ada data CPMK atau kalkulasi nilai untuk mata kuliah ini.
              </div>
            ) : (
              <div className="space-y-4">
                {cpmkItems.map((cpmk) => {
                  const avg = Number(cpmk.rata_rata || 0)
                  const isAchieved = avg >= 70
                  return (
                    <div
                      key={cpmk.cpmk_id}
                      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 transition-colors hover:bg-white"
                      data-testid={`cpmk-item-${cpmk.kode.toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#142B4A]">{cpmk.kode}</span>
                        <Badge tone={isAchieved ? 'success' : 'warning'}>
                          {avg.toFixed(1)}% · {isAchieved ? 'Tercapai' : 'Di Bawah Target'}
                        </Badge>
                      </div>
                      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isAchieved ? 'bg-[#10B981]' : 'bg-[#F4A300]'
                          }`}
                          style={{ width: `${Math.min(avg, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Ketercapaian Indikator Kinerja (IK)"
            description="Indikator kinerja prodi yang didukung oleh mata kuliah ini."
          >
            {loadingDashboard ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-[#F8FAFC]" />
                ))}
              </div>
            ) : ikItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B]">
                Belum ada data IK yang terpetakan ke mata kuliah ini.
              </div>
            ) : (
              <div className="space-y-4">
                {ikItems.map((ik) => {
                  const avg = Number(ik.rata_rata || 0)
                  const isAchieved = avg >= 70
                  return (
                    <div
                      key={ik.ik_id}
                      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 transition-colors hover:bg-white"
                      data-testid={`ik-item-${ik.kode.toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#142B4A]">{ik.kode}</span>
                        <Badge tone={isAchieved ? 'success' : 'warning'}>
                          {avg.toFixed(1)}% · {isAchieved ? 'Tercapai' : 'Di Bawah Target'}
                        </Badge>
                      </div>
                      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isAchieved ? 'bg-[#10B981]' : 'bg-[#F4A300]'
                          }`}
                          style={{ width: `${Math.min(avg, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW KAPRODI / ADMIN PRODI / DEKAN (DATA RIIL)
  // ==========================================
  const prodiNama = isDekan
    ? selectedProdi
      ? selectedProdi.nama
      : 'Pilih Program Studi'
    : user?.program_studi_nama || 'Program Studi'
  const fakultasNama = user?.fakultas_nama || 'Fakultas Teknik'

  // Hitung metrik keseluruhan dari CPL Overview riil
  const totalCpl = cplOverview.length
  const overallAvg =
    totalCpl > 0
      ? (cplOverview.reduce((acc, curr) => acc + Number(curr.rata_rata || 0), 0) / totalCpl).toFixed(1)
      : '-'

  const targetInst =
    totalCpl > 0
      ? (cplOverview.reduce((acc, curr) => acc + Number(curr.threshold || 70), 0) / totalCpl).toFixed(0)
      : '70'

  const maxMahasiswa =
    totalCpl > 0 ? Math.max(...cplOverview.map((c) => Number(c.jumlah_mahasiswa || 0))) : 0

  const handleExportCsv = () => {
    if (cplOverview.length === 0) {
      alert('Tidak ada data ketercapaian CPL untuk diekspor')
      return
    }
    const headers = [
      { key: 'kode', label: 'Kode CPL' },
      { key: 'deskripsi', label: 'Deskripsi CPL' },
      { key: 'rata_rata', label: 'Rata-Rata Capaian' },
      { key: 'threshold', label: 'Target Threshold (%)' },
      { key: 'persen_tercapai', label: 'Mahasiswa Memenuhi (%)' },
      { key: 'jumlah_mahasiswa', label: 'Jumlah Mahasiswa' },
      { key: 'status_label', label: 'Status Ketercapaian' },
    ]
    const rows = cplOverview.map((item) => {
      const avg = Number(item.rata_rata || 0)
      const th = Number(item.threshold || 70)
      return {
        ...item,
        status_label: avg >= th ? 'Tercapai' : 'Perlu Perhatian',
      }
    })
    exportToCsv(`CPL_Overview_${prodiNama}_${selectedSemester || 'Semua'}`, headers, rows)
  }

  return (
    <div className="space-y-8 animate-[fadeUp_200ms_ease]">
      <PageHeader
        eyebrow={isDekan ? 'Dashboard Pengawasan Dekan' : 'Dashboard Operasional'}
        title={`Selamat pagi, ${user?.nama || (isDekan ? 'Dekan' : 'Ketua Program Studi')}`}
        description={
          isDekan
            ? `Pantau evaluasi Outcome-Based Education (OBE) lintas program studi di lingkungan ${fakultasNama}.`
            : `Pantau ketercapaian OBE dan aktivitas akademik ${prodiNama} dalam tampilan formal, terstruktur, dan data-dense.`
        }
        badge={isDekan ? 'Mode Lihat (Dekan)' : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Opsi semester statis mengacu pada SemesterEnum (app/models/enums.py) */}
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="h-9 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              data-testid="dashboard-semester-filter"
            >
              <option value="">Semua Semester</option>
              <option value="Ganjil">Semester Ganjil</option>
              <option value="Genap">Semester Genap</option>
            </select>
            <ActionButton variant="secondary" onClick={() => window.print()} data-testid="dashboard-print">
              <Printer className="h-4 w-4" />
              Print
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={handleExportCsv}
              disabled={cplOverview.length === 0}
              data-testid="dashboard-export-csv"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </ActionButton>
          </div>
        }
      />

      {isDekan && <ProdiSelector />}

      {isDekan && !selectedProdiId && (
        <div
          data-testid="dekan-empty-prodi-alert"
          className="rounded-[6px] border border-dashed border-[#94A3B8] bg-white p-12 text-center"
        >
          <Building2 className="mx-auto h-10 w-10 text-[#64748B]" />
          <h3 className="mt-3 text-sm font-bold text-[#142B4A]">Pilih Program Studi</h3>
          <p className="mt-1 text-xs text-[#64748B] max-w-md mx-auto">
            Silakan pilih salah satu program studi di atas untuk memantau metrik ketercapaian OBE, grafik CPL, dan aktivitas akademik.
          </p>
        </div>
      )}

      {academicError && (
        <div
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{academicError}</span>
          </div>
          <button
            type="button"
            onClick={fetchAcademicDashboard}
            className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-100"
          >
            <RefreshCw className="h-3 w-3" />
            Coba Lagi
          </button>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ketercapaian OBE"
          value={loadingAcademic ? '...' : overallAvg !== '-' ? `${overallAvg}%` : '-'}
          caption={`Target institusi ${targetInst}%`}
          icon={<Layers3 className="h-4 w-4" />}
        />
        <StatCard
          label="Mahasiswa Dievaluasi"
          value={loadingAcademic ? '...' : maxMahasiswa}
          caption={selectedSemester ? `Pada semester ${selectedSemester}` : 'Seluruh periode'}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Mata Kuliah Aktif"
          value={loadingAcademic ? '...' : activeCourses.length}
          caption="Dengan pemetaan CPMK"
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="Laporan Menunggu"
          value={loadingAcademic ? '...' : pendingReportsCount}
          caption="Perlu validasi Kaprodi"
          icon={<ArrowUpRight className="h-4 w-4" />}
          accent={pendingReportsCount > 0 ? 'text-[#F4A300]' : 'text-[#10B981]'}
        />
      </div>

      {/* Grid Grafik Bar & Context Card */}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <SectionCard
          title="Ringkasan Ketercapaian CPL"
          description={`Perbandingan capaian aktual dengan batas threshold minimal per CPL (${prodiNama}).`}
        >
          {loadingAcademic ? (
            <div className="flex h-[320px] items-center justify-center">
              <div className="text-xs text-[#64748B]">Memuat data ketercapaian CPL...</div>
            </div>
          ) : cplOverview.length === 0 ? (
            <div className="flex h-[320px] flex-col items-center justify-center text-center p-6 border border-dashed border-[#CBD5E1] rounded-lg">
              <Layers3 className="h-10 w-10 text-[#94A3B8] mb-2" />
              <p className="font-semibold text-sm text-[#142B4A]">Belum Ada Data Capaian CPL</p>
              <p className="text-xs text-[#64748B] max-w-sm mt-1">
                Data capaian CPL akan muncul secara otomatis setelah dosen menginput nilai dan menjalankan kalkulasi evaluasi pembelajaran.
              </p>
            </div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cplOverview.map((item) => ({
                    name: item.kode,
                    value: Number(item.rata_rata || 0),
                    target: Number(item.threshold || 70),
                  }))}
                  margin={{ left: -12, right: 8, top: 10, bottom: 0 }}
                >
                  <CartesianGrid stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(val, name) => [`${Number(val).toFixed(1)}%`, name === 'value' ? 'Capaian Aktual' : 'Target']}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {cplOverview.map((entry) => {
                      const avg = Number(entry.rata_rata || 0)
                      const th = Number(entry.threshold || 70)
                      return (
                        <Cell
                          key={entry.kode}
                          fill={avg >= th ? '#1A3A6B' : '#F4A300'}
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        {/* Konteks Program Studi Card */}
        <SectionCard
          title="Konteks Program Studi"
          description="Informasi program studi dan kurikulum aktif yang terikat pada akun Anda."
          className="bg-[#132D50] text-white"
        >
          <div className="flex flex-col justify-between h-full space-y-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C8D3E1]">
                {fakultasNama}
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{prodiNama}</div>
              <p className="mt-3 text-sm leading-6 text-[#D7E0EB]">
                Versi Kurikulum:{' '}
                <span className="font-semibold text-white">
                  {activeVersion ? activeVersion.version_label : 'Standar OBE'}
                </span>
                <br />
                Scope Otorisasi: <span className="font-medium text-[#F4A300]">Ketua Program Studi (Terkunci)</span>
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex flex-wrap gap-2">
              <ActionButton
                variant="secondary"
                onClick={() => navigate('/kurikulum')}
                data-testid="dashboard-context-kurikulum"
              >
                <BookOpen className="h-4 w-4" />
                Lihat Kurikulum OBE
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() => navigate('/dokumen')}
                data-testid="dashboard-context-validasi"
              >
                <ArrowUpRight className="h-4 w-4" />
                Validasi Laporan ({pendingReportsCount})
              </ActionButton>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Grid Kartu CPL Overview */}
      <SectionCard
        title="Daftar Capaian Pembelajaran Lulusan (CPL)"
        description="Klik salah satu kartu CPL untuk membuka Analitik OBE detail (drill-down IK dan CPMK)."
      >
        {loadingAcademic ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]" />
            ))}
          </div>
        ) : cplOverview.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#64748B]">
            Tidak ada data CPL yang memiliki capaian evaluasi pada filter ini.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cplOverview.map((item) => {
              const avg = Number(item.rata_rata || 0)
              const th = Number(item.threshold || 70)
              const isAchieved = avg >= th
              const trend = cplTrendMap[item.cpl_id]

              return (
                <button
                  key={item.cpl_id}
                  type="button"
                  data-testid={`cpl-card-${item.kode.toLowerCase()}`}
                  onClick={() => navigate(`/analisis?cpl_id=${item.cpl_id}`)}
                  className="rounded-lg border border-[#E2E8F0] bg-white p-5 text-left transition-transform hover:-translate-y-px hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D778E]">
                        {item.kode}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#142B4A] line-clamp-1" title={item.deskripsi}>
                        {item.deskripsi || item.kode}
                      </div>
                    </div>
                    <Badge tone={isAchieved ? 'success' : 'warning'}>
                      {isAchieved ? 'Tercapai' : 'Perlu Perhatian'}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-3xl font-semibold tracking-tight text-[#142B4A]">
                      {avg.toFixed(1)}%
                    </span>
                    <span className="text-xs text-[#64748B]">
                      Target: {th}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2.5 h-1.5 rounded-full bg-[#F2F4F7]">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        isAchieved ? 'bg-[#1A3A6B]' : 'bg-[#F4A300]'
                      }`}
                      style={{ width: `${Math.min(avg, 100)}%` }}
                    />
                  </div>

                  {/* Metadata & Tren Riil */}
                  <div className="mt-3 flex items-center justify-between text-xs text-[#64748B]">
                    <span>{item.jumlah_mahasiswa} mahasiswa</span>
                    {trend ? (
                      <span className={trend.diff >= 0 ? 'text-[#10B981] font-semibold' : 'text-[#EF4444] font-semibold'}>
                        {trend.diff >= 0 ? '↑' : '↓'} {trend.diff > 0 ? `+${trend.diff}%` : `${trend.diff}%`} ({trend.oldestYear}→{trend.latestYear})
                      </span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
