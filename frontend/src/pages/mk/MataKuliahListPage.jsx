import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  UserCheck,
  UserPlus,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { PageHeader, SectionCard, Badge, ActionButton } from '../../components/PageChrome'
import { TableActionHeader, TableActionCell, TableActionButton } from '../../components/TableActions'
import Modal from '../../components/Modal'
import SearchableSelect from '../../components/SearchableSelect'
import ConfirmDialog from '../../components/ConfirmDialog'
import KurikulumVersionSelector from '../../components/KurikulumVersionSelector'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import useAuth from '../../hooks/useAuth'
import { getApiErrorMessage, getDeleteErrorMessage } from '../superAdminHelpers'

export default function MataKuliahListPage() {
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()
  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isAdminProdi = currentRole === 'admin_prodi'

  // Versions state
  const [versions, setVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [loadingVersions, setLoadingVersions] = useState(true)

  // MK data states
  const [mkList, setMkList] = useState([])
  const [loadingMk, setLoadingMk] = useState(false)
  const [errorMk, setErrorMk] = useState(null)

  // Active Dosen in this Prodi (from GET /users?role=dosen)
  const [dosenOptions, setDosenOptions] = useState([])
  const [loadingDosen, setLoadingDosen] = useState(false)

  // On-demand Pengampu Cache: Map(mata_kuliah_id -> list[PengampuMataKuliahResponse])
  const pengampuCacheRef = useRef(new Map())
  const [pengampuLoadedCount, setPengampuLoadedCount] = useState(0)
  const [loadingPengampuBatch, setLoadingPengampuBatch] = useState(false)

  // Table controls
  const [searchQuery, setSearchQuery] = useState('')
  const [semesterFilter, setSemesterFilter] = useState('ALL')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  // Main Modal: Add / Edit MK + Pengampu
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMk, setEditingMk] = useState(null) // null if add, MataKuliah if edit

  // Form MK fields
  const [formKode, setFormKode] = useState('')
  const [formNama, setFormNama] = useState('')
  const [formSks, setFormSks] = useState(3)
  const [formSemester, setFormSemester] = useState('Ganjil')
  const [formTahunAjaran, setFormTahunAjaran] = useState('2024/2025')

  // Form Pengampu List: array of { id (if existing), user_id, user_nama, is_koordinator, isNew, failedMessage }
  const [pengampuList, setPengampuList] = useState([])
  const [selectedDosenToAdd, setSelectedDosenToAdd] = useState('')
  const [isNewDosenKoordinator, setIsNewDosenKoordinator] = useState(false)

  // Save states & partial failure summary
  const [savingMk, setSavingMk] = useState(false)
  const [partialErrorSummary, setPartialErrorSummary] = useState(null) // string | null

  // Delete Pengampu confirmation
  const [pengampuToDelete, setPengampuToDelete] = useState(null)
  const [deletingPengampu, setDeletingPengampu] = useState(false)

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
      setErrorMk(getApiErrorMessage(err, 'Gagal memuat versi kurikulum'))
    } finally {
      setLoadingVersions(false)
    }
  }

  // 2. Fetch Active Dosen in Prodi
  const fetchDosenProdi = async () => {
    setLoadingDosen(true)
    try {
      const res = await api.get('/users', { params: { role: 'dosen' } })
      const allDosen = Array.isArray(res.data) ? res.data : []
      // Filter active lecturers
      const activeDosen = allDosen.filter((d) => d.is_active !== false)
      setDosenOptions(activeDosen)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal memuat daftar dosen prodi'), 'error')
    } finally {
      setLoadingDosen(false)
    }
  }

  // 3. Fetch MK List for Selected Version
  const fetchMkList = async (versionId) => {
    if (!versionId) {
      setMkList([])
      return
    }
    setLoadingMk(true)
    setErrorMk(null)
    try {
      const res = await api.get('/mata-kuliah', { params: { kurikulum_version_id: versionId } })
      const list = Array.isArray(res.data) ? res.data : []
      setMkList(list)
      // Trigger background batch load of pengampu for these courses
      loadPengampuBatch(list)
    } catch (err) {
      setErrorMk(getApiErrorMessage(err, 'Gagal memuat daftar mata kuliah'))
      setMkList([])
    } finally {
      setLoadingMk(false)
    }
  }

  // 4. Batch Pengampu Loader with max 5 concurrent requests + memory cache
  const loadPengampuBatch = async (courses) => {
    const cache = pengampuCacheRef.current
    const missingIds = courses.map((c) => c.id).filter((id) => !cache.has(id))
    if (missingIds.length === 0) return

    setLoadingPengampuBatch(true)
    const CONCURRENCY = 5
    let index = 0

    const worker = async () => {
      while (index < missingIds.length) {
        const mkId = missingIds[index++]
        try {
          const res = await api.get('/pengampu-mata-kuliah', { params: { mata_kuliah_id: mkId } })
          cache.set(mkId, Array.isArray(res.data) ? res.data : [])
        } catch {
          cache.set(mkId, [])
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, missingIds.length) },
      () => worker()
    )
    await Promise.all(workers)

    setLoadingPengampuBatch(false)
    setPengampuLoadedCount(cache.size)
  }

  useEffect(() => {
    fetchVersions()
    fetchDosenProdi()
  }, [])

  useEffect(() => {
    if (selectedVersionId) {
      pengampuCacheRef.current.clear()
      setPengampuLoadedCount(0)
      fetchMkList(selectedVersionId)
    }
  }, [selectedVersionId])

  // Map dosen for fast lookup by id
  const dosenMap = useMemo(() => {
    const map = new Map()
    for (const d of dosenOptions) map.set(d.id, d)
    return map
  }, [dosenOptions])

  // Filtered & Paginated MKs
  const filteredMks = useMemo(() => {
    return mkList.filter((mk) => {
      const matchSemester = semesterFilter === 'ALL' || mk.semester === semesterFilter
      const query = searchQuery.toLowerCase().trim()
      const matchQuery =
        !query ||
        (mk.kode || '').toLowerCase().includes(query) ||
        (mk.nama || '').toLowerCase().includes(query)
      return matchSemester && matchQuery
    })
  }, [mkList, semesterFilter, searchQuery])

  const totalPages = Math.ceil(filteredMks.length / pageSize) || 1
  const paginatedMks = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredMks.slice(start, start + pageSize)
  }, [filteredMks, currentPage, pageSize])

  // Format pengampu cell display: "Ketua: [Nama]; Anggota: [Nama 1], [Nama 2]"
  const formatPengampuDisplay = (mkId) => {
    const cache = pengampuCacheRef.current
    if (!cache.has(mkId)) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8]">
          <Loader2 className="h-3 w-3 animate-spin text-[#1A3A6B]" />
          <span>Memuat tim pengampu...</span>
        </span>
      )
    }

    const pengampus = cache.get(mkId) || []
    if (pengampus.length === 0) {
      return <span className="text-xs text-[#94A3B8] italic">Belum ada pengampu</span>
    }

    const ketua = pengampus.find((p) => p.is_koordinator)
    const anggotas = pengampus.filter((p) => !p.is_koordinator)

    return (
      <div className="space-y-1 text-xs">
        {ketua ? (
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px]">
              Ketua
            </span>
            <span className="font-medium text-[#142B4A]">{ketua.user_nama || `User #${ketua.user_id}`}</span>
          </div>
        ) : (
          <span className="text-amber-700 italic text-[11px] block">Belum ada Ketua</span>
        )}
        {anggotas.length > 0 && (
          <div className="flex items-start gap-1.5 text-[#64748B]">
            <span className="font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded text-[10px] shrink-0">
              Anggota
            </span>
            <span className="truncate max-w-xs">
              {anggotas.map((a) => a.user_nama || `User #${a.user_id}`).join(', ')}
            </span>
          </div>
        )}
      </div>
    )
  }

  // UI Pre-save Duplicate Check for Kode MK within this Version
  const duplicateKodeError = useMemo(() => {
    const trimmed = formKode.trim().toLowerCase()
    if (!trimmed) return null
    const existing = mkList.find(
      (mk) => (mk.kode || '').trim().toLowerCase() === trimmed && mk.id !== editingMk?.id
    )
    if (existing) {
      return `Kode mata kuliah "${existing.kode}" sudah terdaftar pada versi kurikulum ini.`
    }
    return null
  }, [formKode, mkList, editingMk])

  // --- OPEN MODAL TAMBAH MK ---
  const handleOpenAdd = () => {
    setEditingMk(null)
    setFormKode('')
    setFormNama('')
    setFormSks(3)
    setFormSemester('Ganjil')
    setFormTahunAjaran('2024/2025')
    setPengampuList([])
    setSelectedDosenToAdd('')
    setIsNewDosenKoordinator(false)
    setPartialErrorSummary(null)
    setIsModalOpen(true)
  }

  // --- OPEN MODAL EDIT MK ---
  const handleOpenEdit = async (mk) => {
    setEditingMk(mk)
    setFormKode(mk.kode || '')
    setFormNama(mk.nama || '')
    setFormSks(mk.sks || 3)
    setFormSemester(mk.semester || 'Ganjil')
    setFormTahunAjaran(mk.tahun_ajaran || '2024/2025')
    setSelectedDosenToAdd('')
    setIsNewDosenKoordinator(false)
    setPartialErrorSummary(null)

    // Load existing pengampu for this MK
    try {
      const res = await api.get('/pengampu-mata-kuliah', { params: { mata_kuliah_id: mk.id } })
      const existing = Array.isArray(res.data) ? res.data : []
      setPengampuList(
        existing.map((p) => ({
          id: p.id,
          user_id: p.user_id,
          user_nama: p.user_nama || dosenMap.get(p.user_id)?.nama || `Dosen #${p.user_id}`,
          is_koordinator: Boolean(p.is_koordinator),
          isNew: false,
          failedMessage: null,
        }))
      )
    } catch {
      setPengampuList([])
    }

    setIsModalOpen(true)
  }

  // Dosen options available to add (exclude lecturers already in pengampuList)
  const availableDosenToAdd = useMemo(() => {
    const chosenUserIds = new Set(pengampuList.map((p) => p.user_id))
    return dosenOptions.filter((d) => !chosenUserIds.has(d.id))
  }, [dosenOptions, pengampuList])

  // Add dosen to pengampu list in modal
  const handleAddDosenToTeam = () => {
    if (!selectedDosenToAdd) return
    const userId = Number(selectedDosenToAdd)
    const dosen = dosenMap.get(userId)
    if (!dosen) return

    // If marked as Ketua, demote any other existing Ketua to Anggota
    let updatedList = [...pengampuList]
    if (isNewDosenKoordinator) {
      updatedList = updatedList.map((p) => ({ ...p, is_koordinator: false }))
    } else if (updatedList.length === 0) {
      // If first lecturer added, make them Ketua by default
      setIsNewDosenKoordinator(true)
    }

    updatedList.push({
      id: null,
      user_id: userId,
      user_nama: dosen.nama,
      is_koordinator: isNewDosenKoordinator || updatedList.length === 0,
      isNew: true,
      failedMessage: null,
    })

    setPengampuList(updatedList)
    setSelectedDosenToAdd('')
    setIsNewDosenKoordinator(false)
  }

  // Set Ketua among pengampu list
  const handleSetKetua = (userId) => {
    setPengampuList((prev) =>
      prev.map((p) => ({
        ...p,
        is_koordinator: p.user_id === userId,
      }))
    )
  }

  // Remove pengampu from team
  const handleRemovePengampu = (pengampu) => {
    if (pengampu.isNew || !pengampu.id) {
      // Just local removal
      setPengampuList((prev) => prev.filter((p) => p.user_id !== pengampu.user_id))
      return
    }
    // Existing pengampu in backend: trigger confirmation modal
    setPengampuToDelete(pengampu)
  }

  // Confirm delete existing pengampu via DELETE /pengampu-mata-kuliah/{id}
  const handleConfirmDeletePengampu = async () => {
    if (!pengampuToDelete || !pengampuToDelete.id) return
    setDeletingPengampu(true)
    try {
      await api.delete(`/pengampu-mata-kuliah/${pengampuToDelete.id}`)
      pushToast(`Dosen ${pengampuToDelete.user_nama} dihapus dari tim pengampu`)
      setPengampuList((prev) => prev.filter((p) => p.id !== pengampuToDelete.id))
      pengampuCacheRef.current.delete(editingMk.id)
      setPengampuToDelete(null)
    } catch (err) {
      pushToast(getDeleteErrorMessage(err, 'Gagal menghapus dosen pengampu'), 'error')
      setPengampuToDelete(null)
    } finally {
      setDeletingPengampu(false)
    }
  }

  // --- SAVE MK & SYNC PENGAMPU (TWO-STEP WORKFLOW) ---
  const handleSaveModal = async (e) => {
    e.preventDefault()
    if (!selectedVersionId) {
      pushToast('Pilih versi kurikulum terlebih dahulu', 'error')
      return
    }
    if (duplicateKodeError) {
      return
    }

    setSavingMk(true)
    setPartialErrorSummary(null)

    let targetMkId = editingMk?.id

    // STEP 1: CREATE OR UPDATE MATA KULIAH
    try {
      if (editingMk) {
        // PUT /mata-kuliah/{id}
        await api.put(`/mata-kuliah/${editingMk.id}`, {
          kode: formKode.trim(),
          nama: formNama.trim(),
          sks: Number(formSks),
          semester: formSemester,
          tahun_ajaran: formTahunAjaran.trim(),
        })
      } else {
        // POST /mata-kuliah
        const res = await api.post('/mata-kuliah', {
          kurikulum_version_id: selectedVersionId,
          kode: formKode.trim(),
          nama: formNama.trim(),
          sks: Number(formSks),
          semester: formSemester,
          tahun_ajaran: formTahunAjaran.trim(),
        })
        targetMkId = res.data.id
      }
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan data mata kuliah'), 'error')
      setSavingMk(false)
      return
    }

    // STEP 2: SYNC PENGAMPU
    const failedPengampus = []

    // 2a. Assign new pengampus
    const newPengampus = pengampuList.filter((p) => p.isNew)
    for (const p of newPengampus) {
      try {
        const res = await api.post('/pengampu-mata-kuliah', {
          mata_kuliah_id: targetMkId,
          user_id: p.user_id,
          is_koordinator: p.is_koordinator,
        })
        p.id = res.data.id
        p.isNew = false
        p.failedMessage = null
      } catch (err) {
        const msg = getApiErrorMessage(err, 'Gagal menugaskan dosen')
        p.failedMessage = msg
        failedPengampus.push(`${p.user_nama}: ${msg}`)
      }
    }

    // 2b. If editing, check if is_koordinator changed on existing pengampus
    if (editingMk) {
      const existingPengampus = pengampuList.filter((p) => !p.isNew && p.id)
      for (const p of existingPengampus) {
        try {
          await api.put(`/pengampu-mata-kuliah/${p.id}`, {
            is_koordinator: p.is_koordinator,
          })
          p.failedMessage = null
        } catch (err) {
          const msg = getApiErrorMessage(err, 'Gagal memperbarui status peran')
          p.failedMessage = msg
          failedPengampus.push(`${p.user_nama} (Peran): ${msg}`)
        }
      }
    }

    // Invalidate pengampu cache for this MK
    if (targetMkId) {
      pengampuCacheRef.current.delete(targetMkId)
    }

    setSavingMk(false)

    // CHECK RESULT
    if (failedPengampus.length > 0) {
      // Partial failure: Keep modal open and display clear summary
      setPartialErrorSummary(
        `Mata kuliah tersimpan, namun pembaruan tim pengampu gagal sebagian: ${failedPengampus.join('; ')}`
      )
      pushToast(
        'Mata kuliah tersimpan. Sebagian perubahan tim pengampu gagal, data telah disegarkan dari server.',
        'warning'
      )
      // Segarkan state tabel dari server
      await fetchMkList(selectedVersionId)

      // Segarkan state pengampu di dalam modal dari server agar form mencerminkan kondisi riil di database
      try {
        const res = await api.get('/pengampu-mata-kuliah', { params: { mata_kuliah_id: targetMkId } })
        const serverPengampus = Array.isArray(res.data) ? res.data : []
        setPengampuList(
          serverPengampus.map((p) => ({
            id: p.id,
            user_id: p.user_id,
            user_nama: p.user_nama || dosenMap.get(p.user_id)?.nama || `Dosen #${p.user_id}`,
            is_koordinator: Boolean(p.is_koordinator),
            isNew: false,
            failedMessage: failedPengampus.some((f) => f.includes(p.user_nama)) ? 'Gagal disinkronkan' : null,
          }))
        )
      } catch {
        // preserve current list if get fails
      }
    } else {
      pushToast(
        editingMk
          ? `Mata kuliah ${formNama} dan tim pengampu berhasil diperbarui`
          : `Mata kuliah ${formNama} dan tim pengampu berhasil ditambahkan`
      )
      setIsModalOpen(false)
      await fetchMkList(selectedVersionId)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="MANAJEMEN MATA KULIAH KURIKULUM"
        title="Mata Kuliah & Tim Dosen Pengampu"
        description="Kelola daftar mata kuliah, alokasi SKS, semester berlaku, dan penetapan tim dosen pengampu (Ketua & Anggota)."
        badge={isAdminProdi ? 'Admin Prodi' : 'Mode Lihat'}
        actions={
          isAdminProdi ? (
            <ActionButton
              onClick={handleOpenAdd}
              data-testid="add-mk-button"
              className="bg-[#1A3A6B] text-white hover:bg-[#142B4A]"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Mata Kuliah</span>
            </ActionButton>
          ) : null
        }
      />

      {/* Selector Versi Kurikulum */}
      <KurikulumVersionSelector
        versions={versions}
        selectedVersionId={selectedVersionId}
        onSelectVersion={(id) => {
          setSelectedVersionId(id)
          setCurrentPage(1)
        }}
        onRefreshVersions={fetchVersions}
        canManage={isAdminProdi}
        loading={loadingVersions}
      />

      {errorMk && (
        <div className="flex items-center gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMk}</span>
        </div>
      )}

      {/* Tabel Mata Kuliah */}
      <SectionCard
        title="Daftar Mata Kuliah"
        description={`Menampilkan ${filteredMks.length} mata kuliah pada kurikulum terpilih.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Semester */}
            <select
              value={semesterFilter}
              onChange={(e) => {
                setSemesterFilter(e.target.value)
                setCurrentPage(1)
              }}
              data-testid="filter-semester-mk"
              className="h-8 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
            >
              <option value="ALL">Semua Semester</option>
              <option value="Ganjil">Semester Ganjil</option>
              <option value="Genap">Semester Genap</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
              <input
                type="search"
                placeholder="Cari kode atau nama MK..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                data-testid="search-mk-input"
                className="h-8 w-56 rounded-[6px] border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none"
              />
            </div>

            {/* Pilihan Jumlah Baris */}
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <span>Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="h-8 rounded-[6px] border border-[#CBD5E1] bg-white px-2 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs" data-testid="mk-table">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#6D778E]">
                <th className="py-3 px-4 w-28">Kode MK</th>
                <th className="py-3 px-4">Nama Mata Kuliah</th>
                <th className="py-3 px-4 text-center w-20">SKS</th>
                <th className="py-3 px-4 text-center w-24">Semester</th>
                <th className="py-3 px-4 text-center w-28">Tahun Ajaran</th>
                <th className="py-3 px-4 w-80">Tim Pengampu (Ketua &amp; Anggota)</th>
                <TableActionHeader />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loadingMk ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#64748B]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                      <span>Memuat data mata kuliah...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedMks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#94A3B8]" data-testid="mk-empty-state">
                    {searchQuery
                      ? 'Tidak ada mata kuliah yang cocok dengan pencarian.'
                      : 'Belum ada mata kuliah terdaftar pada versi kurikulum ini.'}
                  </td>
                </tr>
              ) : (
                paginatedMks.map((mk) => (
                  <tr
                    key={mk.id}
                    className="align-top transition-colors hover:bg-[#F8FAFC]"
                    data-testid={`mk-row-${mk.id}`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-[#1A3A6B]">{mk.kode}</td>
                    <td className="py-3 px-4 font-medium text-[#142B4A]">{mk.nama}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-[#142B4A]">
                      {mk.sks}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`rounded-[4px] px-2 py-0.5 text-[11px] font-semibold ${
                          mk.semester === 'Ganjil'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {mk.semester}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-[#64748B] font-mono text-[11px]">
                      {mk.tahun_ajaran || '-'}
                    </td>
                    <td className="py-3 px-4">{formatPengampuDisplay(mk.id)}</td>
                    <TableActionCell>
                      {isAdminProdi && (
                        <TableActionButton
                          variant="secondary"
                          onClick={() => handleOpenEdit(mk)}
                          data-testid={`edit-mk-button-${mk.id}`}
                          icon={Edit2}
                          label="Edit"
                          title="Edit Mata Kuliah"
                        />
                      )}
                    </TableActionCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4 mt-4 text-xs text-[#64748B]">
            <div>
              Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> ({filteredMks.length} data)
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-[4px] border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] disabled:opacity-40"
              >
                Sebelumnya
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`rounded-[4px] border px-2.5 py-1 text-xs font-semibold ${
                    currentPage === page
                      ? 'border-[#1A3A6B] bg-[#1A3A6B] text-white'
                      : 'border-[#CBD5E1] bg-white text-[#142B4A]'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-[4px] border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* MODAL TAMBAH / EDIT MK + PENGAMPU */}
      <Modal
        open={isModalOpen}
        title={editingMk ? `Edit Mata Kuliah — ${editingMk.kode}` : 'Tambah Mata Kuliah Baru'}
        onClose={() => !savingMk && setIsModalOpen(false)}
        size="max-w-2xl"
      >
        <form onSubmit={handleSaveModal} className="space-y-5">
          {/* Partial Error Alert if pengampu assignment failed */}
          {partialErrorSummary && (
            <div className="rounded-[6px] border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Perhatian:</span>
                <p className="leading-relaxed">{partialErrorSummary}</p>
                <p className="text-[11px] text-amber-800">
                  Periksa baris pengampu dengan tanda merah di bawah dan tekan Simpan kembali untuk mencoba lagi.
                </p>
              </div>
            </div>
          )}

          {/* Bagian 1: Data Mata Kuliah */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6D778E]">
              1. Identitas Mata Kuliah
            </h4>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                  Kode MK <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: TK2101"
                  value={formKode}
                  onChange={(e) => setFormKode(e.target.value)}
                  data-testid="input-mk-kode"
                  className={`w-full rounded-[6px] border px-3 py-1.5 text-xs font-mono font-bold focus:outline-none ${
                    duplicateKodeError
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-[#CBD5E1] focus:border-[#1A3A6B]'
                  }`}
                />
                {duplicateKodeError && (
                  <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1" data-testid="error-duplicate-kode-mk">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{duplicateKodeError}</span>
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                  Nama Mata Kuliah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Algoritma & Struktur Data"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  data-testid="input-mk-nama"
                  className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-1.5 text-xs focus:border-[#1A3A6B] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                  Beban SKS <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  required
                  value={formSks}
                  onChange={(e) => setFormSks(e.target.value)}
                  data-testid="input-mk-sks"
                  className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-1.5 text-xs font-mono focus:border-[#1A3A6B] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                  Semester Berlaku <span className="text-red-500">*</span>
                </label>
                <select
                  value={formSemester}
                  onChange={(e) => setFormSemester(e.target.value)}
                  data-testid="select-mk-semester"
                  className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-1.5 text-xs focus:border-[#1A3A6B] focus:outline-none"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                  Tahun Ajaran <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="2024/2025"
                  value={formTahunAjaran}
                  onChange={(e) => setFormTahunAjaran(e.target.value)}
                  data-testid="input-mk-tahun-ajaran"
                  className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-1.5 text-xs font-mono focus:border-[#1A3A6B] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Bagian 2: Tim Dosen Pengampu */}
          <div className="space-y-3 pt-3 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6D778E]">
                2. Tim Dosen Pengampu (Ketua &amp; Anggota)
              </h4>
              <span className="text-[11px] text-[#64748B]">
                Tandai satu dosen sebagai <strong>Ketua</strong>
              </span>
            </div>

            {/* Sub-form: Tambah Dosen ke List */}
            <div className="flex flex-col sm:flex-row items-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
              <div className="flex-1 w-full">
                <SearchableSelect
                  value={selectedDosenToAdd}
                  onChange={(val) => setSelectedDosenToAdd(String(val))}
                  data-testid="select-dosen-pengampu"
                  aria-label="Pilih dosen pengampu"
                  buttonClassName="px-2.5 py-1.5 text-xs"
                  placeholder="-- Pilih Dosen Aktif Prodi --"
                  searchPlaceholder="Cari nama atau NIP dosen..."
                  emptyText="Tidak ada dosen yang cocok"
                  options={availableDosenToAdd.map((d) => ({
                    value: d.id,
                    label: d.nama,
                    description: d.nip ? `NIP: ${d.nip}` : undefined,
                    searchText: d.nip || '',
                  }))}
                />
              </div>

              <label className="inline-flex items-center gap-1.5 text-xs text-[#142B4A] cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isNewDosenKoordinator}
                  onChange={(e) => setIsNewDosenKoordinator(e.target.checked)}
                  data-testid="checkbox-new-dosen-ketua"
                  className="rounded border-[#CBD5E1] text-[#1A3A6B] focus:ring-[#1A3A6B]"
                />
                <span className="font-semibold">Sebagai Ketua</span>
              </label>

              <button
                type="button"
                onClick={handleAddDosenToTeam}
                disabled={!selectedDosenToAdd}
                data-testid="add-dosen-to-team-button"
                className="inline-flex items-center gap-1 rounded-[4px] border border-[#1A3A6B] bg-[#1A3A6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-40 transition-colors shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Tambahkan</span>
              </button>
            </div>

            {/* List Dosen Pengampu yang Dipilih */}
            {pengampuList.length === 0 ? (
              <p className="text-xs text-[#94A3B8] italic p-3 text-center border border-dashed border-[#CBD5E1] rounded-[6px]">
                Belum ada dosen yang ditugaskan untuk mata kuliah ini.
              </p>
            ) : (
              <div className="space-y-1.5 border border-[#E2E8F0] rounded-[6px] divide-y divide-[#E2E8F0]">
                {pengampuList.map((p) => (
                  <div
                    key={p.user_id}
                    className={`flex items-center justify-between p-2.5 text-xs transition-colors ${
                      p.failedMessage ? 'bg-red-50' : p.is_koordinator ? 'bg-emerald-50/50' : 'bg-white'
                    }`}
                    data-testid={`pengampu-item-${p.user_id}`}
                  >
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="ketua-radio"
                          checked={p.is_koordinator}
                          onChange={() => handleSetKetua(p.user_id)}
                          data-testid={`radio-ketua-${p.user_id}`}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            p.is_koordinator
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {p.is_koordinator ? 'Ketua' : 'Anggota'}
                        </span>
                      </label>
                      <div>
                        <span className="font-semibold text-[#142B4A]">{p.user_nama}</span>
                        {p.isNew && (
                          <span className="ml-2 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                            Baru
                          </span>
                        )}
                        {p.failedMessage && (
                          <p className="text-[11px] text-red-600 mt-0.5 font-medium">
                            Gagal: {p.failedMessage}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemovePengampu(p)}
                      data-testid={`remove-pengampu-${p.user_id}`}
                      className="rounded p-1 text-[#64748B] hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Hapus dosen dari tim pengampu"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={savingMk}
              className="rounded-[6px] border border-[#CBD5E1] px-4 py-1.5 text-xs font-semibold text-[#142B4A]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingMk || Boolean(duplicateKodeError) || !formKode.trim() || !formNama.trim()}
              data-testid="submit-mk-modal"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {savingMk && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{editingMk ? 'Simpan Perubahan' : 'Simpan Mata Kuliah'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE PENGAMPU */}
      <ConfirmDialog
        open={Boolean(pengampuToDelete)}
        title="Hapus Dosen Pengampu"
        message={`Apakah Anda yakin ingin menghapus ${pengampuToDelete?.user_nama} dari tim pengampu mata kuliah ini?`}
        warning="Jika dosen ini telah dikaitkan dengan evaluasi atau laporan nilai berjalan, backend akan menolak penghapusan untuk menjaga integritas data."
        confirmLabel="Hapus Pengampu"
        confirmTestId="confirm-delete-pengampu"
        loading={deletingPengampu}
        onCancel={() => setPengampuToDelete(null)}
        onConfirm={handleConfirmDeletePengampu}
      />
    </div>
  )
}
