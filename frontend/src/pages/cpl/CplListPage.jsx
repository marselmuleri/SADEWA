import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ListOrdered,
  Network,
  Sliders,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { PageHeader, SectionCard, Badge, ActionButton } from '../../components/PageChrome'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import KurikulumVersionSelector from '../../components/KurikulumVersionSelector'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import useAuth from '../../hooks/useAuth'
import { getApiErrorMessage, getDeleteErrorMessage } from '../superAdminHelpers'

export default function CplListPage() {
  const navigate = useNavigate()
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()
  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isAdminProdi = currentRole === 'admin_prodi'

  // Versions state
  const [versions, setVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [loadingVersions, setLoadingVersions] = useState(true)

  // CPL & IK data states
  const [cplList, setCplList] = useState([])
  const [ikList, setIkList] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [errorData, setErrorData] = useState(null)

  // Table controls
  const [searchQuery, setSearchQuery] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingCpl, setEditingCpl] = useState(null)

  // Form states
  const [formKode, setFormKode] = useState('')
  const [formDeskripsi, setFormDeskripsi] = useState('')
  const [formThreshold, setFormThreshold] = useState(70.0)
  const [submitting, setSubmitting] = useState(false)

  // Confirm delete state
  const [cplToDelete, setCplToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // 1. Fetch versions
  const fetchVersions = async (selectId = null) => {
    setLoadingVersions(true)
    try {
      const res = await api.get('/kurikulum/versions')
      const list = Array.isArray(res.data) ? res.data : []
      setVersions(list)
      if (selectId && list.some((v) => v.id === selectId)) {
        setSelectedVersionId(selectId)
      } else if (list.length > 0 && (!selectedVersionId || !list.some((v) => v.id === selectedVersionId))) {
        setSelectedVersionId(list[0].id)
      }
    } catch (err) {
      setErrorData(getApiErrorMessage(err, 'Gagal memuat versi kurikulum'))
    } finally {
      setLoadingVersions(false)
    }
  }

  // 2. Fetch CPL & IK for selected version
  const fetchCplData = async (versionId) => {
    if (!versionId) {
      setCplList([])
      setIkList([])
      return
    }
    setLoadingData(true)
    setErrorData(null)
    try {
      const [cplRes, ikRes] = await Promise.all([
        api.get('/cpl', { params: { kurikulum_version_id: versionId } }),
        api.get('/ik'),
      ])
      const fetchedCpls = Array.isArray(cplRes.data) ? cplRes.data : []
      const fetchedIks = Array.isArray(ikRes.data) ? ikRes.data : []
      setCplList(fetchedCpls)
      setIkList(fetchedIks)
    } catch (err) {
      setErrorData(getApiErrorMessage(err, 'Gagal memuat daftar CPL'))
      setCplList([])
      setIkList([])
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchVersions()
  }, [])

  useEffect(() => {
    if (selectedVersionId) {
      fetchCplData(selectedVersionId)
    }
  }, [selectedVersionId])

  // Count IK per CPL
  const ikCountMap = useMemo(() => {
    const map = {}
    for (const ik of ikList) {
      map[ik.cpl_id] = (map[ik.cpl_id] || 0) + 1
    }
    return map
  }, [ikList])

  // Filtered & Paginated CPL
  const filteredCpls = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return cplList
    return cplList.filter(
      (c) =>
        (c.kode || '').toLowerCase().includes(query) ||
        (c.deskripsi || '').toLowerCase().includes(query)
    )
  }, [cplList, searchQuery])

  const totalPages = Math.ceil(filteredCpls.length / pageSize) || 1
  const paginatedCpls = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredCpls.slice(start, start + pageSize)
  }, [filteredCpls, currentPage, pageSize])

  // --- ADD CPL ---
  const handleOpenAdd = () => {
    setFormKode('')
    setFormDeskripsi('')
    setFormThreshold(70.0)
    setIsAddModalOpen(true)
  }

  const handleSaveAdd = async (e) => {
    e.preventDefault()
    if (!selectedVersionId) {
      pushToast('Pilih versi kurikulum terlebih dahulu', 'error')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        kurikulum_version_id: selectedVersionId,
        kode: formKode.trim(),
        deskripsi: formDeskripsi.trim(),
        threshold_capaian: Number(formThreshold),
      }
      await api.post('/cpl', payload)
      pushToast(`CPL ${formKode} berhasil ditambahkan`)
      setIsAddModalOpen(false)
      await fetchCplData(selectedVersionId)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menambahkan CPL'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // --- EDIT CPL ---
  const handleOpenEdit = (cpl) => {
    setEditingCpl(cpl)
    setFormKode(cpl.kode || '')
    setFormDeskripsi(cpl.deskripsi || '')
    setFormThreshold(Number(cpl.threshold_capaian) || 70.0)
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingCpl) return
    setSubmitting(true)

    const kodeChanged = formKode.trim() !== editingCpl.kode || formDeskripsi.trim() !== editingCpl.deskripsi
    const thresholdChanged = Number(formThreshold) !== Number(editingCpl.threshold_capaian)

    let infoUpdated = false
    let thresholdUpdated = false
    const errors = []

    // 1. Update kode & deskripsi via PUT /cpl/{id}
    if (kodeChanged) {
      try {
        await api.put(`/cpl/${editingCpl.id}`, {
          kode: formKode.trim(),
          deskripsi: formDeskripsi.trim(),
        })
        infoUpdated = true
      } catch (err) {
        errors.push(`Informasi CPL (Kode/Deskripsi): ${getApiErrorMessage(err, 'Gagal mengupdate informasi CPL')}`)
      }
    } else {
      infoUpdated = true
    }

    // 2. Update threshold via PUT /cpl/{id}/threshold
    if (thresholdChanged) {
      try {
        await api.put(`/cpl/${editingCpl.id}/threshold`, {
          threshold_capaian: Number(formThreshold),
        })
        thresholdUpdated = true
      } catch (err) {
        errors.push(`Target Capaian (Threshold): ${getApiErrorMessage(err, 'Gagal mengupdate target capaian')}`)
      }
    } else {
      thresholdUpdated = true
    }

    setSubmitting(false)

    if (errors.length === 0) {
      pushToast(`CPL ${formKode} berhasil diperbarui`)
      setIsEditModalOpen(false)
      await fetchCplData(selectedVersionId)
    } else if (infoUpdated || thresholdUpdated) {
      const savedParts = []
      if (infoUpdated && kodeChanged) savedParts.push('Kode & Deskripsi')
      if (thresholdUpdated && thresholdChanged) savedParts.push('Target Capaian')
      pushToast(
        `Sebagian berhasil disimpan (${savedParts.join(', ')}). Kegagalan: ${errors.join('; ')}`,
        'warning'
      )
      setIsEditModalOpen(false)
      await fetchCplData(selectedVersionId)
    } else {
      pushToast(errors.join('; '), 'error')
    }
  }

  // --- DELETE CPL ---
  const handleConfirmDelete = async () => {
    if (!cplToDelete) return
    setDeleting(true)
    try {
      await api.delete(`/cpl/${cplToDelete.id}`)
      pushToast(`CPL ${cplToDelete.kode} berhasil dihapus`)
      setCplToDelete(null)
      await fetchCplData(selectedVersionId)
    } catch (err) {
      pushToast(getDeleteErrorMessage(err, 'Gagal menghapus CPL'), 'error')
      setCplToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="MANAJEMEN CAPAIAN PEMBELAJARAN"
        title="Capaian Pembelajaran Lulusan (CPL)"
        description="Kelola daftar CPL program studi, target capaian minimal, dan hubungan hierarki indikator kinerja."
        badge={isAdminProdi ? 'Admin Prodi' : 'Mode Lihat'}
        actions={
          isAdminProdi ? (
            <ActionButton
              onClick={handleOpenAdd}
              data-testid="add-cpl-button"
              className="bg-[#1A3A6B] text-white hover:bg-[#142B4A]"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah CPL</span>
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

      {errorData && (
        <div className="flex items-center gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorData}</span>
        </div>
      )}

      {/* Tabel CPL */}
      <SectionCard
        title="Daftar Capaian Pembelajaran Lulusan"
        description={`Menampilkan ${filteredCpls.length} CPL pada versi kurikulum aktif.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
              <input
                type="search"
                placeholder="Cari kode atau deskripsi..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                data-testid="search-cpl-input"
                className="h-8 w-56 rounded-[6px] border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
              />
            </div>

            {/* Pilihan Jumlah Baris */}
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <span>Tampilkan:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                data-testid="page-size-selector"
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
          <table className="w-full border-collapse text-left text-xs" data-testid="cpl-table">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#6D778E]">
                <th className="py-3 px-4 w-28">Kode</th>
                <th className="py-3 px-4">Deskripsi CPL</th>
                <th className="py-3 px-4 text-center w-36">Target Capaian</th>
                <th className="py-3 px-4 text-center w-28">Jumlah IK</th>
                <th className="py-3 px-4 text-right w-64">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loadingData ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[#64748B]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                      <span>Memuat data CPL...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedCpls.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[#94A3B8]" data-testid="cpl-empty-state">
                    {searchQuery
                      ? 'Tidak ada CPL yang sesuai dengan pencarian.'
                      : 'Belum ada data CPL untuk versi kurikulum ini.'}
                  </td>
                </tr>
              ) : (
                paginatedCpls.map((cpl) => {
                  const ikCount = ikCountMap[cpl.id] || 0
                  return (
                    <tr
                      key={cpl.id}
                      className="transition-colors hover:bg-[#F8FAFC]"
                      data-testid={`cpl-row-${cpl.id}`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[#1A3A6B]">{cpl.kode}</td>
                      <td className="py-3 px-4 text-[#142B4A] leading-relaxed">{cpl.deskripsi}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center rounded-[4px] border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                          {cpl.threshold_capaian}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#F2F4F7] px-2 text-xs font-bold text-[#142B4A]">
                          {ikCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Aksi Indikator */}
                          <Link
                            to={`/kurikulum/cpl/${cpl.id}/indikator`}
                            data-testid={`cpl-indikator-button-${cpl.id}`}
                            className="inline-flex items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                            title="Kelola Indikator Kinerja"
                          >
                            <ListOrdered className="h-3 w-3 text-[#1A3A6B]" />
                            <span>Indikator</span>
                          </Link>

                          {/* Aksi Pemetaan */}
                          <Link
                            to={`/kurikulum/pemetaan?cplId=${cpl.id}`}
                            data-testid={`cpl-pemetaan-button-${cpl.id}`}
                            className="inline-flex items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                            title="Lihat Pemetaan Mata Kuliah"
                          >
                            <Network className="h-3 w-3 text-[#F4A300]" />
                            <span>Pemetaan</span>
                          </Link>

                          {/* Aksi Detail/Edit */}
                          {isAdminProdi && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(cpl)}
                              data-testid={`cpl-edit-button-${cpl.id}`}
                              className="inline-flex items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-white p-1 text-xs text-[#64748B] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                              title="Edit CPL"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Aksi Hapus */}
                          {isAdminProdi && (
                            <button
                              type="button"
                              onClick={() => setCplToDelete(cpl)}
                              data-testid={`cpl-delete-button-${cpl.id}`}
                              className="inline-flex items-center gap-1 rounded-[4px] border border-red-200 bg-red-50 p-1 text-xs text-red-600 hover:bg-red-100 transition-colors"
                              title="Hapus CPL"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4 mt-4 text-xs text-[#64748B]">
            <div>
              Menampilkan halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> ({filteredCpls.length} data)
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-[4px] border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] disabled:opacity-40"
              >
                Sebelumnya
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`rounded-[4px] border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    currentPage === page
                      ? 'border-[#1A3A6B] bg-[#1A3A6B] text-white'
                      : 'border-[#CBD5E1] bg-white text-[#142B4A] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-[4px] border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Modal Tambah CPL */}
      <Modal open={isAddModalOpen} title="Tambah Capaian Pembelajaran (CPL)" onClose={() => setIsAddModalOpen(false)}>
        <form onSubmit={handleSaveAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Kode CPL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: CPL-01 atau CPL-A"
              value={formKode}
              onChange={(e) => setFormKode(e.target.value)}
              data-testid="input-cpl-kode"
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Deskripsi Lengkap CPL <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Jelaskan kompetensi capaian pembelajaran lulusan yang diharapkan..."
              value={formDeskripsi}
              onChange={(e) => setFormDeskripsi(e.target.value)}
              data-testid="input-cpl-deskripsi"
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Target Capaian (%) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              required
              value={formThreshold}
              onChange={(e) => setFormThreshold(e.target.value)}
              data-testid="input-cpl-threshold"
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            />
            <span className="text-[11px] text-[#64748B] mt-1 block">
              Nilai ambang batas kelulusan CPL standar (default institusi: 70.0%).
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-[6px] border border-[#CBD5E1] px-3.5 py-1.5 text-xs font-semibold text-[#142B4A]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="submit-add-cpl-button"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simpan CPL</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit CPL */}
      <Modal open={isEditModalOpen} title="Edit Capaian Pembelajaran (CPL)" onClose={() => setIsEditModalOpen(false)}>
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Kode CPL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formKode}
              onChange={(e) => setFormKode(e.target.value)}
              data-testid="edit-cpl-kode"
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Deskripsi CPL <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={formDeskripsi}
              onChange={(e) => setFormDeskripsi(e.target.value)}
              data-testid="edit-cpl-deskripsi"
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Target Capaian (%) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              required
              value={formThreshold}
              onChange={(e) => setFormThreshold(e.target.value)}
              data-testid="edit-cpl-threshold"
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            />
          </div>

          <p className="text-[11px] text-[#64748B]">
            Penyimpanan memperbarui informasi CPL serta target capaian secara sinkron ke backend.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="rounded-[6px] border border-[#CBD5E1] px-3.5 py-1.5 text-xs font-semibold text-[#142B4A]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="submit-edit-cpl-button"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete CPL */}
      <ConfirmDialog
        open={Boolean(cplToDelete)}
        title="Hapus Capaian Pembelajaran"
        message={`Apakah Anda yakin ingin menghapus ${cplToDelete?.kode}?`}
        warning="Perhatian: Menghapus CPL ini akan ditolak backend jika masih memiliki Indikator Kinerja (IK) atau data ketercapaian terkait di database. Pastikan seluruh IK di bawah CPL ini telah dihapus atau dipindahkan terlebih dahulu."
        confirmLabel="Hapus CPL"
        confirmTestId="confirm-delete-cpl"
        loading={deleting}
        onCancel={() => setCplToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
