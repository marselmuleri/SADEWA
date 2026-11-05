import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Users,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  GraduationCap,
  ShieldAlert,
  StopCircle,
} from 'lucide-react'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import Modal from '../components/Modal'
import useAuth from '../hooks/useAuth'
import useToast from '../hooks/useToast'
import api from '../services/api'
import { getApiErrorMessage } from './superAdminHelpers'
import { parseCsv, downloadCsvTemplate } from '../utils/csvParser'
import { fetchAllMahasiswa } from '../utils/mahasiswaApi'

const initialForm = {
  nim: '',
  nama: '',
  semester_aktif: 1,
  status_masuk: 'Reguler',
}

const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const MAX_CSV_ROWS = 500

export default function MahasiswaPage() {
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()

  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isAdminProdi = currentRole === 'admin_prodi'

  // Data States
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [semesterFilter, setSemesterFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Form Modal States
  const [openFormModal, setOpenFormModal] = useState(false)
  const [selectedMahasiswa, setSelectedMahasiswa] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Delete Modal States
  const [openDeleteModal, setOpenDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // CSV Import Modal States
  const [openImportModal, setOpenImportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importRows, setImportRows] = useState([])
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, percent: 0 })
  const [importSummary, setImportSummary] = useState(null)

  // Ref untuk menghentikan impor
  const stopImportRef = useRef(false)

  // Load Data Mahasiswa (mengambil seluruh data via pagination loop)
  const loadMahasiswa = async () => {
    setLoading(true)
    try {
      const data = await fetchAllMahasiswa()
      setList(data)
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal memuat data mahasiswa')
      pushToast(msg, 'error')
      // Fallback demo data jika offline/kosong
      setList([
        { id: 1, nim: '24060121120001', nama: 'Andi Santoso', semester_aktif: 3, status_masuk: 'Reguler', is_active: true },
        { id: 2, nim: '24060121120002', nama: 'Budi Kurniawan', semester_aktif: 3, status_masuk: 'Reguler', is_active: true },
        { id: 3, nim: '24060121120003', nama: 'Citra Kirana', semester_aktif: 5, status_masuk: 'Reguler', is_active: true },
        { id: 4, nim: '24060121120004', nama: 'Dewi Lestari', semester_aktif: 1, status_masuk: 'Transfer', is_active: true },
        { id: 5, nim: '24060121120005', nama: 'Eko Prasetyo', semester_aktif: 7, status_masuk: 'Reguler', is_active: true },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMahasiswa()
  }, [])

  // Filtered List
  const filteredList = useMemo(() => {
    return list.filter((m) => {
      const term = search.toLowerCase().trim()
      const matchesSearch = !term || m.nama.toLowerCase().includes(term) || m.nim.toLowerCase().includes(term)
      const matchesSemester = semesterFilter === 'ALL' || String(m.semester_aktif) === semesterFilter
      const matchesStatus = statusFilter === 'ALL' || m.status_masuk === statusFilter
      return matchesSearch && matchesSemester && matchesStatus
    })
  }, [list, search, semesterFilter, statusFilter])

  // Statistics
  const stats = useMemo(() => {
    const total = list.length
    const regulerCount = list.filter((m) => m.status_masuk === 'Reguler').length
    const transferCount = list.filter((m) => m.status_masuk === 'Transfer').length
    const avgSemester = total > 0 ? (list.reduce((acc, m) => acc + (Number(m.semester_aktif) || 0), 0) / total).toFixed(1) : '0'
    return { total, regulerCount, transferCount, avgSemester }
  }, [list])

  // Manual Add / Edit Handlers
  const handleOpenAdd = () => {
    setSelectedMahasiswa(null)
    setForm(initialForm)
    setFormError('')
    setOpenFormModal(true)
  }

  const handleOpenEdit = (item) => {
    setSelectedMahasiswa(item)
    setForm({
      nim: item.nim || '',
      nama: item.nama || '',
      semester_aktif: item.semester_aktif || 1,
      status_masuk: item.status_masuk || 'Reguler',
    })
    setFormError('')
    setOpenFormModal(true)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    const nimClean = form.nim.trim()
    const namaClean = form.nama.trim()
    const semesterNum = Number(form.semester_aktif)

    if (!nimClean) {
      setFormError('NIM wajib diisi')
      return
    }
    if (!namaClean) {
      setFormError('Nama lengkap wajib diisi')
      return
    }
    if (isNaN(semesterNum) || semesterNum < 1 || semesterNum > 14) {
      setFormError('Semester aktif harus angka antara 1 sampai 14')
      return
    }
    if (!['Reguler', 'Transfer'].includes(form.status_masuk)) {
      setFormError('Status masuk harus Reguler atau Transfer')
      return
    }

    setFormSubmitting(true)
    try {
      const payload = {
        nim: nimClean,
        nama: namaClean,
        semester_aktif: semesterNum,
        status_masuk: form.status_masuk,
      }

      if (selectedMahasiswa) {
        await api.put(`/mahasiswa/${selectedMahasiswa.id}`, payload)
        pushToast('Data mahasiswa berhasil diperbarui')
      } else {
        await api.post('/mahasiswa', payload)
        pushToast('Mahasiswa baru berhasil ditambahkan')
      }

      setOpenFormModal(false)
      loadMahasiswa()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal menyimpan data mahasiswa')
      setFormError(msg)
      pushToast(msg, 'error')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Delete Handlers
  const handleOpenDelete = (item) => {
    setDeleteTarget(item)
    setDeleteError('')
    setOpenDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteSubmitting(true)
    setDeleteError('')
    try {
      await api.delete(`/mahasiswa/${deleteTarget.id}`)
      pushToast('Data mahasiswa berhasil dinonaktifkan')
      setOpenDeleteModal(false)
      setDeleteTarget(null)
      loadMahasiswa()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal menonaktifkan data mahasiswa')
      setDeleteError(msg)
      pushToast(msg, 'error')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  // CSV Import Handlers
  const handleDownloadTemplate = () => {
    downloadCsvTemplate(
      'template_impor_mahasiswa.csv',
      [
        { label: 'nim', key: 'nim' },
        { label: 'nama', key: 'nama' },
        { label: 'semester_aktif', key: 'semester_aktif' },
        { label: 'status_masuk', key: 'status_masuk' },
      ],
      [
        { nim: '24060121120001', nama: 'Andi Santoso', semester_aktif: '3', status_masuk: 'Reguler' },
        { nim: '24060121120002', nama: 'Budi Kurniawan', semester_aktif: '3', status_masuk: 'Reguler' },
        { nim: '24060121120003', nama: 'Citra Kirana', semester_aktif: '1', status_masuk: 'Transfer' },
      ]
    )
    pushToast('Template CSV berhasil diunduh')
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
    reader.onload = async (event) => {
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

        // Ambil data mahasiswa terkini dari backend untuk deteksi duplikat NIM sistem
        let existingList = list
        try {
          existingList = await fetchAllMahasiswa()
        } catch {
          // fallback ke list state saat offline
        }
        const existingNims = new Set(existingList.map((m) => String(m.nim || '').trim()))

        // Validasi per baris di frontend SEBELUM kirim
        const seenNims = new Set()
        const validatedRows = rows.map((row, index) => {
          const rawNim = String(row.nim || '').trim()
          const rawNama = String(row.nama || '').trim()
          const rawSemester = String(row.semester_aktif || '').trim()
          const rawStatus = String(row.status_masuk || '').trim()

          const errors = []
          let isAlreadyExists = false

          if (!rawNim) {
            errors.push('NIM wajib diisi')
          } else if (seenNims.has(rawNim)) {
            errors.push('Duplikat NIM di dalam file')
          } else {
            seenNims.add(rawNim)
            if (existingNims.has(rawNim)) {
              isAlreadyExists = true
            }
          }

          if (!rawNama) {
            errors.push('Nama wajib diisi')
          }

          const semNumber = Number(rawSemester)
          if (!rawSemester || isNaN(semNumber) || !Number.isInteger(semNumber) || semNumber < 1 || semNumber > 14) {
            errors.push(`Semester aktif harus angka bulat 1-14 (terbaca: "${rawSemester || 'kosong'}")`)
          }

          let normalizedStatus = null
          const statusLower = rawStatus.toLowerCase()
          if (statusLower === 'reguler') {
            normalizedStatus = 'Reguler'
          } else if (statusLower === 'transfer') {
            normalizedStatus = 'Transfer'
          } else {
            errors.push(`Status masuk tidak valid: "${rawStatus || 'kosong'}". Hanya menerima 'Reguler' atau 'Transfer'`)
          }

          const hasFormatError = errors.length > 0

          return {
            rowNumber: index + 2, // Header adalah baris 1
            nim: rawNim,
            nama: rawNama,
            semester_aktif: semNumber || 1,
            status_masuk: normalizedStatus || rawStatus || 'Reguler',
            isValid: !hasFormatError && !isAlreadyExists,
            isAlreadyExists,
            hasFormatError,
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
    pushToast('Menghentikan pengiriman baris berikutnya...', 'warning')
  }

  const handleStartImport = async () => {
    // Hanya baris yang valid dan BELUM ada di sistem yang akan dikirim
    const toSendRows = importRows.filter((r) => r.isValid && !r.isAlreadyExists)
    const alreadyExistsRows = importRows.filter((r) => r.isAlreadyExists)

    if (toSendRows.length === 0 && alreadyExistsRows.length === 0) {
      setImportError('Tidak ada baris yang valid untuk diproses. Perbaiki format CSV sesuai panduan.')
      return
    }

    if (toSendRows.length === 0 && alreadyExistsRows.length > 0) {
      // Seluruh baris yang valid ternyata sudah ada di sistem, tidak perlu kirim ke backend
      setImportSummary({
        totalProcessed: alreadyExistsRows.length,
        successCount: 0,
        duplicateCount: alreadyExistsRows.length,
        failedCount: 0,
        abortedCount: 0,
        wasStopped: false,
        details: alreadyExistsRows.map((r) => ({
          rowNumber: r.rowNumber,
          nim: r.nim,
          nama: r.nama,
          status: 'duplicate',
          message: 'Sudah ada di sistem (dilewati sebelum kirim)',
        })),
      })
      return
    }

    setImporting(true)
    setImportError('')
    stopImportRef.current = false

    const results = []
    let successCount = 0
    let duplicateCount = alreadyExistsRows.length
    let failedCount = 0
    let abortedCount = 0

    // Catat baris yang sudah ada di sistem ke dalam rekapitulasi akhir
    alreadyExistsRows.forEach((r) => {
      results.push({
        rowNumber: r.rowNumber,
        nim: r.nim,
        nama: r.nama,
        status: 'duplicate',
        message: 'Sudah ada di sistem (dilewati sebelum kirim)',
      })
    })

    const total = toSendRows.length
    for (let i = 0; i < total; i++) {
      if (stopImportRef.current) {
        // Hentikan pengiriman baris berikutnya
        for (let j = i; j < total; j++) {
          abortedCount++
          results.push({
            rowNumber: toSendRows[j].rowNumber,
            nim: toSendRows[j].nim,
            nama: toSendRows[j].nama,
            status: 'aborted',
            message: 'Dibatalkan oleh pengguna (impor dihentikan)',
          })
        }
        break
      }

      const row = toSendRows[i]
      setImportProgress({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
      })

      try {
        await api.post('/mahasiswa', {
          nim: row.nim,
          nama: row.nama,
          semester_aktif: row.semester_aktif,
          status_masuk: row.status_masuk,
        })
        successCount++
        results.push({
          rowNumber: row.rowNumber,
          nim: row.nim,
          nama: row.nama,
          status: 'success',
          message: 'Berhasil ditambahkan',
        })
      } catch (err) {
        const statusCode = err?.response?.status
        const errorDetail = err?.response?.data?.detail

        if (statusCode && statusCode >= 500) {
          failedCount++
          results.push({
            rowNumber: row.rowNumber,
            nim: row.nim,
            nama: row.nama,
            status: 'failed',
            message: 'Server error, kemungkinan NIM sudah terpakai',
          })
        } else {
          const isDuplicate =
            statusCode === 400 &&
            (typeof errorDetail === 'string' &&
              (errorDetail.toLowerCase().includes('sudah') ||
                errorDetail.toLowerCase().includes('terdaftar') ||
                errorDetail.toLowerCase().includes('duplikat') ||
                errorDetail.toLowerCase().includes('duplicate') ||
                errorDetail.toLowerCase().includes('exists')))

          if (isDuplicate) {
            duplicateCount++
            results.push({
              rowNumber: row.rowNumber,
              nim: row.nim,
              nama: row.nama,
              status: 'duplicate',
              message: 'Sudah terdaftar sebelumnya (dilewati)',
            })
          } else {
            failedCount++
            const reason = getApiErrorMessage(err, 'Gagal diproses oleh server')
            results.push({
              rowNumber: row.rowNumber,
              nim: row.nim,
              nama: row.nama,
              status: 'failed',
              message: reason,
            })
          }
        }
      }
    }

    setImportSummary({
      totalProcessed: total + alreadyExistsRows.length,
      successCount,
      duplicateCount,
      failedCount,
      abortedCount,
      wasStopped: stopImportRef.current,
      details: results.sort((a, b) => a.rowNumber - b.rowNumber),
    })
    setImporting(false)
    loadMahasiswa()
  }

  // Guard RBAC: Halaman ini eksklusif untuk Admin Prodi
  if (!isAdminProdi) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-8 animate-[fadeUp_200ms_ease]">
      <PageHeader
        eyebrow="Data Akademik & Kemahasiswaan"
        title="Data Mahasiswa"
        description="Kelola data induk mahasiswa program studi, pendaftaran baru, pembaruan status, serta impor data massal via CSV."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              variant="secondary"
              onClick={handleDownloadTemplate}
              data-testid="btn-unduh-template-mahasiswa"
            >
              <Download className="h-4 w-4" />
              Unduh Template CSV
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={handleOpenImport}
              data-testid="btn-impor-mahasiswa"
            >
              <Upload className="h-4 w-4" />
              Impor CSV
            </ActionButton>
            <ActionButton
              onClick={handleOpenAdd}
              data-testid="btn-tambah-mahasiswa"
            >
              <Plus className="h-4 w-4" />
              Tambah Mahasiswa
            </ActionButton>
          </div>
        }
      />

      {/* Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Mahasiswa"
          value={loading ? '...' : stats.total}
          caption="Mahasiswa terdaftar di program studi"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Jalur Reguler"
          value={loading ? '...' : stats.regulerCount}
          caption="Mahasiswa reguler aktif"
          icon={<GraduationCap className="h-5 w-5" />}
        />
        <StatCard
          label="Jalur Transfer"
          value={loading ? '...' : stats.transferCount}
          caption="Mahasiswa pindahan/transfer"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Rata-rata Semester"
          value={loading ? '...' : stats.avgSemester}
          caption="Tingkat semester aktif rata-rata"
          icon={<GraduationCap className="h-5 w-5" />}
        />
      </div>

      {/* Main Table Section */}
      <SectionCard
        title="Daftar Mahasiswa"
        description={`Menampilkan ${filteredList.length} dari total ${list.length} mahasiswa`}
      >
        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="Cari berdasarkan NIM atau nama..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-mahasiswa"
              className="w-full rounded-[6px] border border-[#CBD5E1] bg-white pl-9 pr-4 py-2 text-sm text-[#142B4A] placeholder-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              data-testid="select-filter-semester"
              className="rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-medium text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            >
              <option value="ALL">Semua Semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((s) => (
                <option key={s} value={String(s)}>Semester {s}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="select-filter-status"
              className="rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-medium text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            >
              <option value="ALL">Semua Status Masuk</option>
              <option value="Reguler">Reguler</option>
              <option value="Transfer">Transfer</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded bg-[#F8FAFC]" />
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#CBD5E1] p-10 text-center">
            <Users className="mx-auto h-10 w-10 text-[#94A3B8]" />
            <p className="mt-3 text-sm font-semibold text-[#142B4A]">Tidak Ada Data Mahasiswa</p>
            <p className="mt-1 text-xs text-[#64748B]">
              {search || semesterFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'Tidak ditemukan data yang sesuai dengan filter pencarian.'
                : 'Belum ada data mahasiswa di program studi ini. Silakan tambahkan mahasiswa atau gunakan fitur impor CSV.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
            <table className="w-full text-left text-sm" data-testid="table-mahasiswa">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">NIM</th>
                  <th className="px-4 py-3">Nama Lengkap</th>
                  <th className="px-4 py-3">Semester</th>
                  <th className="px-4 py-3">Jalur Masuk</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredList.map((item, idx) => (
                  <tr key={item.id} className="transition-colors hover:bg-[#F8FAFC]/80">
                    <td className="px-4 py-3 text-xs text-[#64748B]">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono font-medium text-[#142B4A]">{item.nim}</td>
                    <td className="px-4 py-3 font-semibold text-[#142B4A]">{item.nama}</td>
                    <td className="px-4 py-3 text-[#142B4A]">Semester {item.semester_aktif}</td>
                    <td className="px-4 py-3">
                      <Badge tone={item.status_masuk === 'Transfer' ? 'warning' : 'default'}>
                        {item.status_masuk}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Aktif
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold text-[#1A3A6B] hover:bg-[#F2F4F7]"
                          data-testid={`btn-edit-mahasiswa-${item.id}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleOpenDelete(item)}
                          className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          data-testid={`btn-hapus-mahasiswa-${item.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Modal Tambah / Edit Mahasiswa */}
      <Modal
        open={openFormModal}
        title={selectedMahasiswa ? 'Edit Data Mahasiswa' : 'Tambah Mahasiswa Baru'}
        onClose={() => !formSubmitting && setOpenFormModal(false)}
        size="max-w-lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4" data-testid="form-mahasiswa">
          {formError && (
            <div className="flex items-center gap-2 rounded-[6px] border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#142B4A]">
              Nomor Induk Mahasiswa (NIM) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.nim}
              onChange={(e) => setForm({ ...form, nim: e.target.value })}
              placeholder="Contoh: 24060121120001"
              data-testid="input-form-nim"
              className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A]">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="Contoh: Budi Prasetyo"
              data-testid="input-form-nama"
              className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#142B4A]">
                Semester Aktif <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="14"
                required
                value={form.semester_aktif}
                onChange={(e) => setForm({ ...form, semester_aktif: e.target.value })}
                data-testid="input-form-semester"
                className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#142B4A]">
                Jalur Masuk <span className="text-red-500">*</span>
              </label>
              <select
                value={form.status_masuk}
                onChange={(e) => setForm({ ...form, status_masuk: e.target.value })}
                data-testid="select-form-status-masuk"
                className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
              >
                <option value="Reguler">Reguler</option>
                <option value="Transfer">Transfer</option>
              </select>
            </div>
          </div>

          <div className="rounded border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#64748B]">
            Data mahasiswa akan otomatis terikat ke Program Studi akun Anda sesuai wewenang Admin Prodi.
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <ActionButton
              variant="secondary"
              onClick={() => setOpenFormModal(false)}
              disabled={formSubmitting}
            >
              Batal
            </ActionButton>
            <ActionButton
              type="submit"
              disabled={formSubmitting}
              data-testid="btn-submit-mahasiswa"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : selectedMahasiswa ? (
                'Perbarui'
              ) : (
                'Simpan'
              )}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* Modal Hapus Konfirmasi (Soft-Delete) */}
      <Modal
        open={openDeleteModal}
        title="Nonaktifkan Mahasiswa"
        onClose={() => !deleteSubmitting && setOpenDeleteModal(false)}
        size="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-50 p-2 text-red-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#142B4A]">
                Konfirmasi Penonaktifan Mahasiswa
              </p>
              <p className="mt-1 text-xs text-[#64748B] leading-relaxed">
                Mahasiswa <strong>{deleteTarget?.nama}</strong> (NIM: {deleteTarget?.nim}) akan dinonaktifkan (<em>soft-delete</em>).
              </p>
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900 leading-normal">
                <strong>Catatan Integritas Data:</strong> Mahasiswa ini tidak akan lagi muncul pada daftar aktif. Namun data historis peserta mata kuliah dan nilai yang telah dicatat tetap tersimpan di database untuk menjaga validitas evaluasi OBE.
              </div>
            </div>
          </div>

          {deleteError && (
            <div className="flex items-center gap-2 rounded-[6px] border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <ActionButton
              variant="secondary"
              onClick={() => setOpenDeleteModal(false)}
              disabled={deleteSubmitting}
            >
              Batal
            </ActionButton>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleteSubmitting}
              data-testid="btn-confirm-hapus-mahasiswa"
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Ya, Nonaktifkan'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Impor CSV */}
      <Modal
        open={openImportModal}
        title="Impor Data Mahasiswa via CSV"
        onClose={() => !importing && setOpenImportModal(false)}
        size="max-w-2xl"
      >
        <div className="space-y-5">
          {!importSummary ? (
            <>
              {/* Petunjuk & Download Template */}
              <div className="rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#142B4A]">Panduan Format File:</span>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1 font-semibold text-[#1A3A6B] hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Unduh Template CSV
                  </button>
                </div>
                <p className="text-[#64748B]">
                  File CSV wajib memiliki header kolom: <code>nim</code>, <code>nama</code>, <code>semester_aktif</code>, <code>status_masuk</code> (Reguler/Transfer).
                </p>
                <p className="text-[#64748B]">
                  Contoh valid: <code>24060121120001,Andi Santoso,3,Reguler</code>. Nilai enum status masuk yang salah akan langsung ditandai pada pratinjau sebelum pengiriman.
                </p>
                <p className="text-[#64748B]">
                  Batas maksimum: 500 baris per file, ukuran file maksimal 2 MB. Duplikat NIM di dalam file akan dideteksi sebelum proses unggah.
                </p>
              </div>

              {/* Upload Input */}
              <div>
                <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                  Pilih File CSV:
                </label>
                <input
                  type="file"
                  accept=".csv"
                  disabled={importing}
                  onChange={handleFileChange}
                  data-testid="input-file-csv-mahasiswa"
                  className="block w-full text-xs text-[#64748B] file:mr-3 file:py-2 file:px-4 file:rounded-[6px] file:border-0 file:text-xs file:font-semibold file:bg-[#1A3A6B] file:text-white hover:file:bg-[#142B4A]"
                />
              </div>

              {importError && (
                <div className="flex items-center gap-2 rounded-[6px] border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Pratinjau Baris Data */}
              {importRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#142B4A]">
                    <span>Pratinjau Data ({importRows.length} baris terbaca):</span>
                    <span className="text-[#64748B]">
                      <span className="text-emerald-700 font-bold">
                        {importRows.filter((r) => r.isValid && !r.isAlreadyExists).length} Baru
                      </span> ·{' '}
                      <span className="text-amber-700 font-bold">
                        {importRows.filter((r) => r.isAlreadyExists).length} Sudah Ada
                      </span> ·{' '}
                      <span className="text-red-600 font-bold">
                        {importRows.filter((r) => r.hasFormatError).length} Format Bermasalah
                      </span>
                    </span>
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded border border-[#E2E8F0]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Baris</th>
                          <th className="px-3 py-2">NIM</th>
                          <th className="px-3 py-2">Nama</th>
                          <th className="px-3 py-2">Semester</th>
                          <th className="px-3 py-2">Status Masuk</th>
                          <th className="px-3 py-2">Validasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {importRows.map((r, i) => (
                          <tr
                            key={i}
                            className={
                              r.hasFormatError
                                ? 'bg-red-50/50'
                                : r.isAlreadyExists
                                ? 'bg-amber-50/40'
                                : 'bg-white'
                            }
                          >
                            <td className="px-3 py-2 text-[#64748B]">#{r.rowNumber}</td>
                            <td className="px-3 py-2 font-mono">{r.nim || '-'}</td>
                            <td className="px-3 py-2">{r.nama || '-'}</td>
                            <td className="px-3 py-2">Sem. {r.semester_aktif}</td>
                            <td className="px-3 py-2">{r.status_masuk}</td>
                            <td className="px-3 py-2">
                              {r.hasFormatError ? (
                                <span className="inline-flex items-center gap-1 text-red-600 font-semibold" title={r.errorMessage}>
                                  <AlertCircle className="h-3 w-3" />
                                  {r.errorMessage}
                                </span>
                              ) : r.isAlreadyExists ? (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  <AlertCircle className="h-3 w-3" />
                                  Sudah ada (dilewati)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-700">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Siap Impor
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

              {/* Progress Bar & Tombol Hentikan Impor saat Mengirim */}
              {importing && (
                <div className="space-y-3 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#142B4A]">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                      Mengirim baris {importProgress.current} dari {importProgress.total}...
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
                      data-testid="btn-hentikan-impor-mahasiswa"
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
                  disabled={
                    importing ||
                    (importRows.filter((r) => r.isValid && !r.isAlreadyExists).length === 0 &&
                      importRows.filter((r) => r.isAlreadyExists).length === 0)
                  }
                  data-testid="btn-mulai-impor-mahasiswa"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : importRows.filter((r) => r.isValid && !r.isAlreadyExists).length > 0 ? (
                    `Mulai Impor (${importRows.filter((r) => r.isValid && !r.isAlreadyExists).length} Baris Baru)`
                  ) : (
                    `Simpan Rekap (${importRows.filter((r) => r.isAlreadyExists).length} Sudah Ada)`
                  )}
                </ActionButton>
              </div>
            </>
          ) : (
            /* Laporan Hasil Impor */
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
                <p className="text-xs font-semibold text-[#142B4A]">Rincian Status Tiap Baris:</p>
                <div className="max-h-56 overflow-y-auto rounded border border-[#E2E8F0]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Baris</th>
                        <th className="px-3 py-2">NIM</th>
                        <th className="px-3 py-2">Nama</th>
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
                  data-testid="btn-selesai-impor-mahasiswa"
                >
                  Selesai
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
