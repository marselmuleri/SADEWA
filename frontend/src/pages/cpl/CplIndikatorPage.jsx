import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  Award,
} from 'lucide-react'
import { PageHeader, SectionCard, Badge, ActionButton } from '../../components/PageChrome'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import useAuth from '../../hooks/useAuth'
import { getApiErrorMessage, getDeleteErrorMessage } from '../superAdminHelpers'

export default function CplIndikatorPage() {
  const { cplId } = useParams()
  const navigate = useNavigate()
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()
  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isAdminProdi = currentRole === 'admin_prodi'

  const [cpl, setCpl] = useState(null)
  const [ikList, setIkList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingIk, setEditingIk] = useState(null)

  // Form states
  const [formKode, setFormKode] = useState('')
  const [formDeskripsi, setFormDeskripsi] = useState('')
  const [formUrutan, setFormUrutan] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  // Delete state
  const [ikToDelete, setIkToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    if (!cplId) return
    setLoading(true)
    setError(null)
    try {
      const [cplRes, ikRes] = await Promise.all([
        api.get(`/cpl/${cplId}`),
        api.get('/ik', { params: { cpl_id: Number(cplId) } }),
      ])
      setCpl(cplRes.data)
      setIkList(Array.isArray(ikRes.data) ? ikRes.data : [])
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat data CPL atau Indikator Kinerja'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [cplId])

  // UI Pre-save Duplicate Check for Kode IK within this CPL
  const duplicateKodeError = useMemo(() => {
    const trimmed = formKode.trim().toLowerCase()
    if (!trimmed) return null
    const existing = ikList.find(
      (ik) => (ik.kode || '').toLowerCase().trim() === trimmed && ik.id !== editingIk?.id
    )
    if (existing) {
      return `Kode IK "${existing.kode}" sudah terdaftar pada CPL ini.`
    }
    return null
  }, [formKode, ikList, editingIk])

  // --- ADD IK ---
  const handleOpenAdd = () => {
    setEditingIk(null)
    const nextOrder = ikList.length + 1
    const prefix = cpl?.kode ? `${cpl.kode}.` : 'IK-'
    setFormKode(`${prefix}${nextOrder}`)
    setFormDeskripsi('')
    setFormUrutan(nextOrder)
    setIsAddModalOpen(true)
  }

  const handleSaveAdd = async (e) => {
    e.preventDefault()
    if (duplicateKodeError) return
    setSubmitting(true)
    try {
      const payload = {
        cpl_id: Number(cplId),
        kode: formKode.trim(),
        deskripsi: formDeskripsi.trim(),
        urutan: formUrutan ? Number(formUrutan) : null,
      }
      await api.post('/ik', payload)
      pushToast(`Indikator Kinerja ${formKode} berhasil ditambahkan`)
      setIsAddModalOpen(false)
      await loadData()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menambahkan IK'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // --- EDIT IK ---
  const handleOpenEdit = (ik) => {
    setEditingIk(ik)
    setFormKode(ik.kode || '')
    setFormDeskripsi(ik.deskripsi || '')
    setFormUrutan(ik.urutan || 1)
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingIk) return
    if (duplicateKodeError) return
    setSubmitting(true)
    try {
      const payload = {
        kode: formKode.trim(),
        deskripsi: formDeskripsi.trim(),
        urutan: formUrutan ? Number(formUrutan) : null,
      }
      await api.put(`/ik/${editingIk.id}`, payload)
      pushToast(`Indikator Kinerja ${formKode} berhasil diperbarui`)
      setIsEditModalOpen(false)
      await loadData()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal memperbarui IK'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // --- DELETE IK ---
  const handleConfirmDelete = async () => {
    if (!ikToDelete) return
    setDeleting(true)
    try {
      await api.delete(`/ik/${ikToDelete.id}`)
      pushToast(`Indikator Kinerja ${ikToDelete.kode} berhasil dihapus`)
      setIkToDelete(null)
      await loadData()
    } catch (err) {
      pushToast(getDeleteErrorMessage(err, 'Gagal menghapus IK'), 'error')
      setIkToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tombol Kembali & Breadcrumb Header */}
      <div className="flex items-center gap-2">
        <Link
          to="/kurikulum/cpl"
          data-testid="back-to-cpl-list"
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Daftar CPL</span>
        </Link>
      </div>

      <PageHeader
        eyebrow="DETAIL CAPAIAN PEMBELAJARAN"
        title={cpl ? `Indikator Kinerja — ${cpl.kode}` : 'Indikator Kinerja CPL'}
        description="Kelola indikator kinerja spesifik (IK) yang menjadi tolak ukur ketercapaian kompetensi CPL ini."
        badge={isAdminProdi ? 'Admin Prodi' : 'Mode Lihat'}
        actions={
          isAdminProdi ? (
            <ActionButton
              onClick={handleOpenAdd}
              data-testid="add-ik-button"
              className="bg-[#1A3A6B] text-white hover:bg-[#142B4A]"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Indikator</span>
            </ActionButton>
          ) : null
        }
      />

      {error && (
        <div className="flex items-center gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Ringkasan CPL Card */}
      {cpl && (
        <div className="rounded-[8px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#1A3A6B] font-mono">{cpl.kode}</span>
                <Badge tone="default">CPL Induk</Badge>
              </div>
              <p className="text-xs text-[#142B4A] leading-relaxed max-w-3xl">{cpl.deskripsi}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0 border-t md:border-t-0 md:border-l border-[#E2E8F0] pt-3 md:pt-0 md:pl-5">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#6D778E] block">Target Capaian</span>
                <span className="text-lg font-bold text-[#1A3A6B]">{cpl.threshold_capaian}%</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#6D778E] block">Total Indikator</span>
                <span className="text-lg font-bold text-[#142B4A]">{ikList.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabel Indikator Kinerja */}
      <SectionCard
        title="Daftar Indikator Kinerja (IK)"
        description={`Terdapat ${ikList.length} indikator kinerja operasional di bawah ${cpl?.kode || 'CPL ini'}.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs" data-testid="ik-table">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#6D778E]">
                <th className="py-3 px-4 w-20 text-center">Urutan</th>
                <th className="py-3 px-4 w-32">Kode IK</th>
                <th className="py-3 px-4">Deskripsi Indikator Kinerja</th>
                {isAdminProdi && <th className="py-3 px-4 text-right w-36">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={isAdminProdi ? 4 : 3} className="py-8 text-center text-xs text-[#64748B]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                      <span>Memuat data indikator...</span>
                    </div>
                  </td>
                </tr>
              ) : ikList.length === 0 ? (
                <tr>
                  <td colSpan={isAdminProdi ? 4 : 3} className="py-8 text-center text-xs text-[#94A3B8]" data-testid="ik-empty-state">
                    Belum ada Indikator Kinerja yang dibuat untuk CPL ini.
                  </td>
                </tr>
              ) : (
                ikList.map((ik, idx) => (
                  <tr
                    key={ik.id}
                    className="transition-colors hover:bg-[#F8FAFC]"
                    data-testid={`ik-row-${ik.id}`}
                  >
                    <td className="py-3 px-4 text-center font-mono text-[#64748B]">
                      {ik.urutan || idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#1A3A6B]">{ik.kode}</td>
                    <td className="py-3 px-4 text-[#142B4A] leading-relaxed">{ik.deskripsi}</td>
                    {isAdminProdi && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ik)}
                            data-testid={`ik-edit-button-${ik.id}`}
                            className="inline-flex items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                            title="Edit IK"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIkToDelete(ik)}
                            data-testid={`ik-delete-button-${ik.id}`}
                            className="inline-flex items-center gap-1 rounded-[4px] border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 transition-colors"
                            title="Hapus IK"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Modal Tambah IK */}
      <Modal open={isAddModalOpen} title={`Tambah Indikator Kinerja (${cpl?.kode || 'CPL'})`} onClose={() => setIsAddModalOpen(false)}>
        <form onSubmit={handleSaveAdd} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                Kode Indikator <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: IK-01.1"
                value={formKode}
                onChange={(e) => setFormKode(e.target.value)}
                data-testid="input-ik-kode"
                className={`w-full rounded-[6px] border px-3 py-2 text-xs focus:outline-none ${
                  duplicateKodeError
                    ? 'border-red-400 bg-red-50/50 text-red-900 focus:border-red-500'
                    : 'border-[#CBD5E1] focus:border-[#1A3A6B]'
                }`}
              />
              {duplicateKodeError && (
                <p className="mt-1 text-[11px] font-medium text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 inline" />
                  <span>{duplicateKodeError}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                Urutan (Opsional)
              </label>
              <input
                type="number"
                min="1"
                value={formUrutan}
                onChange={(e) => setFormUrutan(e.target.value)}
                data-testid="input-ik-urutan"
                className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Deskripsi Indikator Kinerja <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Jelaskan ukuran kemampuan yang dapat diamati/diukur untuk membuktikan ketercapaian CPL..."
              value={formDeskripsi}
              onChange={(e) => setFormDeskripsi(e.target.value)}
              data-testid="input-ik-deskripsi"
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            />
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
              disabled={submitting || Boolean(duplicateKodeError) || !formKode.trim()}
              data-testid="submit-add-ik-button"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simpan Indikator</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit IK */}
      <Modal open={isEditModalOpen} title={`Edit Indikator Kinerja (${editingIk?.kode || ''})`} onClose={() => setIsEditModalOpen(false)}>
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                Kode Indikator <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formKode}
                onChange={(e) => setFormKode(e.target.value)}
                data-testid="edit-ik-kode"
                className={`w-full rounded-[6px] border px-3 py-2 text-xs focus:outline-none ${
                  duplicateKodeError
                    ? 'border-red-400 bg-red-50/50 text-red-900 focus:border-red-500'
                    : 'border-[#CBD5E1] focus:border-[#1A3A6B]'
                }`}
              />
              {duplicateKodeError && (
                <p className="mt-1 text-[11px] font-medium text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 inline" />
                  <span>{duplicateKodeError}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                Urutan (Opsional)
              </label>
              <input
                type="number"
                min="1"
                value={formUrutan}
                onChange={(e) => setFormUrutan(e.target.value)}
                data-testid="edit-ik-urutan"
                className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Deskripsi Indikator Kinerja <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={formDeskripsi}
              onChange={(e) => setFormDeskripsi(e.target.value)}
              data-testid="edit-ik-deskripsi"
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            />
          </div>

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
              disabled={submitting || Boolean(duplicateKodeError) || !formKode.trim()}
              data-testid="submit-edit-ik-button"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete IK */}
      <ConfirmDialog
        open={Boolean(ikToDelete)}
        title="Hapus Indikator Kinerja"
        message={`Apakah Anda yakin ingin menghapus indikator ${ikToDelete?.kode}?`}
        warning="Perhatian: Menghapus IK ini akan ditolak backend jika masih dipetakan pada CPMK atau instrumen penilaian di database. Pastikan pemetaan IK ini telah dilepas terlebih dahulu."
        confirmLabel="Hapus Indikator"
        confirmTestId="confirm-delete-ik"
        loading={deleting}
        onCancel={() => setIkToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
