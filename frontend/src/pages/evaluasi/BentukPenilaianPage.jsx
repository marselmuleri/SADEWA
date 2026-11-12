import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { PageHeader, ActionButton } from '../../components/PageChrome'
import { TableActionHeader, TableActionCell, TableActionButton } from '../../components/TableActions'
import { getApiErrorMessage, getDeleteErrorMessage } from '../superAdminHelpers'

export default function BentukPenilaianPage() {
  const { pushToast } = useToast()

  const [jenisList, setJenisList] = useState([])
  const [bentukList, setBentukList] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingJenis, setLoadingJenis] = useState(false)

  // Filters
  const [selectedJenisFilter, setSelectedJenisFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' | 'edit'
  const [editingBentuk, setEditingBentuk] = useState(null)
  const [formJenisId, setFormJenisId] = useState('')
  const [formNama, setFormNama] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Delete State
  const [bentukToDelete, setBentukToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // 1. Fetch data
  const fetchJenisList = async () => {
    setLoadingJenis(true)
    try {
      const res = await api.get('/jenis-evaluasi')
      setJenisList(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal memuat jenis evaluasi'), 'error')
      setJenisList([])
    } finally {
      setLoadingJenis(false)
    }
  }

  const fetchBentukList = async (jenisId = null) => {
    setLoading(true)
    try {
      const params = {}
      if (jenisId && jenisId !== 'ALL') {
        params.jenis_evaluasi_id = Number(jenisId)
      }
      const res = await api.get('/bentuk-penilaian', { params })
      setBentukList(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal memuat bentuk penilaian'), 'error')
      setBentukList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJenisList()
  }, [])

  useEffect(() => {
    fetchBentukList(selectedJenisFilter)
  }, [selectedJenisFilter])

  // Map Jenis Evaluasi for fast lookup by id
  const jenisMap = useMemo(() => {
    const map = new Map()
    for (const j of jenisList) {
      map.set(j.id, j)
    }
    return map
  }, [jenisList])

  // 2. Pre-save UI Duplicate Check (Nama Bentuk Penilaian dalam satu Jenis Evaluasi)
  const duplicateNamaError = useMemo(() => {
    const trimmed = formNama.trim().toLowerCase()
    const targetJenisId = Number(formJenisId)
    if (!trimmed || !targetJenisId) return null

    const existing = bentukList.find(
      (b) =>
        Number(b.jenis_evaluasi_id) === targetJenisId &&
        (b.nama || '').trim().toLowerCase() === trimmed &&
        b.id !== editingBentuk?.id
    )

    if (existing) {
      const parentJenis = jenisMap.get(targetJenisId)?.nama || 'jenis evaluasi ini'
      return `Bentuk penilaian "${existing.nama}" sudah terdaftar pada ${parentJenis}.`
    }
    return null
  }, [formNama, formJenisId, bentukList, editingBentuk, jenisMap])

  // 3. Filtered & Searched List
  const filteredBentukList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return bentukList.filter((b) => {
      const matchJenis =
        selectedJenisFilter === 'ALL' || Number(b.jenis_evaluasi_id) === Number(selectedJenisFilter)
      const matchQuery = !q || (b.nama || '').toLowerCase().includes(q)
      return matchJenis && matchQuery
    })
  }, [bentukList, selectedJenisFilter, searchQuery])

  // 4. Modal Handlers
  const handleOpenAdd = () => {
    setModalMode('add')
    setEditingBentuk(null)
    // Default formJenisId to selected filter or first available jenis
    if (selectedJenisFilter !== 'ALL') {
      setFormJenisId(selectedJenisFilter)
    } else if (jenisList.length > 0) {
      setFormJenisId(jenisList[0].id)
    } else {
      setFormJenisId('')
    }
    setFormNama('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item) => {
    setModalMode('edit')
    setEditingBentuk(item)
    setFormJenisId(item.jenis_evaluasi_id)
    setFormNama(item.nama || '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (duplicateNamaError) return
    if (!formJenisId) {
      pushToast('Pilih jenis evaluasi terlebih dahulu', 'warning')
      return
    }
    if (!formNama.trim()) {
      pushToast('Nama bentuk penilaian tidak boleh kosong', 'warning')
      return
    }

    setSubmitting(true)
    try {
      if (modalMode === 'edit') {
        // PUT /bentuk-penilaian/{id} (backend hanya menerima nama)
        await api.put(`/bentuk-penilaian/${editingBentuk.id}`, {
          nama: formNama.trim(),
        })
        pushToast(`Bentuk penilaian "${formNama.trim()}" berhasil diperbarui`, 'success')
      } else {
        // POST /bentuk-penilaian
        await api.post('/bentuk-penilaian', {
          jenis_evaluasi_id: Number(formJenisId),
          nama: formNama.trim(),
        })
        pushToast(`Bentuk penilaian "${formNama.trim()}" berhasil ditambahkan`, 'success')
      }

      setIsModalOpen(false)
      await fetchBentukList(selectedJenisFilter)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan bentuk penilaian'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // 5. Delete Handlers
  const handleConfirmDelete = async () => {
    if (!bentukToDelete) return
    setDeleting(true)
    try {
      await api.delete(`/bentuk-penilaian/${bentukToDelete.id}`)
      pushToast(`Bentuk penilaian "${bentukToDelete.nama}" berhasil dihapus`, 'success')
      setBentukToDelete(null)
      await fetchBentukList(selectedJenisFilter)
    } catch (err) {
      pushToast(getDeleteErrorMessage(err, 'Gagal menghapus bentuk penilaian'), 'error')
      setBentukToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  // Empty State jika belum ada Jenis Evaluasi di prodi ini sama sekali
  if (!loadingJenis && jenisList.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="KURIKULUM OBE · EVALUASI PEMBELAJARAN"
          title="Bentuk Penilaian"
          description="Kelola instrumen penilaian spesifik seperti Tugas, Kuis, UTS, UAS, dan Proyek yang dikelompokkan dalam Jenis Evaluasi."
          badge="Admin Prodi"
        />

        <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F1F5F9] text-[#1A3A6B]">
            <Layers className="h-7 w-7 text-[#1A3A6B]" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-[#142B4A]">
            Belum Ada Jenis Evaluasi
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-[#64748B] leading-relaxed">
            Setiap bentuk penilaian harus dinaungi oleh <strong>Jenis Evaluasi</strong> (contohnya Formatif atau Sumatif). Silakan buat jenis evaluasi terlebih dahulu sebelum mengelola bentuk penilaian.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/kurikulum/jenis-evaluasi"
              className="inline-flex items-center gap-2 rounded-md bg-[#1A3A6B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142B4A] transition-colors"
            >
              <span>Buka Halaman Jenis Evaluasi</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="KURIKULUM OBE · EVALUASI PEMBELAJARAN"
        title="Bentuk Penilaian"
        description="Kelola instrumen dan asesmen penilaian prodi (Tugas, Kuis, UTS, UAS, Praktikum) yang berada di bawah klasifikasi Jenis Evaluasi."
        badge="Admin Prodi"
        actions={
          <ActionButton
            onClick={handleOpenAdd}
            data-testid="btn-tambah-bentuk"
            className="bg-[#1A3A6B] text-white hover:bg-[#142B4A]"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Bentuk Penilaian</span>
          </ActionButton>
        }
      />

      {/* Filter Toolbar & Table Card */}
      <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        {/* Filters Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#E2E8F0] p-4 bg-white">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Filter Jenis Evaluasi */}
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-[#64748B]" />
              <span className="text-xs font-semibold text-[#142B4A]">Jenis Evaluasi:</span>
              <select
                value={selectedJenisFilter}
                onChange={(e) => setSelectedJenisFilter(e.target.value)}
                data-testid="select-filter-jenis"
                className="rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
              >
                <option value="ALL">Semua Jenis Evaluasi</option>
                {jenisList.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Cari bentuk penilaian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-[#CBD5E1] bg-white pl-8 pr-3 py-1.5 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
              />
            </div>
          </div>

          <div className="text-xs text-[#64748B]">
            Total: <span className="font-semibold text-[#142B4A]">{filteredBentukList.length}</span> bentuk penilaian
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 w-16 text-center">No</th>
                <th className="py-3 px-4 w-56">Jenis Evaluasi</th>
                <th className="py-3 px-4">Nama Bentuk Penilaian</th>
                <TableActionHeader />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#64748B]">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                      <span>Memuat data bentuk penilaian...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredBentukList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#64748B]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ClipboardCheck className="h-8 w-8 text-[#CBD5E1]" />
                      <p className="font-medium text-[#142B4A]">
                        {searchQuery
                          ? 'Tidak ada bentuk penilaian yang cocok dengan pencarian'
                          : 'Belum ada bentuk penilaian untuk kategori ini'}
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        {searchQuery
                          ? 'Coba ubah kata kunci pencarian atau ganti filter jenis evaluasi'
                          : 'Klik tombol "Tambah Bentuk Penilaian" untuk membuat instrumen asesmen baru'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBentukList.map((item, idx) => {
                  const parentJenis = jenisMap.get(Number(item.jenis_evaluasi_id))
                  return (
                    <tr key={item.id} className="align-top hover:bg-[#F8FAFC]/80 transition-colors">
                      <td className="py-3 px-4 text-center font-medium text-[#64748B]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CBD5E1] bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-semibold text-[#142B4A]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#1A3A6B]" />
                          <span>{parentJenis?.nama || `Jenis #${item.jenis_evaluasi_id}`}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#142B4A]">
                        {item.nama}
                      </td>
                      <TableActionCell>
                        <TableActionButton
                          variant="secondary"
                          onClick={() => handleOpenEdit(item)}
                          data-testid={`btn-edit-bentuk-${item.id}`}
                          icon={Edit2}
                          label="Ubah"
                          title="Ubah nama"
                        />
                        <TableActionButton
                          variant="danger"
                          onClick={() => setBentukToDelete(item)}
                          data-testid={`btn-delete-bentuk-${item.id}`}
                          icon={Trash2}
                          label="Hapus"
                          title="Hapus bentuk penilaian"
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

      {/* MODAL TAMBAH / EDIT */}
      <Modal
        open={isModalOpen}
        title={modalMode === 'edit' ? 'Ubah Bentuk Penilaian' : 'Tambah Bentuk Penilaian'}
        onClose={submitting ? () => {} : () => setIsModalOpen(false)}
        size="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Jenis Evaluasi <span className="text-red-500">*</span>
            </label>
            {modalMode === 'edit' ? (
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-medium text-[#64748B]">
                <div className="flex items-center justify-between">
                  <span>{jenisMap.get(Number(formJenisId))?.nama || `Jenis #${formJenisId}`}</span>
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold">Terkunci</span>
                </div>
                <p className="mt-1 text-[10px] text-[#94A3B8]">
                  Jenis evaluasi induk tidak dapat diubah setelah bentuk penilaian dibuat.
                </p>
              </div>
            ) : (
              <select
                required
                value={formJenisId}
                onChange={(e) => setFormJenisId(e.target.value)}
                data-testid="input-jenis-select"
                className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
              >
                <option value="" disabled>Pilih Jenis Evaluasi</option>
                {jenisList.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.nama}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Nama Bentuk Penilaian <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={formNama}
              onChange={(e) => setFormNama(e.target.value)}
              placeholder="Contoh: Tugas 1, Kuis, UTS, UAS, Proyek"
              data-testid="input-nama-bentuk"
              className={`w-full rounded-md border px-3 py-2 text-xs text-[#142B4A] focus:outline-none focus:ring-1 ${
                duplicateNamaError
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  : 'border-[#CBD5E1] focus:border-[#1A3A6B] focus:ring-[#1A3A6B]'
              }`}
            />
            {duplicateNamaError && (
              <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1" data-testid="error-duplicate-nama-bentuk">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{duplicateNamaError}</span>
              </p>
            )}
            <p className="mt-1 text-[11px] text-[#64748B]">
              Nama asesmen spesifik yang akan dipilih oleh dosen saat merancang RPS atau penilaian MK.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
              className="rounded-md border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(duplicateNamaError) || !formNama.trim() || !formJenisId}
              data-testid="btn-submit-bentuk"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{modalMode === 'edit' ? 'Simpan Perubahan' : 'Tambah Bentuk'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* DIALOG KONFIRMASI HAPUS */}
      <ConfirmDialog
        open={Boolean(bentukToDelete)}
        title="Hapus Bentuk Penilaian"
        message={`Apakah Anda yakin ingin menghapus bentuk penilaian "${bentukToDelete?.nama}"?`}
        warning="Bila bentuk penilaian ini telah digunakan pada pemetaan mata kuliah (mk_bentuk_penilaian), penghapusan akan dicegah oleh sistem integritas basis data."
        confirmLabel="Hapus Bentuk Penilaian"
        cancelLabel="Batal"
        isDestructive={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setBentukToDelete(null)}
      />
    </div>
  )
}
