import { useState, useEffect, useMemo, useRef } from 'react'
import {
  BookOpen,
  ClipboardList,
  Layers,
  Sliders,
  Plus,
  Search,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Users,
  ChevronRight,
  Calculator,
  Award,
} from 'lucide-react'
import api from '../../services/api'
import useAuth from '../../hooks/useAuth'
import useToast from '../../hooks/useToast'
import useDosenCourses from '../../hooks/useDosenCourses'
import Modal from '../../components/Modal'
import { PageHeader, ActionButton } from '../../components/PageChrome'
import { getApiErrorMessage } from '../superAdminHelpers'

export default function PenilaianPage() {
  const { user } = useAuth()
  const { pushToast } = useToast()
  const { courses, loading: coursesLoading, reload: reloadCourses } = useDosenCourses()

  // Navigation Views: 'list' | 'components' | 'weights' | 'grades_preview' | 'results_preview'
  const [currentView, setCurrentView] = useState('list')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [selectedComponent, setSelectedComponent] = useState(null)

  // Filters for Course List
  const [searchQuery, setSearchQuery] = useState('')
  const [semesterFilter, setSemesterFilter] = useState('ALL')

  // --- DATA STATES FOR COMPONENTS ---
  const [componentsList, setComponentsList] = useState([])
  const [loadingComponents, setLoadingComponents] = useState(false)
  const [masterBentukList, setMasterBentukList] = useState([])
  const [masterJenisList, setMasterJenisList] = useState([])

  // Modal Tambah Komponen Penilaian
  const [isAddCompModalOpen, setIsAddCompModalOpen] = useState(false)
  const [formBentukId, setFormBentukId] = useState('')
  const [formBobot, setFormBobot] = useState('20')
  const [submittingComp, setSubmittingComp] = useState(false)

  // --- DATA STATES FOR SETTING BOBOT IK ---
  const [cpmkList, setCpmkList] = useState([])
  const [cpmkIkRows, setCpmkIkRows] = useState([])
  const [loadingIkRows, setLoadingIkRows] = useState(false)
  const [ikWeightsInput, setIkWeightsInput] = useState({}) // ik_id -> number/string
  const [submittingWeights, setSubmittingWeights] = useState(false)

  // 1. Load Master Bentuk Penilaian & Master Jenis Evaluasi
  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [resJenis, resBentuk] = await Promise.all([
          api.get('/jenis-evaluasi'),
          api.get('/bentuk-penilaian'),
        ])
        setMasterJenisList(Array.isArray(resJenis.data) ? resJenis.data : [])
        setMasterBentukList(Array.isArray(resBentuk.data) ? resBentuk.data : [])
      } catch (err) {
        pushToast(getApiErrorMessage(err, 'Gagal memuat master instrumen penilaian'), 'error')
      }
    }
    loadMasters()
  }, [])

  const jenisMap = useMemo(() => {
    const map = new Map()
    masterJenisList.forEach((j) => map.set(j.id, j))
    return map
  }, [masterJenisList])

  const bentukMap = useMemo(() => {
    const map = new Map()
    masterBentukList.forEach((b) => map.set(b.id, b))
    return map
  }, [masterBentukList])

  // 2. Filtered Courses
  const filteredCourses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return courses.filter((c) => {
      const matchSemester = semesterFilter === 'ALL' || c.semester === semesterFilter
      const matchQuery =
        !q ||
        (c.kode || '').toLowerCase().includes(q) ||
        (c.nama || '').toLowerCase().includes(q)
      return matchSemester && matchQuery
    })
  }, [courses, semesterFilter, searchQuery])

  // 3. Load Components for Selected Course
  const fetchCourseComponents = async (courseId) => {
    if (!courseId) return
    setLoadingComponents(true)
    try {
      const res = await api.get('/mk-bentuk-penilaian', {
        params: { mata_kuliah_id: courseId },
      })
      setComponentsList(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal memuat komponen penilaian mata kuliah'), 'error')
      setComponentsList([])
    } finally {
      setLoadingComponents(false)
    }
  }

  // Handle Open Components View
  const handleSelectCourseComponents = async (course) => {
    setSelectedCourse(course)
    setCurrentView('components')
    await fetchCourseComponents(course.id)
  }

  // Pre-save duplicate check for Komponen Penilaian (tidak boleh memilih bentuk penilaian yang sudah ada di MK ini)
  const duplicateComponentError = useMemo(() => {
    if (!formBentukId) return null
    const existing = componentsList.find(
      (c) => Number(c.bentuk_penilaian_id) === Number(formBentukId)
    )
    if (existing) {
      const bNama = bentukMap.get(Number(formBentukId))?.nama || `ID #${formBentukId}`
      return `Bentuk penilaian "${bNama}" sudah ditambahkan pada mata kuliah ini.`
    }
    return null
  }, [formBentukId, componentsList, bentukMap])

  // Total Bobot Komponen Saat Ini
  const totalBobotKomponen = useMemo(() => {
    return componentsList.reduce((acc, c) => acc + Number(c.bobot || 0), 0)
  }, [componentsList])

  // Handle Add Component Submit
  const handleAddComponentSubmit = async (e) => {
    e.preventDefault()
    if (!selectedCourse || duplicateComponentError) return
    if (!formBentukId) {
      pushToast('Pilih bentuk penilaian terlebih dahulu', 'warning')
      return
    }
    const bobotNum = Number(formBobot)
    if (Number.isNaN(bobotNum) || bobotNum <= 0 || bobotNum > 100) {
      pushToast('Bobot harus berupa angka antara 1 sampai 100%', 'warning')
      return
    }

    setSubmittingComp(true)
    try {
      await api.post('/mk-bentuk-penilaian', {
        mata_kuliah_id: selectedCourse.id,
        bentuk_penilaian_id: Number(formBentukId),
        bobot: bobotNum,
        semester: selectedCourse.semester || 'Ganjil',
      })
      pushToast('Komponen bentuk penilaian berhasil ditambahkan', 'success')
      setIsAddCompModalOpen(false)
      setFormBentukId('')
      setFormBobot('20')
      await fetchCourseComponents(selectedCourse.id)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menambahkan komponen bentuk penilaian'), 'error')
    } finally {
      setSubmittingComp(false)
    }
  }

  // 4. Setting Bobot IK Workflow (Nomor 3)
  const handleOpenSettingBobot = async (component) => {
    setSelectedComponent(component)
    setCurrentView('weights')
    setLoadingIkRows(true)
    setIkWeightsInput({})

    try {
      // Ambil CPMK milik MK ini
      const cpmkRes = await api.get('/cpmk', {
        params: { mata_kuliah_id: selectedCourse.id },
      })
      const cList = Array.isArray(cpmkRes.data) ? cpmkRes.data : []
      setCpmkList(cList)

      // Ambil pemetaan IK untuk setiap CPMK
      const allRows = []
      for (const cpmk of cList) {
        try {
          const mapRes = await api.get(`/cpmk/${cpmk.id}/map-ik`)
          const maps = Array.isArray(mapRes.data) ? mapRes.data : []
          for (const m of maps) {
            allRows.push({
              cpmkId: cpmk.id,
              cpmkKode: cpmk.kode,
              cpmkDeskripsi: cpmk.deskripsi,
              ikId: m.ik_id,
              ikKode: m.ik_kode || `IK #${m.ik_id}`,
              ikDeskripsi: m.ik_deskripsi || '',
              bobotInCpmk: Number(m.bobot || 0),
            })
          }
        } catch {
          // Lewati jika CPMK belum memiliki mapping IK
        }
      }

      setCpmkIkRows(allRows)

      // Inisialisasi input bobot: 0 untuk setiap IK
      const initialWeights = {}
      allRows.forEach((row) => {
        initialWeights[row.ikId] = 0
      })
      setIkWeightsInput(initialWeights)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal memuat relasi CPMK dan IK'), 'error')
      setCpmkIkRows([])
    } finally {
      setLoadingIkRows(false)
    }
  }

  // Hitung total input bobot IK yang dialokasikan pada komponen ini
  const totalAllocatedIkWeight = useMemo(() => {
    let sum = 0
    Object.values(ikWeightsInput).forEach((val) => {
      const num = Number(val)
      if (!Number.isNaN(num) && num > 0) {
        sum += num
      }
    })
    return sum
  }, [ikWeightsInput])

  const compWeight = Number(selectedComponent?.bobot || 0)
  const remainingCompQuota = compWeight - totalAllocatedIkWeight
  const isOverAllocated = totalAllocatedIkWeight > compWeight

  const handleIkWeightChange = (ikId, val) => {
    setIkWeightsInput((prev) => ({
      ...prev,
      [ikId]: val,
    }))
  }

  // Submit Setting Bobot IK via PUT /mk-bentuk-penilaian/{id}/map-ik
  const handleSaveIkWeights = async (e) => {
    e.preventDefault()
    if (!selectedComponent) return

    if (isOverAllocated) {
      pushToast(
        `Total alokasi bobot IK (${totalAllocatedIkWeight}%) melebihi bobot komponen (${compWeight}%)`,
        'error'
      )
      return
    }

    setSubmittingWeights(true)
    try {
      // Susun mapping: hanya kirimkan item IK yang bobotnya > 0
      const mappings = []
      const seenIk = new Set()

      for (const row of cpmkIkRows) {
        if (!seenIk.has(row.ikId)) {
          seenIk.add(row.ikId)
          const val = Number(ikWeightsInput[row.ikId] || 0)
          if (val > 0) {
            mappings.push({
              ik_id: row.ikId,
              bobot: val,
            })
          }
        }
      }

      await api.put(`/mk-bentuk-penilaian/${selectedComponent.id}/map-ik`, {
        mappings,
      })

      pushToast('Setting alokasi bobot IK berhasil disimpan ke server', 'success')
      setCurrentView('components')
      await fetchCourseComponents(selectedCourse.id)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan mapping alokasi bobot IK'), 'error')
    } finally {
      setSubmittingWeights(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* =========================================================================
          VIEW 1: DAFTAR MATA KULIAH YANG DIAMPU
      ========================================================================= */}
      {currentView === 'list' && (
        <>
          <PageHeader
            eyebrow="MODUL PENILAIAN DOSEN"
            title="Penilaian Perkuliahan"
            description="Daftar mata kuliah yang Anda ampu pada semester aktif. Atur instrumen penilaian, petakan bobot capaian CPMK/IK, dan lakukan kalkulasi evaluasi."
            badge="Dosen Pengampu"
          />

          {/* Filter & Search Bar */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#E2E8F0] p-4 bg-white">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
                  <input
                    type="text"
                    placeholder="Cari kode atau nama mata kuliah..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-[#CBD5E1] bg-white pl-8 pr-3 py-1.5 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
                  />
                </div>

                {/* Filter Semester */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#142B4A]">Semester:</span>
                  <select
                    value={semesterFilter}
                    onChange={(e) => setSemesterFilter(e.target.value)}
                    className="rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                  >
                    <option value="ALL">Semua Semester</option>
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
              </div>

              <div className="text-xs text-[#64748B]">
                Total: <span className="font-semibold text-[#142B4A]">{filteredCourses.length}</span> mata kuliah
              </div>
            </div>

            {/* Courses Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-14 text-center">No</th>
                    <th className="py-3 px-4 w-28">Kode</th>
                    <th className="py-3 px-4">Nama Mata Kuliah</th>
                    <th className="py-3 px-4 w-36">Semester / TA</th>
                    <th className="py-3 px-4 w-24 text-center">Peserta</th>
                    <th className="py-3 px-4 w-28 text-center">Peran Anda</th>
                    <th className="py-3 px-4 w-80 text-right">Aksi Penilaian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {coursesLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#64748B]">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                          <span>Memuat mata kuliah yang Anda ampu...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCourses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#64748B]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <BookOpen className="h-8 w-8 text-[#CBD5E1]" />
                          <p className="font-medium text-[#142B4A]">
                            {searchQuery
                              ? 'Tidak ada mata kuliah yang cocok dengan kata kunci pencarian'
                              : 'Anda belum terdaftar sebagai pengampu pada mata kuliah manapun'}
                          </p>
                          <p className="text-[11px] text-[#64748B]">
                            {searchQuery
                              ? 'Coba gunakan kata kunci pencarian lain'
                              : 'Silakan hubungi Admin Program Studi untuk penugasan dosen pengampu'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCourses.map((mk, idx) => (
                      <tr key={mk.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                        <td className="py-3 px-4 text-center font-medium text-[#64748B]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#1A3A6B]">
                          {mk.kode}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#142B4A]">{mk.nama}</div>
                          <div className="text-[11px] text-[#64748B]">{mk.sks} SKS</div>
                        </td>
                        <td className="py-3 px-4 text-[#64748B]">
                          <span className="font-medium text-[#142B4A]">{mk.semester}</span>
                          <span className="block text-[11px]">{mk.tahun_ajaran || '2024/2025'}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#142B4A] bg-[#F1F5F9] px-2.5 py-0.5 rounded-full border border-[#E2E8F0]">
                            <Users className="h-3 w-3 text-[#64748B]" />
                            <span>{mk.jumlahPeserta ?? 0}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {mk.isKetua ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                              Ketua
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              Anggota
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSelectCourseComponents(mk)}
                              data-testid={`btn-bentuk-penilaian-${mk.id}`}
                              className="inline-flex items-center gap-1 rounded border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                            >
                              <Layers className="h-3.5 w-3.5 text-[#1A3A6B]" />
                              <span>Bentuk Penilaian</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCourse(mk)
                                setCurrentView('grades_preview')
                              }}
                              data-testid={`btn-input-nilai-${mk.id}`}
                              className="inline-flex items-center gap-1 rounded border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                            >
                              <Calculator className="h-3.5 w-3.5 text-blue-600" />
                              <span>Input Nilai</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCourse(mk)
                                setCurrentView('results_preview')
                              }}
                              data-testid={`btn-hasil-${mk.id}`}
                              className="inline-flex items-center gap-1 rounded border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                            >
                              <Award className="h-3.5 w-3.5 text-amber-600" />
                              <span>Hasil</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          VIEW 2: BENTUK PENILAIAN PER MATA KULIAH (Nomor 2)
      ========================================================================= */}
      {currentView === 'components' && selectedCourse && (
        <div className="space-y-5">
          {/* Back Button & Header */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentView('list')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#1A3A6B] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Daftar Mata Kuliah</span>
            </button>
            <div className="flex items-center gap-2">
              <ActionButton
                onClick={() => setIsAddCompModalOpen(true)}
                data-testid="btn-tambah-komponen-mk"
                className="bg-[#1A3A6B] text-white hover:bg-[#142B4A]"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Bentuk Penilaian</span>
              </ActionButton>
            </div>
          </div>

          <PageHeader
            eyebrow={`MATA KULIAH ${selectedCourse.kode}`}
            title={`Bentuk Penilaian: ${selectedCourse.nama}`}
            description="Konfigurasikan instrumen penilaian (Tugas, Kuis, UTS, UAS) yang berlaku pada mata kuliah ini serta alokasi bobot persentasenya."
            badge={`${selectedCourse.sks} SKS · ${selectedCourse.semester} ${selectedCourse.tahun_ajaran || '2024/2025'}`}
          />

          {/* Bobot Summary Banner */}
          <div
            className={`rounded-lg border p-4 text-xs flex items-center justify-between gap-4 ${
              totalBobotKomponen === 100
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {totalBobotKomponen === 100 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              )}
              <div>
                <span className="font-bold text-sm block">
                  Total Bobot Komponen: {totalBobotKomponen}%
                </span>
                <span className="text-[11px] leading-relaxed">
                  {totalBobotKomponen === 100
                    ? 'Total bobot seluruh komponen penilaian telah memenuhi standar 100%.'
                    : `Total bobot komponen saat ini ${totalBobotKomponen}%. Idealnya total akumulasi adalah 100% agar perhitungan kalkulasi evaluasi akurat.`}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider block text-[#64748B]">
                Status Bobot
              </span>
              <span
                className={`font-mono font-bold text-base ${
                  totalBobotKomponen === 100 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {totalBobotKomponen}% / 100%
              </span>
            </div>
          </div>

          {/* Components Table */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#142B4A] uppercase tracking-wider">
                  Daftar Komponen Bentuk Penilaian MK
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Komponen asesmen yang akan dinilai oleh dosen pengampu beserta pemetaan ke Indikator Kinerja (IK).
                </p>
              </div>
              <span className="text-xs text-[#64748B]">
                {componentsList.length} Komponen
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-14 text-center">No</th>
                    <th className="py-3 px-4 w-44">Jenis Evaluasi</th>
                    <th className="py-3 px-4">Nama Bentuk Penilaian</th>
                    <th className="py-3 px-4 w-32 text-center">Bobot Penilaian</th>
                    <th className="py-3 px-4 w-40 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {loadingComponents ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[#64748B]">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                          <span>Memuat komponen bentuk penilaian...</span>
                        </div>
                      </td>
                    </tr>
                  ) : componentsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#64748B]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Layers className="h-8 w-8 text-[#CBD5E1]" />
                          <p className="font-medium text-[#142B4A]">
                            Belum ada bentuk penilaian yang dikonfigurasi untuk mata kuliah ini
                          </p>
                          <p className="text-[11px] text-[#64748B]">
                            Klik tombol "Tambah Bentuk Penilaian" di atas untuk menambahkan instrumen asesmen.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    componentsList.map((comp, idx) => {
                      const bentukData = bentukMap.get(Number(comp.bentuk_penilaian_id))
                      const parentJenis = bentukData
                        ? jenisMap.get(Number(bentukData.jenis_evaluasi_id))
                        : null

                      return (
                        <tr key={comp.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                          <td className="py-3 px-4 text-center font-medium text-[#64748B]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CBD5E1] bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#142B4A]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#1A3A6B]" />
                              <span>{parentJenis?.nama || 'Evaluasi'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#142B4A]">
                            {bentukData?.nama || `Bentuk Penilaian #${comp.bentuk_penilaian_id}`}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-bold text-sm text-[#1A3A6B] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                              {comp.bobot}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenSettingBobot(comp)}
                              data-testid={`btn-setting-bobot-${comp.id}`}
                              className="inline-flex items-center gap-1.5 rounded bg-[#1A3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] transition-colors"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                              <span>Setting Bobot IK</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: SETTING BOBOT PER KOMPONEN (Nomor 3)
      ========================================================================= */}
      {currentView === 'weights' && selectedCourse && selectedComponent && (
        <div className="space-y-5">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => setCurrentView('components')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#1A3A6B] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Bentuk Penilaian</span>
          </button>

          {/* Header Komponen */}
          <PageHeader
            eyebrow={`SETTING ALOKASI BOBOT · ${selectedCourse.kode}`}
            title={`Setting Bobot IK: ${bentukMap.get(Number(selectedComponent.bentuk_penilaian_id))?.nama || 'Komponen Penilaian'}`}
            description="Alokasikan bobot penilaian komponen ini ke masing-masing Indikator Kinerja (IK) yang dipetakan pada CPMK mata kuliah."
            badge={`Bobot Komponen: ${selectedComponent.bobot}%`}
          />

          {/* Kuota Bobot Indicator Card */}
          <div
            className={`rounded-lg border p-4 text-xs ${
              isOverAllocated
                ? 'border-red-300 bg-red-50 text-red-900'
                : remainingCompQuota === 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-[#CBD5E1] bg-white text-[#142B4A]'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">
                    Kuota Bobot Komponen: {compWeight}%
                  </span>
                  {isOverAllocated && (
                    <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Melebihi Kuota!
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Total input bobot IK pada komponen ini tidak boleh melebihi bobot komponen ({compWeight}%). IK yang tidak diuji pada komponen ini diisi 0.
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
                <div className="text-right">
                  <span className="block text-[10px] text-[#64748B] uppercase">Total Terpakai</span>
                  <span className={`font-bold text-sm ${isOverAllocated ? 'text-red-600' : 'text-[#1A3A6B]'}`}>
                    {totalAllocatedIkWeight}%
                  </span>
                </div>
                <div className="h-8 w-px bg-[#CBD5E1]" />
                <div className="text-right">
                  <span className="block text-[10px] text-[#64748B] uppercase">Sisa Kuota</span>
                  <span
                    className={`font-bold text-sm ${
                      remainingCompQuota < 0
                        ? 'text-red-600'
                        : remainingCompQuota === 0
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                    }`}
                  >
                    {remainingCompQuota}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Setting Bobot IK */}
          <form onSubmit={handleSaveIkWeights} className="space-y-4">
            <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <h3 className="text-xs font-bold text-[#142B4A] uppercase tracking-wider">
                  Matriks Pemetaan CPMK dan IK
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Tentukan persentase kontribusi komponen penilaian ini terhadap pencapaian masing-masing IK.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4 w-36">CPMK</th>
                      <th className="py-3 px-4 w-40">Indikator Kinerja (IK)</th>
                      <th className="py-3 px-4">Deskripsi IK</th>
                      <th className="py-3 px-4 w-32 text-center">Bobot IK di CPMK</th>
                      <th className="py-3 px-4 w-40 text-center">Bobot Komponen Ini (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {loadingIkRows ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-[#64748B]">
                          <div className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                            <span>Memuat matriks CPMK dan IK...</span>
                          </div>
                        </td>
                      </tr>
                    ) : cpmkIkRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[#64748B]">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <HelpCircle className="h-8 w-8 text-[#CBD5E1]" />
                            <p className="font-medium text-[#142B4A]">
                              Mata kuliah ini belum memiliki pemetaan CPMK ke IK
                            </p>
                            <p className="text-[11px] text-[#64748B]">
                              Pastikan Admin Prodi telah mengonfigurasikan CPMK dan pemetaan IK untuk mata kuliah ini.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      cpmkIkRows.map((row, idx) => (
                        <tr key={`${row.cpmkId}_${row.ikId}_${idx}`} className="hover:bg-[#F8FAFC]/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#1A3A6B]">
                            {row.cpmkKode}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-[#142B4A]">
                            {row.ikKode}
                          </td>
                          <td className="py-3 px-4 text-[#64748B]">
                            {row.ikDeskripsi || '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-[#64748B]">
                            {row.bobotInCpmk}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <input
                                type="number"
                                min="0"
                                max={compWeight}
                                step="any"
                                value={ikWeightsInput[row.ikId] ?? 0}
                                onChange={(e) => handleIkWeightChange(row.ikId, e.target.value)}
                                data-testid={`input-ik-weight-${row.ikId}`}
                                className={`w-20 rounded border px-2 py-1 text-center text-xs font-mono font-semibold focus:outline-none ${
                                  isOverAllocated
                                    ? 'border-red-400 focus:border-red-500'
                                    : 'border-[#CBD5E1] focus:border-[#1A3A6B]'
                                }`}
                              />
                              <span className="text-xs text-[#64748B]">%</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentView('components')}
                disabled={submittingWeights}
                className="rounded-md border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingWeights || isOverAllocated || cpmkIkRows.length === 0}
                data-testid="btn-submit-ik-weights"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-5 py-2 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
              >
                {submittingWeights && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Simpan Alokasi Bobot IK</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          VIEW 4 & 5: PREVIEWS FOR INPUT NILAI & HASIL (Persiapan Tahap D2)
      ========================================================================= */}
      {(currentView === 'grades_preview' || currentView === 'results_preview') && selectedCourse && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setCurrentView('list')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#1A3A6B] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Daftar Mata Kuliah</span>
          </button>

          <PageHeader
            eyebrow={`MATA KULIAH ${selectedCourse.kode}`}
            title={currentView === 'grades_preview' ? 'Input Nilai Mahasiswa' : 'Hasil Evaluasi & Capaian'}
            description={
              currentView === 'grades_preview'
                ? `Pengisian nilai per komponen untuk mahasiswa peserta mata kuliah ${selectedCourse.nama}.`
                : `Ringkasan perolehan nilai akhir, huruf, dan capaian IK pada mata kuliah ${selectedCourse.nama}.`
            }
            badge="Tahap D2"
          />

          <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              {currentView === 'grades_preview' ? (
                <Calculator className="h-6 w-6 text-[#1A3A6B]" />
              ) : (
                <Award className="h-6 w-6 text-amber-600" />
              )}
            </div>
            <h3 className="mt-3 text-sm font-bold text-[#142B4A]">
              {currentView === 'grades_preview'
                ? 'Fitur Input Nilai Mahasiswa (Tahap D2)'
                : 'Fitur Hasil Evaluasi & Capaian (Tahap D2)'}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-xs text-[#64748B] leading-relaxed">
              Tahap D1 difokuskan pada konfigurasi Bentuk Penilaian dan Setting Alokasi Bobot IK. Formulir input nilai dan kalkulasi hasil akan diaktifkan penuh pada Tahap D2 setelah konfirmasi.
            </p>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => handleSelectCourseComponents(selectedCourse)}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142B4A]"
              >
                <span>Kelola Bentuk Penilaian MK Ini</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL TAMBAH KOMPONEN BENTUK PENILAIAN
      ========================================================================= */}
      <Modal
        open={isAddCompModalOpen}
        title={`Tambah Bentuk Penilaian (${selectedCourse?.kode})`}
        onClose={submittingComp ? () => {} : () => setIsAddCompModalOpen(false)}
        size="max-w-md"
      >
        <form onSubmit={handleAddComponentSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Pilih Bentuk Penilaian Prodi <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formBentukId}
              onChange={(e) => setFormBentukId(e.target.value)}
              data-testid="select-bentuk-penilaian"
              className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            >
              <option value="" disabled>Pilih Instrumen Penilaian</option>
              {masterBentukList.map((b) => {
                const parentJenis = jenisMap.get(Number(b.jenis_evaluasi_id))
                return (
                  <option key={b.id} value={b.id}>
                    {b.nama} {parentJenis ? `(${parentJenis.nama})` : ''}
                  </option>
                )
              })}
            </select>
            {duplicateComponentError && (
              <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1" data-testid="error-duplicate-comp">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{duplicateComponentError}</span>
              </p>
            )}
            <p className="mt-1 text-[11px] text-[#64748B]">
              Instrumen penilaian resmi yang telah ditetapkan oleh Program Studi.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Alokasi Bobot Komponen (%) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                required
                min="1"
                max="100"
                value={formBobot}
                onChange={(e) => setFormBobot(e.target.value)}
                placeholder="Contoh: 20"
                data-testid="input-bobot-komponen"
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748B]">%</span>
            </div>
            <p className="mt-1 text-[11px] text-[#64748B]">
              Persentase bobot komponen terhadap nilai akhir mata kuliah (misal Tugas: 20%).
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={() => setIsAddCompModalOpen(false)}
              disabled={submittingComp}
              className="rounded-md border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submittingComp || Boolean(duplicateComponentError) || !formBentukId}
              data-testid="btn-submit-add-comp"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {submittingComp && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Tambahkan ke MK</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
