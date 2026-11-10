import { useState } from 'react'
import { Plus, CheckCircle, Clock, ChevronDown, Loader2 } from 'lucide-react'
import Modal from './Modal'
import { Badge } from './PageChrome'
import api from '../services/api'
import useToast from '../hooks/useToast'
import { getApiErrorMessage } from '../pages/superAdminHelpers'

export default function KurikulumVersionSelector({
  versions = [],
  selectedVersionId,
  onSelectVersion,
  onRefreshVersions,
  canManage = false,
  loading = false,
}) {
  const { pushToast } = useToast()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [form, setForm] = useState({ version_label: '', semester: 'Ganjil' })

  const currentVersion = versions.find((v) => v.id === selectedVersionId) || versions[0]

  const handleOpenAdd = () => {
    setForm({ version_label: '', semester: 'Ganjil' })
    setIsModalOpen(true)
  }

  const handleSaveVersion = async (e) => {
    e.preventDefault()
    if (!form.version_label.trim()) return
    setSubmitting(true)
    try {
      const res = await api.post('/kurikulum/versions', form)
      pushToast(`Versi kurikulum ${res.data.version_label} berhasil dibuat (Draft)`)
      setIsModalOpen(false)
      if (onRefreshVersions) await onRefreshVersions(res.data.id)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal membuat versi kurikulum'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublish = async () => {
    if (!currentVersion || currentVersion.status === 'published') return
    setPublishing(true)
    try {
      await api.post(`/kurikulum/versions/${currentVersion.id}/publish`)
      pushToast(`Kurikulum ${currentVersion.version_label} berhasil dipublikasikan`)
      if (onRefreshVersions) await onRefreshVersions(currentVersion.id)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal mempublikasikan kurikulum'), 'error')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#E2E8F0] bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="label-filter">
          Versi Kurikulum:
        </span>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1A3A6B]" />
            <span>Memuat versi...</span>
          </div>
        ) : versions.length > 0 ? (
          <div className="relative inline-block">
            <select
              value={selectedVersionId || ''}
              onChange={(e) => onSelectVersion(Number(e.target.value))}
              data-testid="version-selector-dropdown"
              className="h-10 appearance-none rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] pl-3 pr-9 text-sm font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_label} ({v.semester}) {v.status === 'published' ? '✓' : '(Draft)'}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          </div>
        ) : (
          <span className="text-xs text-[#94A3B8]">Belum ada versi kurikulum</span>
        )}

        {currentVersion && (
          <Badge tone={currentVersion.status === 'published' ? 'success' : 'warning'}>
            {currentVersion.status === 'published' ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> Draft
              </span>
            )}
          </Badge>
        )}
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          {currentVersion && currentVersion.status !== 'published' && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              data-testid="publish-version-button"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
              <span>Publikasikan Versi Ini</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAdd}
            data-testid="add-version-button"
            className="inline-flex items-center gap-1 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Versi Baru</span>
          </button>
        </div>
      )}

      {/* Modal Tambah Versi */}
      <Modal open={isModalOpen} title="Tambah Versi Kurikulum Baru" onClose={() => setIsModalOpen(false)}>
        <form onSubmit={handleSaveVersion} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Label Versi Kurikulum <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Kurikulum OBE 2024 (Revisi 1)"
              value={form.version_label}
              onChange={(e) => setForm({ ...form, version_label: e.target.value })}
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Semester Awal Berlaku <span className="text-red-500">*</span>
            </label>
            <select
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>

          <p className="text-[11px] text-[#64748B]">
            Versi baru akan dibuat dengan status <strong>Draft</strong>. Anda dapat menyusun CPL, IK, dan CPMK sebelum mempublikasikannya.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-[6px] border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#142B4A]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>Simpan Versi</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
