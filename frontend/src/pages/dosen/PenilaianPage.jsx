import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
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
  Trash2,
  Edit3,
  RefreshCw,
  Info,
  Check,
  X,
} from 'lucide-react'
import api from '../../services/api'
import useAuth from '../../hooks/useAuth'
import useToast from '../../hooks/useToast'
import useDosenCourses from '../../hooks/useDosenCourses'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { PageHeader, ActionButton } from '../../components/PageChrome'
import { TableActionHeader, TableActionCell, TableActionButton } from '../../components/TableActions'
import { getApiErrorMessage, getDeleteErrorMessage } from '../superAdminHelpers'

export default function PenilaianPage() {
  const { mkId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { pushToast } = useToast()
  const { courses, loading: coursesLoading, error: coursesError, reload: reloadCourses } = useDosenCourses()

  // Navigation Views: 'list' | 'components' | 'weights' | 'grades' | 'results'
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
  const [isConfirmAddCompOpen, setIsConfirmAddCompOpen] = useState(false)
  const [formBentukId, setFormBentukId] = useState('')
  const [formBobot, setFormBobot] = useState('20')
  const [submittingComp, setSubmittingComp] = useState(false)

  // --- DATA STATES FOR SETTING BOBOT IK ---
  const [cpmkList, setCpmkList] = useState([])
  const [cpmkIkRows, setCpmkIkRows] = useState([])
  const [loadingIkRows, setLoadingIkRows] = useState(false)
  const [ikWeightsInput, setIkWeightsInput] = useState({}) // ik_id -> number/string
  const [submittingWeights, setSubmittingWeights] = useState(false)

  // --- DATA STATES FOR INPUT NILAI (TAHAP D2) ---
  const [pesertaList, setPesertaList] = useState([])
  const [loadingPeserta, setLoadingPeserta] = useState(false)
  const [scoresList, setScoresList] = useState([])
  const [loadingScores, setLoadingScores] = useState(false)
  const [searchPeserta, setSearchPeserta] = useState('')
  const [validationWarnings, setValidationWarnings] = useState([])
  const [runningKalkulasi, setRunningKalkulasi] = useState(false)

  // Modal Input Nilai Mahasiswa
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false)
  const [activePeserta, setActivePeserta] = useState(null)
  const [gradeInputs, setGradeInputs] = useState({})
  const [submittingGrades, setSubmittingGrades] = useState(false)

  // ConfirmDialog Hapus Nilai
  const [isDeleteScoreModalOpen, setIsDeleteScoreModalOpen] = useState(false)
  const [deletingScoreId, setDeletingScoreId] = useState(null)
  const [deletingScoreCompName, setDeletingScoreCompName] = useState('')
  const [deletingScoreLoading, setDeletingScoreLoading] = useState(false)

  // --- DATA STATES FOR HASIL MK (TAHAP D2) ---
  const [courseDashboard, setCourseDashboard] = useState(null)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [errorDashboard, setErrorDashboard] = useState(null)

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

  // Fetch Peserta, Scores, and Validation Warnings (Tahap D2)
  const fetchPesertaAndScores = async (courseId) => {
    if (!courseId) return
    setLoadingPeserta(true)
    setLoadingScores(true)
    try {
      const [resPeserta, resScores, resValidasi] = await Promise.all([
        api.get('/peserta-mata-kuliah', { params: { mata_kuliah_id: courseId } }),
        api.get(`/nilai/${courseId}`).catch(() => ({ data: [] })),
        api.post('/kalkulasi/validasi-bobot', { mata_kuliah_id: courseId }).catch(() => ({ data: { warnings: [] } })),
      ])
      setPesertaList(Array.isArray(resPeserta.data) ? resPeserta.data : [])
      setScoresList(Array.isArray(resScores.data) ? resScores.data : [])
      setValidationWarnings(resValidasi.data?.warnings || [])
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal memuat data peserta dan nilai'), 'error')
    } finally {
      setLoadingPeserta(false)
      setLoadingScores(false)
    }
  }

  // Fetch Course Dashboard for Results View (Tahap D2)
  const fetchCourseDashboard = async (courseId) => {
    if (!courseId) return
    setLoadingDashboard(true)
    setErrorDashboard(null)
    try {
      const resDash = await api.get(`/dashboard/${courseId}`)
      setCourseDashboard(resDash.data)
    } catch (err) {
      console.warn('Gagal memuat hasil evaluasi mata kuliah:', err)
      setErrorDashboard(getApiErrorMessage(err, 'Gagal memuat hasil evaluasi mata kuliah'))
      setCourseDashboard(null)
    } finally {
      setLoadingDashboard(false)
    }
  }

  // URL Routing Sync
  useEffect(() => {
    if (!coursesLoading && courses.length > 0 && mkId) {
      const match = courses.find((c) => String(c.id) === String(mkId))
      if (match) {
        setSelectedCourse(match)
        if (location.pathname.endsWith('/hasil')) {
          setCurrentView('results')
          fetchCourseDashboard(match.id)
        } else {
          setCurrentView('grades')
          fetchCourseComponents(match.id)
          fetchPesertaAndScores(match.id)
        }
      }
    }
  }, [mkId, location.pathname, courses, coursesLoading])

  // Handle Open Components View
  const handleSelectCourseComponents = async (course) => {
    setSelectedCourse(course)
    setCurrentView('components')
    await fetchCourseComponents(course.id)
  }

  // Handle Open Grades View
  const handleSelectCourseGrades = async (course) => {
    setSelectedCourse(course)
    setCurrentView('grades')
    navigate(`/penilaian/${course.id}/nilai`)
    await Promise.all([
      fetchCourseComponents(course.id),
      fetchPesertaAndScores(course.id),
    ])
  }

  // Handle Open Results View
  const handleSelectCourseResults = async (course) => {
    setSelectedCourse(course)
    setCurrentView('results')
    navigate(`/penilaian/${course.id}/hasil`)
    await fetchCourseDashboard(course.id)
  }

  // Pre-save duplicate check for Komponen Penilaian
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

  // Total Bobot Komponen Saat Ini & Sisa Bobot
  const totalBobotKomponen = useMemo(() => {
    const sum = componentsList.reduce((acc, c) => acc + Number(c.bobot || 0), 0)
    return Math.round(sum * 100) / 100
  }, [componentsList])

  const sisaBobot = useMemo(() => {
    return Math.max(0, Math.round((100 - totalBobotKomponen) * 100) / 100)
  }, [totalBobotKomponen])

  const handleOpenAddCompModal = () => {
    setFormBentukId('')
    const defaultVal = sisaBobot > 0 ? String(Math.min(20, sisaBobot)) : '0'
    setFormBobot(defaultVal)
    setIsAddCompModalOpen(true)
  }

  // Pre-save validation: Buka ConfirmDialog sebelum simpan
  const handlePromptAddComp = (e) => {
    e.preventDefault()
    if (!selectedCourse || duplicateComponentError) return
    if (!formBentukId) {
      pushToast('Pilih bentuk penilaian terlebih dahulu', 'warning')
      return
    }
    const bobotNum = Number(formBobot)
    if (Number.isNaN(bobotNum) || bobotNum <= 0) {
      pushToast('Bobot harus berupa angka lebih besar dari 0%', 'warning')
      return
    }
    if (bobotNum > sisaBobot) {
      pushToast(`Bobot (${bobotNum}%) melebihi sisa bobot yang tersedia (${sisaBobot}%)`, 'warning')
      return
    }
    setIsConfirmAddCompOpen(true)
  }

  // Eksekusi Simpan Komponen setelah konfirmasi pengguna
  const handleExecuteAddComp = async () => {
    if (!selectedCourse || !formBentukId) return
    const bobotNum = Number(formBobot)
    setSubmittingComp(true)
    try {
      await api.post('/mk-bentuk-penilaian', {
        mata_kuliah_id: selectedCourse.id,
        bentuk_penilaian_id: Number(formBentukId),
        bobot: bobotNum,
        semester: selectedCourse.semester || 'Ganjil',
      })
      pushToast('Komponen bentuk penilaian berhasil ditambahkan', 'success')
      setIsConfirmAddCompOpen(false)
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

  // 4. Setting Bobot IK Workflow
  const handleOpenSettingBobot = async (component) => {
    setSelectedComponent(component)
    setCurrentView('weights')
    setLoadingIkRows(true)
    setIkWeightsInput({})

    try {
      const cpmkRes = await api.get('/cpmk', {
        params: { mata_kuliah_id: selectedCourse.id },
      })
      const cList = Array.isArray(cpmkRes.data) ? cpmkRes.data : []
      setCpmkList(cList)

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

  // --- TAHAP D2: SCORES LOOKUP & COMPUTATION ---
  const scoresByPesertaAndComp = useMemo(() => {
    const map = new Map()
    scoresList.forEach((s) => {
      map.set(`${s.peserta_mata_kuliah_id}_${s.mk_bentuk_penilaian_id}`, s)
    })
    return map
  }, [scoresList])



  const filteredPesertaList = useMemo(() => {
    const q = searchPeserta.toLowerCase().trim()
    if (!q) return pesertaList
    return pesertaList.filter((p) => {
      const nim = (p.mahasiswa?.nim || p.nim || '').toLowerCase()
      const nama = (p.mahasiswa?.nama || p.nama || '').toLowerCase()
      return nim.includes(q) || nama.includes(q)
    })
  }, [pesertaList, searchPeserta])

  // Hitung Kalkulasi Engine
  const handleRunKalkulasi = async () => {
    if (!selectedCourse || runningKalkulasi) return
    setRunningKalkulasi(true)
    try {
      const res = await api.post(`/kalkulasi/run/${selectedCourse.id}`)
      pushToast(
        `Kalkulasi OBE berhasil diproses untuk ${res.data?.jumlah_peserta_diproses ?? 0} peserta!`,
        'success'
      )
      await Promise.all([
        fetchPesertaAndScores(selectedCourse.id),
        fetchCourseComponents(selectedCourse.id),
      ])
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menjalankan kalkulasi evaluasi'), 'error')
    } finally {
      setRunningKalkulasi(false)
    }
  }

  // Open Modal Input Nilai Mahasiswa
  const handleOpenGradeModal = (peserta) => {
    setActivePeserta(peserta)
    const initialInputs = {}
    componentsList.forEach((comp) => {
      const s = scoresByPesertaAndComp.get(`${peserta.id}_${comp.id}`)
      initialInputs[comp.id] = s ? String(s.nilai) : ''
    })
    setGradeInputs(initialInputs)
    setIsGradeModalOpen(true)
  }

  // Save Modal Grades
  const handleSaveStudentGrades = async (e) => {
    e.preventDefault()
    if (!selectedCourse || !activePeserta || submittingGrades) return

    for (const comp of componentsList) {
      const val = gradeInputs[comp.id]
      if (val !== '' && val !== null && val !== undefined) {
        const num = Number(val)
        if (Number.isNaN(num) || num < 0 || num > 100) {
          const compNama = bentukMap.get(Number(comp.bentuk_penilaian_id))?.nama || `Komponen #${comp.id}`
          pushToast(`Nilai komponen "${compNama}" harus berupa angka antara 0 sampai 100`, 'error')
          return
        }
      }
    }

    setSubmittingGrades(true)
    try {
      const recordsToCreate = []
      const promisesToUpdate = []

      for (const comp of componentsList) {
        const val = gradeInputs[comp.id]
        const existing = scoresByPesertaAndComp.get(`${activePeserta.id}_${comp.id}`)

        if (val !== '' && val !== null && val !== undefined) {
          const numVal = Number(val)
          if (existing) {
            if (Number(existing.nilai) !== numVal) {
              promisesToUpdate.push(api.put(`/nilai/${existing.id}`, { nilai: numVal }))
            }
          } else {
            recordsToCreate.push({
              peserta_mata_kuliah_id: activePeserta.id,
              mk_bentuk_penilaian_id: comp.id,
              nilai: numVal,
            })
          }
        }
      }

      if (recordsToCreate.length > 0) {
        await api.post('/nilai/manual', {
          mk_id: selectedCourse.id,
          semester: selectedCourse.semester || 'Ganjil',
          records: recordsToCreate,
        })
      }

      if (promisesToUpdate.length > 0) {
        await Promise.all(promisesToUpdate)
      }

      pushToast('Nilai mahasiswa berhasil disimpan', 'success')
      setIsGradeModalOpen(false)
      setActivePeserta(null)
      await fetchPesertaAndScores(selectedCourse.id)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan nilai mahasiswa'), 'error')
    } finally {
      setSubmittingGrades(false)
    }
  }

  // Delete Individual Score Confirmation
  const handleDeleteScorePrompt = (comp) => {
    const existing = scoresByPesertaAndComp.get(`${activePeserta?.id}_${comp.id}`)
    if (!existing) return
    const compNama = bentukMap.get(Number(comp.bentuk_penilaian_id))?.nama || `Komponen #${comp.id}`
    setDeletingScoreId(existing.id)
    setDeletingScoreCompName(compNama)
    setIsDeleteScoreModalOpen(true)
  }

  const handleConfirmDeleteScore = async () => {
    if (!deletingScoreId) return
    setDeletingScoreLoading(true)
    try {
      await api.delete(`/nilai/${deletingScoreId}`)
      pushToast(`Nilai "${deletingScoreCompName}" berhasil dihapus`, 'success')
      setIsDeleteScoreModalOpen(false)
      setDeletingScoreId(null)
      await fetchPesertaAndScores(selectedCourse.id)
      if (activePeserta) {
        setGradeInputs((prev) => {
          const copy = { ...prev }
          for (const comp of componentsList) {
            const s = scoresByPesertaAndComp.get(`${activePeserta.id}_${comp.id}`)
            if (s && s.id === deletingScoreId) {
              copy[comp.id] = ''
            }
          }
          return copy
        })
      }
    } catch (err) {
      pushToast(getDeleteErrorMessage(err, 'Gagal menghapus nilai'), 'error')
    } finally {
      setDeletingScoreLoading(false)
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

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => reloadCourses()}
                  disabled={coursesLoading}
                  data-testid="btn-reload-courses"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors"
                  title="Muat ulang daftar mata kuliah dari server"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${coursesLoading ? 'animate-spin text-[#1A3A6B]' : 'text-[#64748B]'}`} />
                  <span>Muat Ulang</span>
                </button>
                <div className="text-xs text-[#64748B]">
                  Total: <span className="font-semibold text-[#142B4A]">{filteredCourses.length}</span> mata kuliah
                </div>
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
                    <TableActionHeader>Aksi Penilaian</TableActionHeader>
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
                  ) : coursesError ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#64748B]">
                        <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto">
                          <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                            <AlertCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-[#142B4A]">
                              Gagal Memuat Daftar Mata Kuliah
                            </p>
                            <p className="text-xs text-[#64748B] mt-0.5">
                              {coursesError}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => reloadCourses()}
                            data-testid="btn-retry-courses"
                            className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] transition-colors shadow-sm"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Muat Ulang</span>
                          </button>
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
                      <tr key={mk.id} className="align-top hover:bg-[#F8FAFC]/80 transition-colors">
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
                        <TableActionCell>
                          <TableActionButton
                            variant="secondary"
                            onClick={() => handleSelectCourseComponents(mk)}
                            data-testid={`btn-bentuk-penilaian-${mk.id}`}
                            icon={Layers}
                            label="Bentuk Penilaian"
                            title="Bentuk Penilaian"
                          />
                          <TableActionButton
                            variant="secondary"
                            onClick={() => handleSelectCourseGrades(mk)}
                            data-testid={`btn-input-nilai-${mk.id}`}
                            icon={Calculator}
                            label="Input Nilai"
                            title="Input Nilai"
                          />
                          <TableActionButton
                            variant="secondary"
                            onClick={() => handleSelectCourseResults(mk)}
                            data-testid={`btn-hasil-${mk.id}`}
                            icon={Award}
                            label="Hasil"
                            title="Hasil Evaluasi"
                          />
                        </TableActionCell>
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
          VIEW 2: BENTUK PENILAIAN PER MATA KULIAH
      ========================================================================= */}
      {currentView === 'components' && selectedCourse && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setCurrentView('list')
                navigate('/penilaian')
              }}
              className="btn-kembali"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Daftar Mata Kuliah</span>
            </button>
            <div className="flex items-center gap-2">
              <ActionButton
                onClick={handleOpenAddCompModal}
                disabled={sisaBobot <= 0}
                data-testid="btn-tambah-komponen-mk"
                className="bg-[#1A3A6B] text-white hover:bg-[#142B4A] disabled:opacity-50"
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
                    <TableActionHeader />
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
                        <tr key={comp.id} className="align-top hover:bg-[#F8FAFC]/80 transition-colors">
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
                          <TableActionCell>
                            <TableActionButton
                              variant="primary"
                              onClick={() => handleOpenSettingBobot(comp)}
                              data-testid={`btn-setting-bobot-${comp.id}`}
                              icon={Sliders}
                              label="Setting Bobot IK"
                              title="Setting Bobot IK"
                            />
                          </TableActionCell>
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
          VIEW 3: SETTING BOBOT PER KOMPONEN
      ========================================================================= */}
      {currentView === 'weights' && selectedCourse && selectedComponent && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setCurrentView('components')}
            className="btn-kembali"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Bentuk Penilaian</span>
          </button>

          <PageHeader
            eyebrow={`SETTING ALOKASI BOBOT · ${selectedCourse.kode}`}
            title={`Setting Bobot IK: ${bentukMap.get(Number(selectedComponent.bentuk_penilaian_id))?.nama || 'Komponen Penilaian'}`}
            description="Alokasikan bobot penilaian komponen ini ke masing-masing Indikator Kinerja (IK) yang dipetakan pada CPMK mata kuliah."
            badge={`Bobot Komponen: ${selectedComponent.bobot}%`}
          />

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
          VIEW 4: INPUT & KELOLA NILAI MAHASISWA (TAHAP D2)
      ========================================================================= */}
      {currentView === 'grades' && selectedCourse && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setCurrentView('list')
                navigate('/penilaian')
              }}
              className="btn-kembali"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Daftar Mata Kuliah</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectCourseComponents(selectedCourse)}
                className="inline-flex items-center gap-1.5 rounded border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
              >
                <Layers className="h-3.5 w-3.5 text-[#1A3A6B]" />
                <span>Pengaturan Bentuk Penilaian</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectCourseResults(selectedCourse)}
                className="inline-flex items-center gap-1.5 rounded border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
              >
                <Award className="h-3.5 w-3.5 text-amber-600" />
                <span>Lihat Hasil Capaian</span>
              </button>
              <ActionButton
                onClick={handleRunKalkulasi}
                disabled={runningKalkulasi || componentsList.length === 0}
                data-testid="btn-run-kalkulasi"
                className="bg-[#1A3A6B] text-white hover:bg-[#142B4A] disabled:opacity-50"
              >
                {runningKalkulasi ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menghitung Evaluasi...</span>
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4" />
                    <span>Hitung Evaluasi Capaian</span>
                  </>
                )}
              </ActionButton>
            </div>
          </div>

          <PageHeader
            eyebrow={`MATA KULIAH ${selectedCourse.kode}`}
            title={`Input Nilai: ${selectedCourse.nama}`}
            description="Pengisian nilai asesmen mahasiswa per komponen penilaian mata kuliah serta kalkulasi perolehan capaian pembelajaran OBE."
            badge={`${selectedCourse.sks} SKS · ${selectedCourse.semester} ${selectedCourse.tahun_ajaran || '2024/2025'}`}
          />

          {/* Neutral note for SIAP sync */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-[#64748B] flex items-center gap-2.5">
            <Info className="h-4 w-4 text-[#1A3A6B] shrink-0" />
            <span>
              <strong>Catatan:</strong> Sinkronisasi nilai otomatis ke sistem SIAP UNDIP belum tersedia. Seluruh pengisian dan pemutakhiran nilai dilakukan secara manual per komponen asesmen.
            </span>
          </div>

          {/* Validation Warnings Alert Banner (if any) */}
          {(totalBobotKomponen !== 100 || validationWarnings.length > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Peringatan Konfigurasi Sebelum Kalkulasi:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 pl-1">
                {totalBobotKomponen !== 100 && (
                  <li>
                    Total bobot bentuk penilaian saat ini {totalBobotKomponen}% (standar ideal adalah 100%).
                  </li>
                )}
                {validationWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Ringkasan Komponen Penilaian & Bobot */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3 mb-3">
              <div>
                <h4 className="text-xs font-bold text-[#142B4A] uppercase tracking-wider">
                  Komponen Penilaian Mata Kuliah
                </h4>
                <p className="text-[11px] text-[#64748B]">
                  Instrumen asesmen yang digunakan untuk mengevaluasi mahasiswa.
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-[#64748B]">Total Bobot:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    totalBobotKomponen === 100
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {totalBobotKomponen}% / 100%
                </span>
              </div>
            </div>

            {loadingComponents ? (
              <div className="flex items-center gap-2 text-xs text-[#64748B] py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1A3A6B]" />
                <span>Memuat komponen bentuk penilaian...</span>
              </div>
            ) : componentsList.length === 0 ? (
              <p className="text-xs text-[#64748B] py-2">
                Belum ada komponen bentuk penilaian. Klik tombol "Pengaturan Bentuk Penilaian" di atas untuk menambahkan.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                {componentsList.map((comp) => {
                  const bData = bentukMap.get(Number(comp.bentuk_penilaian_id))
                  return (
                    <div
                      key={comp.id}
                      className="inline-flex items-center gap-2 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-xs"
                    >
                      <span className="font-semibold text-[#142B4A]">
                        {bData?.nama || `Komponen #${comp.id}`}
                      </span>
                      <span className="font-mono font-bold text-[#1A3A6B] bg-white border border-[#CBD5E1] px-1.5 py-0.5 rounded text-[10px]">
                        {comp.bobot}%
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Students & Grades Table */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Cari NIM atau nama mahasiswa..."
                  value={searchPeserta}
                  onChange={(e) => setSearchPeserta(e.target.value)}
                  className="w-full rounded-md border border-[#CBD5E1] bg-white pl-8 pr-3 py-1.5 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none"
                />
              </div>
              <div className="text-xs text-[#64748B]">
                Total: <span className="font-semibold text-[#142B4A]">{filteredPesertaList.length}</span> peserta
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-3 w-28">NIM</th>
                    <th className="py-3 px-4 min-w-[160px]">Nama Mahasiswa</th>
                    {componentsList.map((comp) => {
                      const bData = bentukMap.get(Number(comp.bentuk_penilaian_id))
                      return (
                        <th key={comp.id} className="py-3 px-3 text-center min-w-[100px]">
                          <div>{bData?.nama || `Komp #${comp.id}`}</div>
                          <span className="text-[10px] font-mono text-[#64748B]">({comp.bobot}%)</span>
                        </th>
                      )
                    })}
                    <TableActionHeader />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {loadingPeserta || loadingScores ? (
                    <tr>
                      <td colSpan={4 + componentsList.length} className="py-12 text-center text-[#64748B]">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                          <span>Memuat daftar peserta dan nilai perkuliahan...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPesertaList.length === 0 ? (
                    <tr>
                      <td colSpan={4 + componentsList.length} className="py-12 text-center text-[#64748B]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="h-8 w-8 text-[#CBD5E1]" />
                          <p className="font-medium text-[#142B4A]">
                            {searchPeserta ? 'Tidak ada mahasiswa yang cocok dengan pencarian' : 'Belum ada peserta terdaftar untuk mata kuliah ini'}
                          </p>
                          <p className="text-[11px] text-[#64748B]">
                            {searchPeserta ? 'Periksa kembali kata kunci pencarian' : 'Hubungi Bagian Akademik untuk pendaftaran peserta mata kuliah'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPesertaList.map((peserta, idx) => {
                      const nim = peserta.mahasiswa?.nim || peserta.nim || '-'
                      const nama = peserta.mahasiswa?.nama || peserta.nama || `Mahasiswa #${peserta.mahasiswa_id}`

                      return (
                        <tr key={peserta.id} className="align-top hover:bg-[#F8FAFC]/80 transition-colors">
                          <td className="py-3 px-3 text-center text-[#64748B]">{idx + 1}</td>
                          <td className="py-3 px-3 font-mono font-semibold text-[#1A3A6B]">{nim}</td>
                          <td className="py-3 px-4 font-semibold text-[#142B4A]">{nama}</td>
                          {componentsList.map((comp) => {
                            const scoreObj = scoresByPesertaAndComp.get(`${peserta.id}_${comp.id}`)
                            return (
                              <td key={comp.id} className="py-3 px-3 text-center font-mono">
                                {scoreObj && scoreObj.nilai != null ? (
                                  <span className="font-semibold text-[#142B4A]">
                                    {Number(scoreObj.nilai).toFixed(0)}
                                  </span>
                                ) : (
                                  <span className="text-[#CBD5E1]">-</span>
                                )}
                              </td>
                            )
                          })}
                          <TableActionCell>
                            <TableActionButton
                              variant="primary"
                              onClick={() => handleOpenGradeModal(peserta)}
                              data-testid={`btn-nilai-peserta-${peserta.id}`}
                              icon={Edit3}
                              label="Nilai"
                              title="Nilai Peserta"
                            />
                          </TableActionCell>
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
          VIEW 5: HASIL EVALUASI & CAPAIAN MK (TAHAP D2)
      ========================================================================= */}
      {currentView === 'results' && selectedCourse && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setCurrentView('list')
                navigate('/penilaian')
              }}
              className="btn-kembali"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Daftar Mata Kuliah</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectCourseGrades(selectedCourse)}
                className="inline-flex items-center gap-1.5 rounded border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
              >
                <Calculator className="h-3.5 w-3.5 text-blue-600" />
                <span>Input / Edit Nilai</span>
              </button>
              <ActionButton
                onClick={handleRunKalkulasi}
                disabled={runningKalkulasi}
                data-testid="btn-re-run-kalkulasi"
                className="bg-[#1A3A6B] text-white hover:bg-[#142B4A] disabled:opacity-50"
              >
                {runningKalkulasi ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menghitung Ulang...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Hitung Ulang Evaluasi</span>
                  </>
                )}
              </ActionButton>
            </div>
          </div>

          <PageHeader
            eyebrow={`MATA KULIAH ${selectedCourse.kode}`}
            title={`Hasil Evaluasi Capaian: ${selectedCourse.nama}`}
            description="Ringkasan perolehan nilai akhir mahasiswa, distribusi capaian CPMK, dan pemetaan ketercapaian Indikator Kinerja (IK)."
            badge={`${selectedCourse.sks} SKS · ${selectedCourse.semester} ${selectedCourse.tahun_ajaran || '2024/2025'}`}
          />

          {/* Neutral note for SIAP sync */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-[#64748B] flex items-center gap-2.5">
            <Info className="h-4 w-4 text-[#1A3A6B] shrink-0" />
            <span>
              <strong>Informasi Sinkronisasi:</strong> Hasil evaluasi ini tersimpan secara internal di database SADEWA. Sinkronisasi transkrip nilai resmi ke sistem SIAP UNDIP belum tersedia.
            </span>
          </div>

          {loadingDashboard ? (
            <div className="rounded-lg border border-[#E2E8F0] bg-white p-12 text-center text-xs text-[#64748B]">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#1A3A6B] mb-2" />
              <span>Memuat ringkasan hasil evaluasi perkuliahan...</span>
            </div>
          ) : errorDashboard ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-xs text-amber-800">
              <AlertCircle className="h-6 w-6 mx-auto text-amber-600 mb-2" />
              <p className="font-semibold">{errorDashboard}</p>
              <p className="text-[11px] text-amber-700 mt-1">
                Silakan lakukan pengisian nilai terlebih dahulu lalu klik tombol "Hitung Evaluasi Capaian".
              </p>
            </div>
          ) : courseDashboard ? (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase text-[#64748B]">Total Peserta</span>
                  <div className="mt-2 text-2xl font-bold text-[#142B4A]">
                    {courseDashboard.jumlah_peserta ?? 0}
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Mahasiswa terdaftar</span>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase text-[#64748B]">Rata-rata Nilai Akhir</span>
                  <div className="mt-2 text-2xl font-bold text-[#1A3A6B]">
                    {courseDashboard.rata_rata_nilai_akhir != null
                      ? Number(courseDashboard.rata_rata_nilai_akhir).toFixed(1)
                      : '-'}
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Skala 0 - 100</span>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase text-[#64748B]">CPMK Terpenuhi</span>
                  <div className="mt-2 text-2xl font-bold text-[#142B4A]">
                    {Array.isArray(courseDashboard.cpmk_breakdown)
                      ? `${courseDashboard.cpmk_breakdown.filter((c) => Number(c.rata_rata) >= 70).length} / ${courseDashboard.cpmk_breakdown.length}`
                      : '0'}
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Kriteria minimal skor &gt;= 70</span>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase text-[#64748B]">IK Terpetakan</span>
                  <div className="mt-2 text-2xl font-bold text-[#142B4A]">
                    {Array.isArray(courseDashboard.ik_breakdown) ? courseDashboard.ik_breakdown.length : 0}
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Indikator Kinerja CPL</span>
                </div>
              </div>

              {/* CPMK Breakdown Table */}
              <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <h3 className="text-xs font-bold text-[#142B4A] uppercase tracking-wider">
                    Capaian Pembelajaran Mata Kuliah (CPMK)
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Rata-rata nilai capaian CPMK dan jumlah mahasiswa yang mencapai ambang batas minimal.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0]">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">No</th>
                        <th className="py-2.5 px-3 w-32">Kode CPMK</th>
                        <th className="py-2.5 px-3 text-center w-36">Nilai Rata-rata</th>
                        <th className="py-2.5 px-3 text-center w-44">Mahasiswa Tercapai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {!courseDashboard.cpmk_breakdown || courseDashboard.cpmk_breakdown.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-[#64748B]">
                            Belum ada data CPMK untuk mata kuliah ini.
                          </td>
                        </tr>
                      ) : (
                        courseDashboard.cpmk_breakdown.map((item, idx) => {
                          const pct = item.jumlah_peserta > 0
                            ? Math.round((item.jumlah_tercapai / item.jumlah_peserta) * 100)
                            : 0
                          return (
                            <tr key={item.cpmk_id || idx} className="hover:bg-[#F8FAFC]">
                              <td className="py-2.5 px-3 text-center text-[#64748B]">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-[#1A3A6B]">{item.kode}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-semibold text-[#142B4A]">
                                {Number(item.rata_rata).toFixed(1)}
                              </td>
                              <td className="py-2.5 px-3 text-center text-[#64748B]">
                                <span className="font-semibold text-[#142B4A]">{item.jumlah_tercapai}</span> / {item.jumlah_peserta} ({pct}%)
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* IK Breakdown Table */}
              <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <h3 className="text-xs font-bold text-[#142B4A] uppercase tracking-wider">
                    Ketercapaian Indikator Kinerja (IK)
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Kontribusi rata-rata mata kuliah ini terhadap masing-masing Indikator Kinerja CPL.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0]">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">No</th>
                        <th className="py-2.5 px-3 w-36">Kode IK</th>
                        <th className="py-2.5 px-3 text-center w-36">Rata-rata Capaian (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {!courseDashboard.ik_breakdown || courseDashboard.ik_breakdown.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-[#64748B]">
                            Belum ada pemetaan IK untuk mata kuliah ini.
                          </td>
                        </tr>
                      ) : (
                        courseDashboard.ik_breakdown.map((item, idx) => (
                          <tr key={item.ik_id || idx} className="hover:bg-[#F8FAFC]">
                            <td className="py-2.5 px-3 text-center text-[#64748B]">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-[#1A3A6B]">{item.kode}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-semibold text-[#142B4A]">
                              {Number(item.rata_rata).toFixed(1)}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>


            </div>
          ) : null}
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
        <form onSubmit={handlePromptAddComp} className="space-y-4">
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[#64748B]">
              <span>Total bobot saat ini:</span>
              <span className="font-semibold font-mono text-[#142B4A]">{totalBobotKomponen}%</span>
            </div>
            <div className="flex items-center justify-between text-[#1A3A6B] font-semibold pt-1 border-t border-[#E2E8F0]">
              <span>Sisa bobot yang tersedia (100 - {totalBobotKomponen}%):</span>
              <span className={`font-mono font-bold text-sm ${sisaBobot === 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                {sisaBobot}%
              </span>
            </div>
            {sisaBobot <= 0 && (
              <p className="text-[11px] text-amber-700 font-medium pt-1">
                Total bobot komponen mata kuliah ini sudah mencapai 100%. Tidak dapat menambah komponen baru.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Pilih Bentuk Penilaian Prodi <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formBentukId}
              onChange={(e) => setFormBentukId(e.target.value)}
              disabled={submittingComp || sisaBobot <= 0}
              data-testid="select-bentuk-penilaian"
              className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B] disabled:bg-slate-100 disabled:text-slate-400"
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
                min="0.01"
                max={sisaBobot > 0 ? sisaBobot : 0.01}
                step="any"
                value={formBobot}
                onChange={(e) => setFormBobot(e.target.value)}
                disabled={submittingComp || sisaBobot <= 0}
                placeholder={`Maks ${sisaBobot}%`}
                data-testid="input-bobot-komponen"
                className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B] disabled:bg-slate-100 disabled:text-slate-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748B]">%</span>
            </div>
            {Number(formBobot) <= 0 && formBobot !== '' && (
              <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Bobot harus lebih besar dari 0%.</span>
              </p>
            )}
            {Number(formBobot) > sisaBobot && (
              <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Bobot ({formBobot}%) melebihi sisa bobot yang tersedia ({sisaBobot}%).</span>
              </p>
            )}
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
              disabled={
                submittingComp ||
                Boolean(duplicateComponentError) ||
                !formBentukId ||
                !formBobot ||
                Number(formBobot) <= 0 ||
                Number(formBobot) > sisaBobot ||
                sisaBobot <= 0
              }
              data-testid="btn-submit-add-comp"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {submittingComp && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simpan Komponen</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL INPUT NILAI MAHASISWA (TAHAP D2)
      ========================================================================= */}
      <Modal
        open={isGradeModalOpen}
        title={
          activePeserta
            ? `Input Nilai: ${activePeserta.mahasiswa?.nama || activePeserta.nama} (${activePeserta.mahasiswa?.nim || activePeserta.nim})`
            : 'Input Nilai Mahasiswa'
        }
        onClose={submittingGrades ? () => {} : () => setIsGradeModalOpen(false)}
        size="max-w-lg"
      >
        <form onSubmit={handleSaveStudentGrades} className="space-y-4">
          <p className="text-xs text-[#64748B]">
            Masukkan nilai (skala 0 - 100) untuk masing-masing komponen evaluasi. Data yang sudah ada dapat diperbarui atau dihapus.
          </p>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {componentsList.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4 text-center">
                Belum ada komponen bentuk penilaian pada mata kuliah ini.
              </p>
            ) : (
              componentsList.map((comp) => {
                const bData = bentukMap.get(Number(comp.bentuk_penilaian_id))
                const existingScore = activePeserta
                  ? scoresByPesertaAndComp.get(`${activePeserta.id}_${comp.id}`)
                  : null

                return (
                  <div
                    key={comp.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#142B4A]">
                          {bData?.nama || `Komponen #${comp.id}`}
                        </span>
                        <span className="font-mono text-[10px] font-semibold text-[#1A3A6B] bg-white border border-[#CBD5E1] px-1.5 py-0.5 rounded">
                          Bobot: {comp.bobot}%
                        </span>
                      </div>
                      <p className="text-[10px] text-[#64748B] mt-0.5">
                        {existingScore ? 'Nilai tersimpan di server' : 'Belum diisi'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <div className="relative w-24">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          placeholder="0 - 100"
                          value={gradeInputs[comp.id] ?? ''}
                          onChange={(e) =>
                            setGradeInputs({ ...gradeInputs, [comp.id]: e.target.value })
                          }
                          data-testid={`input-nilai-comp-${comp.id}`}
                          className="w-full rounded border border-[#CBD5E1] bg-white px-2 py-1.5 text-center text-xs font-mono font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                        />
                      </div>
                      {existingScore && (
                        <button
                          type="button"
                          onClick={() => handleDeleteScorePrompt(comp)}
                          title="Hapus Nilai Komponen"
                          data-testid={`btn-delete-score-${comp.id}`}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={() => setIsGradeModalOpen(false)}
              disabled={submittingGrades}
              className="rounded-md border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submittingGrades || componentsList.length === 0}
              data-testid="btn-submit-student-grades"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {submittingGrades && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simpan Nilai</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          CONFIRM DIALOG HAPUS NILAI KOMPONEN
      ========================================================================= */}
      {/* =========================================================================
          CONFIRM DIALOG TAMBAH KOMPONEN BENTUK PENILAIAN
      ========================================================================= */}
      <ConfirmDialog
        open={isConfirmAddCompOpen}
        title="Konfirmasi Tambah Komponen Penilaian"
        message="Komponen dan bobotnya tidak dapat diubah atau dihapus setelah disimpan."
        warning={`Komponen "${bentukMap.get(Number(formBentukId))?.nama || ''}" akan disimpan dengan bobot ${formBobot}%. Karena sistem tidak menyediakan aksi edit/hapus komponen, pastikan instrumen dan bobot sudah tepat.`}
        confirmLabel="Ya, Simpan Komponen"
        cancelLabel="Batal"
        loading={submittingComp}
        onConfirm={handleExecuteAddComp}
        onCancel={() => setIsConfirmAddCompOpen(false)}
      />

      <ConfirmDialog
        open={isDeleteScoreModalOpen}
        title="Konfirmasi Hapus Nilai"
        message={`Apakah Anda yakin ingin menghapus data nilai "${deletingScoreCompName}" untuk mahasiswa ini?`}
        warning="Nilai yang dihapus tidak dapat dipulihkan dan kalkulasi evaluasi perlu dijalankan ulang."
        confirmLabel="Hapus Nilai"
        cancelLabel="Batal"
        loading={deletingScoreLoading}
        onConfirm={handleConfirmDeleteScore}
        onCancel={() => {
          setIsDeleteScoreModalOpen(false)
          setDeletingScoreId(null)
        }}
      />
    </div>
  )
}
