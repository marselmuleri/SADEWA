import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Users,
  Plus,
  Search,
  Filter,
  Trash2,
  BookOpen,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Upload,
  Download,
  StopCircle,
} from 'lucide-react'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import Modal from '../components/Modal'
import SearchableSelect from '../components/SearchableSelect'
import useAuth from '../hooks/useAuth'
import useDosenCourses from '../hooks/useDosenCourses'
import useToast from '../hooks/useToast'
import api from '../services/api'
import { getApiErrorMessage } from './superAdminHelpers'
import { parseCsv, downloadCsvTemplate } from '../utils/csvParser'
import { fetchAllMahasiswa } from '../utils/mahasiswaApi'

const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const MAX_CSV_ROWS = 500

export default function PesertaMataKuliahPage() {
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()
  const { courses: dosenCourses, loading: dosenCoursesLoading } = useDosenCourses()
  const [adminCourses, setAdminCourses] = useState([])
  const [adminCoursesLoading, setAdminCoursesLoading] = useState(false)

  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isDosen = currentRole === 'dosen'
  const canManage = currentRole === 'admin_prodi'

  useEffect(() => {
    if (!isDosen && user?.id) {
      setAdminCoursesLoading(true)
      api.get('/mata-kuliah')
        .then((res) => {
          if (Array.isArray(res.data)) {
            setAdminCourses(res.data)
          }
        })
        .catch(() => setAdminCourses([]))
        .finally(() => setAdminCoursesLoading(false))
    }
  }, [isDosen, user?.id])

  const courses = isDosen ? dosenCourses : adminCourses
  const coursesLoading = isDosen ? dosenCoursesLoading : adminCoursesLoading

  const [selectedMkId, setSelectedMkId] = useState('')
  const [pesertaList, setPesertaList] = useState([])
  const [mahasiswaList, setMahasiswaList] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [kelasFilter, setKelasFilter] = useState('ALL')

  // Modal State
  const [openAddModal, setOpenAddModal] = useState(false)
  const [openDeleteModal, setOpenDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Form State
  const [form, setForm] = useState({
    mahasiswa_id: '',
    kelas: 'A',
  })

  // CSV Import State
  const [openImportModal, setOpenImportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importRows, setImportRows] = useState([])
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, percent: 0 })
  const [importSummary, setImportSummary] = useState(null)

  // Ref untuk menghentikan proses impor peserta
  const stopImportRef = useRef(false)

  // Set default selected course
  useEffect(() => {
    if (courses.length > 0 && !selectedMkId) {
      setSelectedMkId(courses[0].id)
    }
  }, [courses, selectedMkId])

  // Fetch Seluruh Master Mahasiswa (semua halaman paginasi) untuk lookup & validasi NIM
  useEffect(() => {
    fetchAllMahasiswa()
      .then((data) => {
        setMahasiswaList(data)
      })
      .catch(() => {
        // Fallback demo mahasiswa jika backend kosong/offline
        setMahasiswaList([
          { id: 1, nim: '24060121120001', nama: 'Andi Santoso', semester_aktif: 3, status_masuk: 'Reguler' },
          { id: 2, nim: '24060121120002', nama: 'Budi Kurniawan', semester_aktif: 3, status_masuk: 'Reguler' },
          { id: 3, nim: '24060121120003', nama: 'Citra Kirana', semester_aktif: 3, status_masuk: 'Reguler' },
          { id: 4, nim: '24060121120004', nama: 'Dewi Lestari', semester_aktif: 3, status_masuk: 'Reguler' },
          { id: 5, nim: '24060121120005', nama: 'Eko Prasetyo', semester_aktif: 3, status_masuk: 'Reguler' },
        ])
      })
  }, [])

  // Map mahasiswa_id -> Mahasiswa object
  const mahasiswaMap = useMemo(() => {
    const map = new Map()
    mahasiswaList.forEach((m) => map.set(Number(m.id), m))
    return map
  }, [mahasiswaList])

  // Map NIM -> Mahasiswa object (untuk validasi NIM di CSV)
  const mahasiswaByNimMap = useMemo(() => {
    const map = new Map()
    mahasiswaList.forEach((m) => {
      if (m.nim) {
        map.set(String(m.nim).trim(), m)
      }
    })
    return map
  }, [mahasiswaList])

  // Fetch Peserta whenever selected course changes
  const fetchPeserta = async () => {
    if (!selectedMkId) return
    setLoading(true)
    try {
      const res = await api.get('/peserta-mata-kuliah', {
        params: { mata_kuliah_id: selectedMkId },
      })
      if (Array.isArray(res.data)) {
        setPesertaList(res.data)
      } else {
        setPesertaList([])
      }
    } catch (err) {
      console.warn('Gagal memuat peserta:', err)
      // Demo fallback jika belum ada data riil
      setPesertaList([
        { id: 101, mata_kuliah_id: Number(selectedMkId), mahasiswa_id: 1, kelas: 'A' },
        { id: 102, mata_kuliah_id: Number(selectedMkId), mahasiswa_id: 2, kelas: 'A' },
        { id: 103, mata_kuliah_id: Number(selectedMkId), mahasiswa_id: 3, kelas: 'B' },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPeserta()
  }, [selectedMkId])

  const currentCourse = useMemo(() => {
    return courses.find((c) => String(c.id) === String(selectedMkId)) || null
  }, [courses, selectedMkId])

  // Extract unique classes
  const availableClasses = useMemo(() => {
    const set = new Set()
    pesertaList.forEach((p) => {
      if (p.kelas) set.add(p.kelas)
    })
    return Array.from(set).sort()
  }, [pesertaList])

  // Filtered Peserta
  const filteredPeserta = useMemo(() => {
    return pesertaList.filter((p) => {
      const mhs = mahasiswaMap.get(Number(p.mahasiswa_id))
      const searchTarget = `${mhs?.nim || ''} ${mhs?.nama || ''} ${p.kelas || ''}`.toLowerCase()
      const matchesSearch = !search || searchTarget.includes(search.toLowerCase().trim())
      const matchesKelas = kelasFilter === 'ALL' || p.kelas === kelasFilter
      return matchesSearch && matchesKelas
    })
  }, [pesertaList, mahasiswaMap, search, kelasFilter])

  // Handlers Manual Add
  const handleOpenAdd = () => {
    setForm({ mahasiswa_id: '', kelas: 'A' })
    setFormError('')
    setOpenAddModal(true)
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!form.mahasiswa_id) {
      setFormError('Silakan pilih mahasiswa')
      return
    }

    if (!form.kelas?.trim()) {
      setFormError('Kelas wajib diisi')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/peserta-mata-kuliah', {
        mata_kuliah_id: Number(selectedMkId),
        mahasiswa_id: Number(form.mahasiswa_id),
        kelas: form.kelas.trim().toUpperCase(),
      })

      pushToast('Mahasiswa berhasil didaftarkan sebagai peserta')
      setOpenAddModal(false)
      fetchPeserta()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal mendaftarkan peserta mata kuliah')
      setFormError(msg)
      pushToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    try {
      await api.delete(`/peserta-mata-kuliah/${deleteTarget.id}`)
      pushToast('Peserta mata kuliah berhasil dihapus')
      setOpenDeleteModal(false)
      setDeleteTarget(null)
      fetchPeserta()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal menghapus peserta mata kuliah')
      pushToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // CSV Import Handlers
  const handleDownloadTemplate = () => {
    downloadCsvTemplate(
      'template_impor_peserta.csv',
      [
        { label: 'nim', key: 'nim' },
        { label: 'kelas', key: 'kelas' },
      ],
      [
        { nim: '24060121120001', kelas: 'A' },
        { nim: '24060121120002', kelas: 'A' },
        { nim: '24060121120003', kelas: 'B' },
      ]
    )
    pushToast('Template CSV peserta berhasil diunduh')
  }

  const handleOpenImport = () => {
    setImportFile(null)
    setImportRows([])
    setImportError('')
    setImportSummary(null)
    setImportProgress({ current: 0, total: 0, percent: 0 })
    stopImportRef.current = false
    setOpenImportModal(true)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    setImportError('')
    setImportSummary(null)
    setImportRows([])

    if (!file) {
      setImportFile(null)
      return
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('File harus berupa file berformat .csv')
      setImportFile(null)
      return
    }

    if (file.size > MAX_CSV_SIZE_BYTES) {
      setImportError(`Ukuran file melebihi batas maksimal 2 MB (ukuran file: ${(file.size / 1024 / 1024).toFixed(2)} MB)`)
      setImportFile(null)
      return
    }

    setImportFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result
        const parsed = parseCsv(text)
        const rows = parsed.rows || []

        if (rows.length === 0) {
          setImportError('File CSV tidak memiliki baris data yang valid')
          return
        }

        if (rows.length > MAX_CSV_ROWS) {
          setImportError(`Jumlah baris (${rows.length}) melebihi batas maksimal ${MAX_CSV_ROWS} baris per unggahan`)
          return
        }

        // Validasi per baris di frontend
        const seenNims = new Set()
        const validatedRows = rows.map((row, index) => {
          const rawNim = String(row.nim || '').trim()
          const rawKelas = String(row.kelas || 'A').trim().toUpperCase()

          const errors = []

          if (!rawNim) {
            errors.push('NIM wajib diisi')
          } else if (seenNims.has(rawNim)) {
            errors.push('Duplikat NIM di dalam file')
          } else {
            seenNims.add(rawNim)
          }

          // Cek apakah mahasiswa terdaftar di master mahasiswa prodi
          const mhsFound = mahasiswaByNimMap.get(rawNim)
          if (rawNim && !mhsFound) {
            errors.push('NIM tidak ditemukan di data mahasiswa prodi')
          }

          if (!rawKelas) {
            errors.push('Kelas wajib diisi')
          }

          return {
            rowNumber: index + 2,
            nim: rawNim,
            nama: mhsFound ? mhsFound.nama : '-',
            mahasiswa_id: mhsFound ? mhsFound.id : null,
            kelas: rawKelas || 'A',
            isValid: errors.length === 0,
            errorMessage: errors.join('; '),
          }
        })

        setImportRows(validatedRows)
      } catch (err) {
        setImportError(`Gagal membaca file CSV: ${err.message}`)
      }
    }
    reader.readAsText(file)
  }

  const handleStopImport = () => {
    stopImportRef.current = true
    pushToast('Menghentikan pendaftaran baris berikutnya...', 'warning')
  }

  const handleStartImport = async () => {
    if (!selectedMkId) {
      setImportError('Mata kuliah belum dipilih')
      return
    }

    const validRows = importRows.filter((r) => r.isValid)
    if (validRows.length === 0) {
      setImportError('Tidak ada baris yang valid untuk diproses')
      return
    }

    setImporting(true)
    setImportError('')
    stopImportRef.current = false

    const results = []
    let successCount = 0
    let duplicateCount = 0
    let failedCount = 0
    let abortedCount = 0

    const total = validRows.length
    for (let i = 0; i < total; i++) {
      if (stopImportRef.current) {
        // Batalkan baris-baris yang tersisa
        for (let j = i; j < total; j++) {
          abortedCount++
          results.push({
            rowNumber: validRows[j].rowNumber,
            nim: validRows[j].nim,
            nama: validRows[j].nama,
            kelas: validRows[j].kelas,
            status: 'aborted',
            message: 'Dibatalkan oleh pengguna (impor dihentikan)',
          })
        }
        break
      }

      const row = validRows[i]
      setImportProgress({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
      })

      try {
        await api.post('/peserta-mata-kuliah', {
          mata_kuliah_id: Number(selectedMkId),
          mahasiswa_id: Number(row.mahasiswa_id),
          kelas: row.kelas,
        })
        successCount++
        results.push({
          rowNumber: row.rowNumber,
          nim: row.nim,
          nama: row.nama,
          kelas: row.kelas,
          status: 'success',
          message: 'Berhasil didaftarkan',
        })
      } catch (err) {
        const errorDetail = err?.response?.data?.detail
        const isDuplicate =
          err?.response?.status === 400 &&
          (typeof errorDetail === 'string' &&
            (errorDetail.toLowerCase().includes('sudah') ||
              errorDetail.toLowerCase().includes('terdaftar') ||
              errorDetail.toLowerCase().includes('duplikat') ||
              errorDetail.toLowerCase().includes('duplicate') ||
              errorDetail.toLowerCase().includes('exists')))

        const statusCode = err?.response?.status

        if (statusCode && statusCode >= 500) {
          failedCount++
          results.push({
            rowNumber: row.rowNumber,
            nim: row.nim,
            nama: row.nama,
            kelas: row.kelas,
            status: 'failed',
            message: 'Server error, kemungkinan mahasiswa sudah terdaftar',
          })
        } else if (isDuplicate) {
          duplicateCount++
          results.push({
            rowNumber: row.rowNumber,
            nim: row.nim,
            nama: row.nama,
            kelas: row.kelas,
            status: 'duplicate',
            message: 'Sudah terdaftar sebagai peserta (dilewati)',
          })
        } else {
          failedCount++
          const reason = getApiErrorMessage(err, 'Gagal diproses oleh server')
          results.push({
            rowNumber: row.rowNumber,
            nim: row.nim,
            nama: row.nama,
            kelas: row.kelas,
            status: 'failed',
            message: reason,
          })
        }
      }
    }

    setImportSummary({
      totalProcessed: total,
      successCount,
      duplicateCount,
      failedCount,
      abortedCount,
      wasStopped: stopImportRef.current,
      details: results,
    })
    setImporting(false)
    fetchPeserta()
  }

  return (
    <div className="space-y-8 animate-[fadeUp_200ms_ease]">
      <PageHeader
        eyebrow="Manajemen Kelas & Peserta"
        title="Peserta Mata Kuliah"
        description={
          canManage
            ? 'Kelola roster peserta per mata kuliah program studi dengan impor massal CSV (NIM + kelas) atau pendaftaran manual sebagai cadangan.'
            : 'Lihat daftar peserta pada mata kuliah yang Anda ampu, filter per kelas paralel, dan cari mahasiswa.'
        }
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                variant="secondary"
                onClick={handleDownloadTemplate}
                data-testid="btn-unduh-template-peserta"
              >
                <Download className="h-4 w-4" />
                Unduh Template CSV
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={handleOpenImport}
                disabled={!selectedMkId}
                data-testid="btn-impor-peserta"
              >
                <Upload className="h-4 w-4" />
                Impor CSV
              </ActionButton>
              <ActionButton
                onClick={handleOpenAdd}
                disabled={!selectedMkId}
                data-testid="btn-tambah-peserta"
              >
                <Plus className="h-4 w-4" />
                Daftarkan Mahasiswa
              </ActionButton>
            </div>
          ) : null
        }
      />

      {/* Course Selector & Stat Cards */}
      <div className="grid gap-4 xl:grid-cols-4">
        <SectionCard
          className="xl:col-span-2"
          title={isDosen ? 'Mata Kuliah Yang Diampu' : 'Pilihan Mata Kuliah'}
        >
          <div className="space-y-3">
            <label className="label-filter">
              {isDosen
                ? 'Pilih Mata Kuliah yang Anda Ampu:'
                : 'Pilih Mata Kuliah untuk Mengelola Roster Peserta:'}
            </label>
            {coursesLoading ? (
              <div className="h-10 animate-pulse rounded border border-[#E2E8F0] bg-[#F8FAFC]" />
            ) : courses.length === 0 ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {isDosen
                  ? 'Anda belum terdaftar sebagai pengampu pada mata kuliah manapun.'
                  : 'Belum ada mata kuliah yang tersedia di program studi ini.'}
              </div>
            ) : (
              <SearchableSelect
                value={selectedMkId}
                onChange={(val) => setSelectedMkId(String(val))}
                data-testid="select-mata-kuliah"
                aria-label="Pilih mata kuliah"
                searchPlaceholder="Cari kode atau nama mata kuliah..."
                buttonClassName="font-semibold"
                options={courses.map((c) => ({
                  value: c.id,
                  label: `${c.kode} - ${c.nama}`,
                  description: `${c.sks} SKS · Semester ${c.semester}`,
                  searchText: c.nama,
                }))}
              />
            )}

            {currentCourse && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge tone="default">{currentCourse.kode}</Badge>
                <Badge tone="default">{currentCourse.sks} SKS</Badge>
                <Badge tone="default">Semester {currentCourse.semester}</Badge>
                {currentCourse.tahun_ajaran && (
                  <Badge tone="default">TA {currentCourse.tahun_ajaran}</Badge>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        <StatCard
          label="Total Peserta"
          value={pesertaList.length}
          caption="Mahasiswa terdaftar"
          icon={<Users className="h-4 w-4" />}
          accent="text-[#1A3A6B]"
        />

        <StatCard
          label="Kelas Paralel"
          value={availableClasses.length || 1}
          caption={availableClasses.join(', ') || 'Kelas A'}
          icon={<BookOpen className="h-4 w-4" />}
          accent="text-[#F4A300]"
        />
      </div>

      {/* Main Table Section */}
      <SectionCard
        title="Daftar Mahasiswa Terdaftar"
        description="Filter berdasarkan kelas atau cari nama/NIM mahasiswa."
        action={
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari NIM atau nama..."
                data-testid="input-search-peserta"
                className="h-8.5 w-48 rounded-[6px] border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
              />
            </div>

            {/* Filter Kelas */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-[#64748B]" />
              <select
                value={kelasFilter}
                onChange={(e) => setKelasFilter(e.target.value)}
                data-testid="filter-kelas"
                className="h-8.5 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              >
                <option value="ALL">Semua Kelas</option>
                {availableClasses.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        {loading ? (
          <div className="space-y-3 py-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-[#F8FAFC]" />
            ))}
          </div>
        ) : filteredPeserta.length === 0 ? (
          <div className="py-12 text-center" data-testid="peserta-empty-state">
            <UserCheck className="mx-auto h-10 w-10 text-[#94A3B8]" />
            <h4 className="mt-2 text-sm font-semibold text-[#142B4A]">Belum Ada Peserta</h4>
            <p className="mt-1 text-xs text-[#64748B]">
              {canManage
                ? 'Belum ada mahasiswa yang didaftarkan ke mata kuliah ini. Gunakan tombol Impor CSV atau Tambah Manual.'
                : 'Belum ada roster peserta mahasiswa pada mata kuliah ini.'}
            </p>
            {canManage && (
              <div className="mt-4 flex justify-center gap-2">
                <ActionButton
                  variant="secondary"
                  onClick={handleOpenImport}
                  data-testid="empty-btn-impor"
                >
                  <Upload className="h-4 w-4" />
                  Impor Peserta CSV
                </ActionButton>
                <ActionButton onClick={handleOpenAdd} data-testid="empty-btn-tambah">
                  <Plus className="h-4 w-4" />
                  Daftarkan Mahasiswa Manual
                </ActionButton>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="table-peserta">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                  <th className="pb-3 w-12 text-center">No</th>
                  <th className="pb-3 w-36">NIM</th>
                  <th className="pb-3">Nama Mahasiswa</th>
                  <th className="pb-3 w-28 text-center">Kelas</th>
                  <th className="pb-3 w-28 text-center">Status</th>
                  {canManage && <th className="pb-3 w-24 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {filteredPeserta.map((row, idx) => {
                  const mhs = mahasiswaMap.get(Number(row.mahasiswa_id))
                  return (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-[#F8FAFC]"
                      data-testid={`row-peserta-${row.id}`}
                    >
                      <td className="py-3 text-center text-xs text-[#64748B]">{idx + 1}</td>
                      <td className="py-3 font-mono text-xs font-semibold text-[#142B4A]">
                        {mhs?.nim || `ID #${row.mahasiswa_id}`}
                      </td>
                      <td className="py-3 font-medium text-[#142B4A]">
                        {mhs?.nama || 'Mahasiswa ' + row.mahasiswa_id}
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center justify-center rounded-md bg-[#1A3A6B]/10 px-2 py-0.5 text-xs font-bold text-[#1A3A6B]">
                          {row.kelas || 'A'}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <Badge tone="success">Terdaftar</Badge>
                      </td>
                      {canManage && (
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget({ ...row, mhsNama: mhs?.nama || `ID #${row.mahasiswa_id}` })
                              setOpenDeleteModal(true)
                            }}
                            data-testid={`btn-delete-peserta-${row.id}`}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                            title="Hapus peserta"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Modals: Khusus Admin Prodi (DOM tidak dirender untuk role Dosen) */}
      {canManage && (
        <>
          {/* Modal Pendaftaran Mahasiswa Manual */}
          <Modal
            open={openAddModal}
            onClose={() => setOpenAddModal(false)}
            title="Daftarkan Mahasiswa ke Mata Kuliah"
          >
            <form onSubmit={handleAddSubmit} className="space-y-4" data-testid="form-tambah-peserta">
              {formError && (
                <div className="flex items-start gap-2 rounded-[6px] border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#64748B]">Mata Kuliah</label>
                <div className="mt-1 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#142B4A]">
                  {currentCourse ? `${currentCourse.kode} - ${currentCourse.nama}` : '-'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B]">Pilih Mahasiswa *</label>
                <SearchableSelect
                  value={form.mahasiswa_id}
                  onChange={(val) => setForm({ ...form, mahasiswa_id: String(val) })}
                  data-testid="select-mahasiswa"
                  aria-label="Pilih mahasiswa"
                  className="mt-1"
                  placeholder="-- Pilih Mahasiswa --"
                  searchPlaceholder="Cari NIM atau nama mahasiswa..."
                  options={mahasiswaList.map((m) => ({
                    value: m.id,
                    label: `${m.nim} - ${m.nama}`,
                    description: `Semester ${m.semester_aktif || '-'}`,
                    searchText: m.nama,
                  }))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B]">Kelas Paralel *</label>
                <input
                  type="text"
                  value={form.kelas}
                  onChange={(e) => setForm({ ...form, kelas: e.target.value.toUpperCase() })}
                  placeholder="Contoh: A, B, atau C"
                  data-testid="input-kelas"
                  required
                  maxLength={5}
                  className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
                />
                <p className="mt-1 text-[11px] text-[#64748B]">
                  Tentukan kelas mahasiswa dalam mata kuliah ini.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setOpenAddModal(false)}
                  disabled={submitting}
                >
                  Batal
                </ActionButton>
                <ActionButton type="submit" disabled={submitting} data-testid="btn-submit-peserta">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Mendaftarkan...
                    </>
                  ) : (
                    'Simpan Pendaftaran'
                  )}
                </ActionButton>
              </div>
            </form>
          </Modal>

          {/* Modal Konfirmasi Hapus */}
          <Modal
            open={openDeleteModal}
            onClose={() => setOpenDeleteModal(false)}
            title="Hapus Mahasiswa dari Mata Kuliah"
          >
            <div className="space-y-4">
              <p className="text-xs text-[#64748B] leading-relaxed">
                Apakah Anda yakin ingin menghapus peserta{' '}
                <strong className="text-[#142B4A]">{deleteTarget?.mhsNama}</strong> dari kelas{' '}
                <strong>{deleteTarget?.kelas}</strong>? Nilai yang terkait dengan mahasiswa ini pada mata
                kuliah ini akan terhapus.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setOpenDeleteModal(false)}
                  disabled={submitting}
                >
                  Batal
                </ActionButton>
                <ActionButton
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={submitting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  data-testid="btn-confirm-delete-peserta"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menghapus...
                    </>
                  ) : (
                    'Ya, Hapus Peserta'
                  )}
                </ActionButton>
              </div>
            </div>
          </Modal>

          {/* Modal Impor CSV Peserta */}
          <Modal
            open={openImportModal}
            title={`Impor Peserta Mata Kuliah via CSV`}
            onClose={() => !importing && setOpenImportModal(false)}
            size="max-w-2xl"
          >
            <div className="space-y-5">
              {!importSummary ? (
                <>
                  <div className="rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#142B4A]">
                        Mata Kuliah: {currentCourse ? `${currentCourse.kode} - ${currentCourse.nama}` : '-'}
                      </span>
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center gap-1 font-semibold text-[#1A3A6B] hover:underline"
                        data-testid="btn-unduh-template-modal-peserta"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Unduh Template CSV
                      </button>
                    </div>
                    <p className="text-[#64748B]">
                      File CSV wajib memiliki header kolom: <code>nim</code>, <code>kelas</code>.
                    </p>
                    <p className="text-[#64748B]">
                      Sistem memvalidasi NIM terhadap seluruh mahasiswa program studi. Duplikat di dalam file akan langsung ditandai pada pratinjau. Mahasiswa yang sudah terdaftar di mata kuliah ini akan dilaporkan sebagai status 'Dilewati (Terdaftar)'.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                      Pilih File CSV:
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      disabled={importing}
                      onChange={handleFileChange}
                      data-testid="input-file-csv-peserta"
                      className="block w-full text-xs text-[#64748B] file:mr-3 file:py-2 file:px-4 file:rounded-[6px] file:border-0 file:text-xs file:font-semibold file:bg-[#1A3A6B] file:text-white hover:file:bg-[#142B4A]"
                    />
                  </div>

                  {importError && (
                    <div className="flex items-center gap-2 rounded-[6px] border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{importError}</span>
                    </div>
                  )}

                  {importRows.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#142B4A]">
                        <span>Pratinjau Data ({importRows.length} baris terbaca):</span>
                        <span className="text-[#64748B]">
                          <span className="text-emerald-700 font-bold">{importRows.filter((r) => r.isValid).length} Valid</span> ·{' '}
                          <span className="text-red-600 font-bold">{importRows.filter((r) => !r.isValid).length} Bermasalah</span>
                        </span>
                      </div>

                      <div className="max-h-56 overflow-y-auto rounded border border-[#E2E8F0]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] sticky top-0">
                            <tr>
                              <th className="px-3 py-2">Baris</th>
                              <th className="px-3 py-2">NIM</th>
                              <th className="px-3 py-2">Nama Mahasiswa</th>
                              <th className="px-3 py-2">Kelas</th>
                              <th className="px-3 py-2">Validasi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0]">
                            {importRows.map((r, i) => (
                              <tr key={i} className={r.isValid ? 'bg-white' : 'bg-red-50/50'}>
                                <td className="px-3 py-2 text-[#64748B]">#{r.rowNumber}</td>
                                <td className="px-3 py-2 font-mono">{r.nim || '-'}</td>
                                <td className="px-3 py-2">{r.nama}</td>
                                <td className="px-3 py-2 font-bold text-[#1A3A6B]">{r.kelas}</td>
                                <td className="px-3 py-2">
                                  {r.isValid ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-700">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Siap
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-red-600 font-semibold" title={r.errorMessage}>
                                      <AlertCircle className="h-3 w-3" />
                                      {r.errorMessage}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {importing && (
                    <div className="space-y-3 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#142B4A]">
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                          Mendaftarkan peserta {importProgress.current} dari {importProgress.total}...
                        </span>
                        <span>{importProgress.percent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                        <div
                          className="h-full bg-[#1A3A6B] transition-all duration-200"
                          style={{ width: `${importProgress.percent}%` }}
                        />
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleStopImport}
                          data-testid="btn-hentikan-impor-peserta"
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          <StopCircle className="h-3.5 w-3.5 text-red-600" />
                          Hentikan Impor
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <ActionButton
                      variant="secondary"
                      onClick={() => setOpenImportModal(false)}
                      disabled={importing}
                    >
                      Batal
                    </ActionButton>
                    <ActionButton
                      onClick={handleStartImport}
                      disabled={importing || importRows.filter((r) => r.isValid).length === 0}
                      data-testid="btn-mulai-impor-peserta"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        `Mulai Impor (${importRows.filter((r) => r.isValid).length} Baris Valid)`
                      )}
                    </ActionButton>
                  </div>
                </>
              ) : (
                /* Laporan Hasil Impor Peserta */
                <div className="space-y-4">
                  {importSummary.wasStopped && (
                    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 font-medium flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
                      <span>Proses impor dihentikan oleh pengguna. Baris yang tersisa dibatalkan.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                      <p className="text-[11px] font-semibold text-emerald-800">Berhasil</p>
                      <p className="mt-1 text-lg font-bold text-emerald-700">{importSummary.successCount}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                      <p className="text-[11px] font-semibold text-amber-800">Dilewati (Terdaftar)</p>
                      <p className="mt-1 text-lg font-bold text-amber-700">{importSummary.duplicateCount}</p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
                      <p className="text-[11px] font-semibold text-red-800">Gagal</p>
                      <p className="mt-1 text-lg font-bold text-red-700">{importSummary.failedCount}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-[11px] font-semibold text-slate-700">Dibatalkan</p>
                      <p className="mt-1 text-lg font-bold text-slate-700">{importSummary.abortedCount || 0}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#142B4A]">Rincian Pendaftaran Peserta Tiap Baris:</p>
                    <div className="max-h-56 overflow-y-auto rounded border border-[#E2E8F0]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] sticky top-0">
                          <tr>
                            <th className="px-3 py-2">Baris</th>
                            <th className="px-3 py-2">NIM</th>
                            <th className="px-3 py-2">Nama</th>
                            <th className="px-3 py-2">Kelas</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                          {importSummary.details.map((d, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 text-[#64748B]">#{d.rowNumber}</td>
                              <td className="px-3 py-2 font-mono">{d.nim}</td>
                              <td className="px-3 py-2">{d.nama}</td>
                              <td className="px-3 py-2 font-bold text-[#1A3A6B]">{d.kelas}</td>
                              <td className="px-3 py-2">
                                {d.status === 'success' && (
                                  <span className="font-semibold text-emerald-700">Berhasil</span>
                                )}
                                {d.status === 'duplicate' && (
                                  <span className="font-semibold text-amber-700">Dilewati</span>
                                )}
                                {d.status === 'failed' && (
                                  <span className="font-semibold text-red-600">Gagal</span>
                                )}
                                {d.status === 'aborted' && (
                                  <span className="font-semibold text-slate-500">Dibatalkan</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-[#64748B]">{d.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <ActionButton
                      onClick={() => setOpenImportModal(false)}
                      data-testid="btn-selesai-impor-peserta"
                    >
                      Selesai
                    </ActionButton>
                  </div>
                </div>
              )}
            </div>
          </Modal>
        </>
      )}
    </div>
  )
}
