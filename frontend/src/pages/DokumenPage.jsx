import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Plus,
  RotateCcw,
  Send,
  FileText,
  Sparkles,
  Edit3,
  Loader2,
  AlertCircle,
  Eye,
  BookOpen,
  Printer,
  Download,
  Search,
  Filter,
} from 'lucide-react'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import Modal from '../components/Modal'
import RpsList from '../components/RpsList'
import useAuth from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import useDosenCourses from '../hooks/useDosenCourses'
import useToast from '../hooks/useToast'
import api from '../services/api'
import { getApiErrorMessage } from './superAdminHelpers'
import { exportToCsv } from '../utils/csvExport'
import { useDekanScope } from '../context/DekanScopeContext'

export default function DokumenPage() {
  const { user, activeRole } = useAuth()
  const { role } = useRole()
  const { pushToast } = useToast()
  const { courses, loading: coursesLoading } = useDosenCourses()
  const { prodiList } = useDekanScope()

  const currentRole = activeRole || role || user?.role || 'admin_prodi'
  const isDosen = currentRole === 'dosen'
  const isKaprodi = currentRole === 'kaprodi'
  const isDekan = currentRole === 'dekan'
  const canDecide = isKaprodi || isDekan

  const [selectedMkId, setSelectedMkId] = useState('')
  const [filterProdiId, setFilterProdiId] = useState('all') // Khusus Dekan: 'all' | prodi_id
  const [laporanList, setLaporanList] = useState([])
  const [allCourses, setAllCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'submitted' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('')

  // Modals for Dosen
  const [openCreateModal, setOpenCreateModal] = useState(false)
  const [openEditModal, setOpenEditModal] = useState(false)
  const [openAiModal, setOpenAiModal] = useState(false)
  const [activeLaporan, setActiveLaporan] = useState(null)
  const [createForm, setCreateForm] = useState({ semester: 'Ganjil' })
  const [editContent, setEditContent] = useState('')
  const [aiPrompt, setAiPrompt] = useState({ topik: '', tahun_ajaran: '2025/2026' })
  const [generatingAi, setGeneratingAi] = useState(false)
  const [rpsRefresh, setRpsRefresh] = useState(0)

  // Modals for Kaprodi / Validation
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailReport, setDetailReport] = useState(null)

  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [approveTargetReport, setApproveTargetReport] = useState(null)

  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectTargetReport, setRejectTargetReport] = useState(null)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [rejectError, setRejectError] = useState(null)

  // Fetch all courses for mapping mata_kuliah_id -> course code/name
  useEffect(() => {
    api.get('/mata-kuliah')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setAllCourses(res.data)
        }
      })
      .catch(() => {})
  }, [])

  const courseMap = useMemo(() => {
    const map = {}
    allCourses.forEach((c) => {
      map[c.id] = c
    })
    return map
  }, [allCourses])

  useEffect(() => {
    if (courses.length > 0 && !selectedMkId) {
      setSelectedMkId(courses[0].id)
    }
  }, [courses, selectedMkId])

  const currentCourse = useMemo(() => {
    return courses.find((c) => String(c.id) === String(selectedMkId)) || null
  }, [courses, selectedMkId])

  // Load Laporan
  const fetchLaporan = async () => {
    if (isDosen) {
      if (!selectedMkId) return
      setLoading(true)
      try {
        const res = await api.get(`/laporan/${selectedMkId}`)
        setLaporanList(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        console.warn('Gagal memuat laporan Dosen:', err)
        pushToast(getApiErrorMessage(err, 'Gagal memuat daftar laporan mata kuliah'), 'error')
        setLaporanList([])
      } finally {
        setLoading(false)
      }
    } else if (canDecide) {
      setLoading(true)
      try {
        // Backend GET /validasi/laporan allows optional query param ?status=...
        const res = await api.get('/validasi/laporan')
        setLaporanList(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        console.warn('Gagal memuat daftar validasi laporan:', err)
        pushToast(getApiErrorMessage(err, 'Gagal memuat daftar validasi laporan'), 'error')
        setLaporanList([])
      } finally {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchLaporan()
  }, [isDosen, canDecide, selectedMkId])

  // Create Laporan (Dosen)
  const handleCreateLaporan = async (e) => {
    e.preventDefault()
    if (!selectedMkId) return
    setSubmitting(true)
    try {
      await api.post(`/laporan/generate/${selectedMkId}`, {
        semester: createForm.semester,
      })
      pushToast('Draf laporan evaluasi berhasil dibuat')
      setOpenCreateModal(false)
      fetchLaporan()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal membuat draf laporan')
      pushToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Update Laporan (Dosen)
  const handleUpdateLaporan = async (e) => {
    e.preventDefault()
    if (!activeLaporan) return
    setSubmitting(true)
    try {
      await api.put(`/laporan/${activeLaporan.id}`, {
        konten: editContent,
      })
      pushToast('Konten laporan berhasil diperbarui')
      setOpenEditModal(false)
      fetchLaporan()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal mengupdate laporan')
      pushToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Laporan to Kaprodi (Dosen)
  const handleSubmitLaporan = async (laporanId) => {
    setSubmitting(true)
    try {
      await api.post(`/laporan/${laporanId}/submit`)
      pushToast('Laporan berhasil dikirim ke Kaprodi untuk validasi!')
      fetchLaporan()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal mengirim laporan')
      pushToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // AI Assist (RPS / Narasi) Safe Trigger (Dosen)
  const handleTriggerAiAssist = async () => {
    if (!selectedMkId) return
    setGeneratingAi(true)
    try {
      await api.post(`/rps/${selectedMkId}/generate`, {
        tahun_ajaran: aiPrompt.tahun_ajaran,
        semester: currentCourse?.semester || 'Ganjil',
        topik: aiPrompt.topik,
      })
      pushToast('Draf dokumen RPS berhasil digenerate oleh AI Service')
      setOpenAiModal(false)
      setRpsRefresh((n) => n + 1)
      fetchLaporan()
    } catch (err) {
      const msg = getApiErrorMessage(
        err,
        'Layanan AI Assist sedang tidak tersedia (offline). Anda dapat menyusun draf secara manual.'
      )
      pushToast(msg, 'error')
    } finally {
      setGeneratingAi(false)
    }
  }

  // Kaprodi Decision Handlers
  const handleOpenApproveModal = (report) => {
    setApproveTargetReport(report)
    setApproveModalOpen(true)
  }

  const handleConfirmApprove = async () => {
    if (!approveTargetReport) return
    setSubmitting(true)
    try {
      await api.post(`/validasi/laporan/${approveTargetReport.id}/approve`)
      pushToast('Laporan evaluasi mata kuliah berhasil disetujui')
      setApproveModalOpen(false)
      fetchLaporan()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyetujui laporan'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenRejectModal = (report) => {
    setRejectTargetReport(report)
    setRejectRemarks('')
    setRejectError(null)
    setRejectModalOpen(true)
  }

  const handleConfirmReject = async (e) => {
    e.preventDefault()
    if (!rejectTargetReport) return

    const trimmed = rejectRemarks.trim()
    if (!trimmed) {
      setRejectError('Catatan revisi wajib diisi agar dosen mengetahui bagian yang perlu diperbaiki.')
      return
    }

    setSubmitting(true)
    setRejectError(null)
    try {
      await api.post(`/validasi/laporan/${rejectTargetReport.id}/reject`, {
        remarks: trimmed,
      })
      pushToast('Laporan dikembalikan ke dosen dengan catatan revisi')
      setRejectModalOpen(false)
      fetchLaporan()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal mengembalikan laporan')
      setRejectError(msg)
      pushToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Filtered reports
  const filteredReports = useMemo(() => {
    return laporanList.filter((row) => {
      if (filterStatus !== 'all' && row.status !== filterStatus) {
        return false
      }
      if (isDekan && filterProdiId !== 'all') {
        const course = courseMap[row.mata_kuliah_id]
        if (!course || String(course.program_studi_id) !== String(filterProdiId)) {
          return false
        }
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const course = courseMap[row.mata_kuliah_id]
        const courseText = course ? `${course.kode} ${course.nama}`.toLowerCase() : ''
        const contentText = (row.konten || '').toLowerCase()
        const semesterText = (row.semester || '').toLowerCase()
        return courseText.includes(query) || contentText.includes(query) || semesterText.includes(query)
      }
      return true
    })
  }, [laporanList, filterStatus, searchQuery, courseMap, isDekan, filterProdiId])

  // Summary counts
  const countSubmitted = useMemo(
    () => laporanList.filter((r) => r.status === 'submitted').length,
    [laporanList]
  )
  const countApproved = useMemo(
    () => laporanList.filter((r) => r.status === 'approved').length,
    [laporanList]
  )
  const countRejected = useMemo(
    () => laporanList.filter((r) => r.status === 'rejected').length,
    [laporanList]
  )

  // Export CSV
  const handleExportCsv = () => {
    if (filteredReports.length === 0) {
      alert('Tidak ada data laporan untuk diekspor')
      return
    }
    const headers = [
      { key: 'id', label: 'ID Laporan' },
      { key: 'mata_kuliah_kode', label: 'Kode MK' },
      { key: 'mata_kuliah_nama', label: 'Nama MK' },
      { key: 'semester', label: 'Semester' },
      { key: 'version', label: 'Versi' },
      { key: 'status', label: 'Status' },
      { key: 'submitted_at', label: 'Tanggal Dikirim' },
      { key: 'remarks', label: 'Catatan Revisi' },
    ]
    const rows = filteredReports.map((r) => {
      const c = courseMap[r.mata_kuliah_id]
      return {
        ...r,
        mata_kuliah_kode: c?.kode || '-',
        mata_kuliah_nama: c?.nama || `Mata Kuliah #${r.mata_kuliah_id}`,
      }
    })
    exportToCsv(`Laporan_Evaluasi_${filterStatus}`, headers, rows)
  }

  const pageTitle = isDosen ? 'Laporan Saya' : 'Validasi Laporan Evaluasi'
  const description = isDosen
    ? 'Kelola dokumen evaluasi capaian pembelajaran mata kuliah Anda, generate dengan bantuan AI, dan kirimkan ke Kaprodi untuk validasi akreditasi.'
    : isDekan
    ? 'Pantau status dokumen laporan evaluasi pembelajaran mata kuliah dari seluruh program studi di fakultas Anda (Mode Lihat).'
    : 'Tinjau, setujui, atau kembalikan dokumen laporan evaluasi pembelajaran mata kuliah dari dosen di program studi Anda.'

  return (
    <div className="space-y-8 animate-[fadeUp_200ms_ease]">
      <PageHeader
        eyebrow="Dokumen Akademik & Akreditasi"
        title={pageTitle}
        description={description}
        badge={isDosen ? 'Mode Dosen' : isKaprodi ? 'Mode Validasi Kaprodi' : 'Mode Lihat'}
        actions={
          isDosen ? (
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                variant="secondary"
                onClick={() => setOpenAiModal(true)}
                disabled={!selectedMkId}
                data-testid="btn-ai-assist"
              >
                <Sparkles className="h-4 w-4 text-[#F4A300]" />
                AI Assist (RPS / Narasi)
              </ActionButton>
              <ActionButton
                onClick={() => setOpenCreateModal(true)}
                disabled={!selectedMkId}
                data-testid="report-create"
              >
                <Plus className="h-4 w-4" />
                Buat Laporan Baru
              </ActionButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton variant="secondary" onClick={() => window.print()} data-testid="validasi-print">
                <Printer className="h-4 w-4" />
                Print
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={handleExportCsv}
                disabled={filteredReports.length === 0}
                data-testid="validasi-export-csv"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </ActionButton>
            </div>
          )
        }
      />

      {/* Summary Cards untuk Kaprodi & Dekan */}
      {canDecide && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Menunggu Validasi"
            value={countSubmitted}
            caption={isDekan ? 'Perlu keputusan Kaprodi terkait' : 'Perlu keputusan Kaprodi'}
            icon={<FileText className="h-4 w-4" />}
            accent={countSubmitted > 0 ? 'text-[#F4A300]' : 'text-[#64748B]'}
          />
          <StatCard
            label="Disetujui (Approved)"
            value={countApproved}
            caption="Siap untuk akreditasi"
            icon={<CheckCircle2 className="h-4 w-4" />}
            accent="text-[#10B981]"
          />
          <StatCard
            label="Perlu Revisi (Rejected)"
            value={countRejected}
            caption="Dikembalikan ke dosen"
            icon={<RotateCcw className="h-4 w-4" />}
            accent={countRejected > 0 ? 'text-[#EF4444]' : 'text-[#64748B]'}
          />
        </div>
      )}

      {/* Dosen Course Selector */}
      {isDosen && (
        <SectionCard title="Mata Kuliah Yang Dipantau">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-full sm:w-80">
              <select
                value={selectedMkId}
                onChange={(e) => setSelectedMkId(e.target.value)}
                disabled={coursesLoading || courses.length === 0}
                className="h-10 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                data-testid="select-doc-course"
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
            {currentCourse && (
              <Badge tone="default">
                {currentCourse.kode} · {currentCourse.sks} SKS · Semester {currentCourse.semester}
              </Badge>
            )}
          </div>
        </SectionCard>
      )}

      {/* Draf RPS hasil AI Assist (khusus Dosen) */}
      {isDosen && selectedMkId && (
        <RpsList mataKuliahId={selectedMkId} refreshKey={rpsRefresh} />
      )}

      {/* Tabel Laporan Evaluasi */}
      <SectionCard
        title={isDosen ? 'Daftar Versi Laporan Evaluasi' : 'Daftar Laporan Evaluasi Masuk'}
        description={
          isDosen
            ? 'Dokumen evaluasi capaian pembelajaran mata kuliah per semester.'
            : isDekan
            ? 'Daftar seluruh laporan evaluasi pembelajaran mahasiswa di lingkungan fakultas Anda.'
            : 'Verifikasi kesesuaian konten evaluasi pembelajaran dan capaian OBE sebelum divalidasi final.'
        }
      >
        {/* Filter bar untuk Kaprodi & Dekan */}
        {canDecide && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: `Semua (${laporanList.length})` },
                { id: 'submitted', label: `Menunggu (${countSubmitted})` },
                { id: 'approved', label: `Disetujui (${countApproved})` },
                { id: 'rejected', label: `Revisi (${countRejected})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  data-testid={`filter-tab-${tab.id}`}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filterStatus === tab.id
                      ? 'bg-[#1A3A6B] text-white'
                      : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#142B4A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Prodi untuk Dekan */}
              {isDekan && prodiList.length > 0 && (
                <div className="w-52">
                  <select
                    value={filterProdiId}
                    onChange={(e) => setFilterProdiId(e.target.value)}
                    data-testid="filter-prodi-dekan"
                    className="h-8 w-full rounded-md border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none cursor-pointer"
                  >
                    <option value="all">Semua Program Studi</option>
                    {prodiList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama} ({p.kode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#64748B]" />
                <input
                  type="text"
                  placeholder="Cari mata kuliah atau konten..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-md border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                  data-testid="search-laporan"
                />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 py-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-[#F8FAFC]" />
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#64748B]">
            {filterStatus === 'submitted'
              ? 'Tidak ada laporan yang sedang menunggu validasi.'
              : 'Belum ada dokumen laporan evaluasi yang cocok dengan kriteria.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="table-laporan">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
                  {!isDosen && <th className="pb-3">Mata Kuliah</th>}
                  <th className="pb-3">Versi</th>
                  <th className="pb-3">Semester</th>
                  <th className="pb-3">Ringkasan Konten</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {filteredReports.map((row) => {
                  const course = courseMap[row.mata_kuliah_id]
                  const statusTone =
                    row.status === 'approved'
                      ? 'success'
                      : row.status === 'submitted'
                      ? 'warning'
                      : row.status === 'rejected'
                      ? 'danger'
                      : 'default'

                  const statusLabel =
                    row.status === 'approved'
                      ? 'Disetujui'
                      : row.status === 'submitted'
                      ? 'Menunggu Validasi'
                      : row.status === 'rejected'
                      ? 'Perlu Revisi'
                      : 'Draf'

                  return (
                    <tr key={row.id} className="hover:bg-[#F8FAFC]">
                      {!isDosen && (
                        <td className="py-3 font-semibold text-xs text-[#142B4A]">
                          {course ? (
                            <div>
                              <div className="font-bold text-[#1A3A6B]">{course.kode}</div>
                              <div className="text-[11px] text-[#64748B] line-clamp-1">{course.nama}</div>
                            </div>
                          ) : (
                            `MK #${row.mata_kuliah_id}`
                          )}
                        </td>
                      )}
                      <td className="py-3 font-semibold text-xs text-[#142B4A]">v{row.version || 1}</td>
                      <td className="py-3 text-xs text-[#64748B]">Semester {row.semester}</td>
                      <td className="py-3 text-xs text-[#142B4A]">
                        <p className="line-clamp-2 max-w-xs md:max-w-md">
                          {row.konten || '(Konten draf belum diisi)'}
                        </p>
                        {row.remarks && (
                          <p className="mt-1 text-[11px] font-semibold text-red-600 line-clamp-1">
                            Catatan Revisi: {row.remarks}
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <Badge tone={statusTone}>{statusLabel}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Lihat Detail */}
                          <button
                            type="button"
                            onClick={() => {
                              setDetailReport(row)
                              setDetailModalOpen(true)
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded border border-[#CBD5E1] bg-white px-2 text-[11px] font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                            data-testid={`btn-detail-laporan-${row.id}`}
                          >
                            <Eye className="h-3 w-3" />
                            Detail
                          </button>

                          {/* Dosen Actions */}
                          {isDosen && (row.status === 'draft' || row.status === 'rejected') && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveLaporan(row)
                                  setEditContent(row.konten || '')
                                  setOpenEditModal(true)
                                }}
                                className="inline-flex h-7 items-center gap-1 rounded border border-[#CBD5E1] bg-white px-2 text-[11px] font-semibold text-[#1A3A6B] hover:border-[#1A3A6B]"
                                data-testid={`btn-edit-laporan-${row.id}`}
                              >
                                <Edit3 className="h-3 w-3" />
                                Edit
                              </button>
                              <ActionButton
                                onClick={() => handleSubmitLaporan(row.id)}
                                disabled={submitting || !row.konten}
                                data-testid={`btn-submit-laporan-${row.id}`}
                                className="h-7 text-xs px-2.5"
                              >
                                <Send className="h-3 w-3" />
                                Kirim
                              </ActionButton>
                            </>
                          )}

                          {/* Kaprodi Actions: ONLY Kaprodi & only if submitted */}
                          {isKaprodi && row.status === 'submitted' && (
                            <>
                              <ActionButton
                                variant="secondary"
                                onClick={() => handleOpenApproveModal(row)}
                                className="h-7 text-xs px-2.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                data-testid={`btn-approve-${row.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Setujui
                              </ActionButton>
                              <ActionButton
                                variant="secondary"
                                onClick={() => handleOpenRejectModal(row)}
                                className="h-7 text-xs px-2.5 text-red-700 border-red-300 hover:bg-red-50"
                                data-testid={`btn-reject-${row.id}`}
                              >
                                <RotateCcw className="h-3 w-3" />
                                Kembalikan
                              </ActionButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ==================================================== */}
      {/* MODAL DETAIL LAPORAN                                 */}
      {/* ==================================================== */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Detail Dokumen Laporan Evaluasi Pembelajaran"
        size="max-w-2xl"
      >
        {detailReport && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs">
              <div>
                <span className="text-[#64748B]">Mata Kuliah:</span>
                <p className="font-bold text-[#142B4A]">
                  {courseMap[detailReport.mata_kuliah_id]
                    ? `${courseMap[detailReport.mata_kuliah_id].kode} - ${courseMap[detailReport.mata_kuliah_id].nama}`
                    : `MK #${detailReport.mata_kuliah_id}`}
                </p>
              </div>
              <div>
                <span className="text-[#64748B]">Semester & Versi:</span>
                <p className="font-bold text-[#142B4A]">
                  Semester {detailReport.semester} · Versi {detailReport.version}
                </p>
              </div>
              <div>
                <span className="text-[#64748B]">Status Dokumen:</span>
                <div className="mt-0.5">
                  <Badge
                    tone={
                      detailReport.status === 'approved'
                        ? 'success'
                        : detailReport.status === 'submitted'
                        ? 'warning'
                        : detailReport.status === 'rejected'
                        ? 'danger'
                        : 'default'
                    }
                  >
                    {detailReport.status}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-[#64748B]">Waktu Diajukan:</span>
                <p className="font-semibold text-[#142B4A]">
                  {detailReport.submitted_at
                    ? new Date(detailReport.submitted_at).toLocaleString('id-ID')
                    : '-'}
                </p>
              </div>
            </div>

            {detailReport.remarks && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <span className="font-bold">Catatan Revisi dari Kaprodi:</span>
                <p className="mt-1">{detailReport.remarks}</p>
              </div>
            )}

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Isi Dokumen Laporan
              </span>
              <div className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#CBD5E1] bg-white p-4 text-xs font-mono leading-relaxed text-[#142B4A]">
                {detailReport.konten || '(Konten belum diisi)'}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
              <ActionButton variant="secondary" onClick={() => setDetailModalOpen(false)}>
                Tutup
              </ActionButton>
              {isKaprodi && detailReport.status === 'submitted' && (
                <>
                  <ActionButton
                    variant="secondary"
                    onClick={() => {
                      setDetailModalOpen(false)
                      handleOpenRejectModal(detailReport)
                    }}
                    className="text-red-700 border-red-300 hover:bg-red-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Kembalikan
                  </ActionButton>
                  <ActionButton
                    onClick={() => {
                      setDetailModalOpen(false)
                      handleOpenApproveModal(detailReport)
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Setujui Laporan
                  </ActionButton>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ==================================================== */}
      {/* MODAL APPROVE (KAPRODI)                              */}
      {/* ==================================================== */}
      <Modal
        open={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        title="Konfirmasi Validasi Laporan"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#142B4A] leading-relaxed">
            Apakah Anda yakin ingin menyetujui laporan evaluasi pembelajaran untuk{' '}
            <span className="font-bold">
              {approveTargetReport && courseMap[approveTargetReport.mata_kuliah_id]
                ? courseMap[approveTargetReport.mata_kuliah_id].nama
                : 'mata kuliah ini'}
            </span>
            ? Laporan yang telah disetujui akan difinalisasi untuk keperluan akreditasi.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setApproveModalOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton
              onClick={handleConfirmApprove}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="btn-confirm-approve"
            >
              {submitting ? 'Memproses...' : 'Ya, Setujui Laporan'}
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL REJECT (KAPRODI)                               */}
      {/* ==================================================== */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Kembalikan Laporan untuk Revisi"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
          <p className="text-xs text-[#64748B]">
            Berikan catatan revisi yang jelas untuk dosen pengampu mengenai bagian yang perlu diperbaiki.
          </p>

          {rejectError && (
            <div className="flex items-center gap-2 rounded bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{rejectError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#142B4A]">
              Catatan Revisi <span className="text-red-500">* (Wajib Diisi)</span>
            </label>
            <textarea
              rows={4}
              value={rejectRemarks}
              onChange={(e) => {
                setRejectRemarks(e.target.value)
                if (rejectError) setRejectError(null)
              }}
              placeholder="Tuliskan catatan perbaikan secara spesifik..."
              className="mt-1 w-full rounded-md border border-[#CBD5E1] bg-white p-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              data-testid="textarea-reject-remarks"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setRejectModalOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton
              type="submit"
              disabled={submitting || !rejectRemarks.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-confirm-reject"
            >
              {submitting ? 'Mengirim...' : 'Kembalikan Laporan'}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* Modal Dosen: Buat Laporan Baru */}
      <Modal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        title="Buat Draf Laporan Evaluasi Baru"
      >
        <form onSubmit={handleCreateLaporan} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B]">Mata Kuliah</label>
            <div className="mt-1 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#142B4A]">
              {currentCourse ? `${currentCourse.kode} - ${currentCourse.nama}` : '-'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A]">Semester</label>
            <select
              value={createForm.semester}
              onChange={(e) => setCreateForm({ ...createForm, semester: e.target.value })}
              className="mt-1 h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
            >
              <option value="Ganjil">Semester Ganjil</option>
              <option value="Genap">Semester Genap</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setOpenCreateModal(false)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Buat Draf'}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* Modal Dosen: Edit Konten Laporan */}
      <Modal
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        title={`Edit Laporan v${activeLaporan?.version || 1}`}
        size="max-w-2xl"
      >
        <form onSubmit={handleUpdateLaporan} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#142B4A]">Konten Laporan Evaluasi</label>
            <textarea
              rows={8}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Tuliskan evaluasi pelaksanaan perkuliahan, kendala, dan rencana tindak lanjut..."
              className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white p-3 text-xs font-mono text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setOpenEditModal(false)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* Modal Dosen: AI Assist RPS / Narasi */}
      <Modal
        open={openAiModal}
        onClose={() => setOpenAiModal(false)}
        title="AI Assist - Generate Draf Dokumen RPS"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#64748B]">
            AI Service akan membantu menyusun draf capaian dan bahan kajian berdasarkan silabus mata kuliah.
          </p>

          <div className="rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
              Mata kuliah yang akan digenerate
            </p>
            <p className="mt-1 text-sm font-semibold text-[#142B4A]">
              {currentCourse ? `${currentCourse.kode} - ${currentCourse.nama}` : 'Belum ada mata kuliah dipilih'}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">
              Mata kuliah mengikuti pilihan pada bagian "Mata Kuliah Yang Dipantau". Untuk mata kuliah lain,
              tutup jendela ini dan ganti pilihannya dulu.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A]">Topik / Fokus Materi (opsional)</label>
            <input
              type="text"
              placeholder="Contoh: Penerapan NoSQL dan Cloud Native (opsional)"
              value={aiPrompt.topik}
              onChange={(e) => setAiPrompt({ ...aiPrompt, topik: e.target.value })}
              className="mt-1 h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setOpenAiModal(false)}>
              Batal
            </ActionButton>
            <ActionButton onClick={handleTriggerAiAssist} disabled={generatingAi}>
              {generatingAi ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate dengan AI'
              )}
            </ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}