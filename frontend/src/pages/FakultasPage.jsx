import { useEffect, useMemo, useState } from 'react'
import { Building2, Loader2, Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { ActionButton, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import Modal from '../components/Modal'
import useToast from '../hooks/useToast'
import api from '../services/api'
import { getApiErrorMessage } from './superAdminHelpers'

const emptyForm = { kode: '', nama: '' }

function normalizeFakultas(item) {
  return {
    id: item.id,
    kode: item.kode || '',
    nama: item.nama || item.name || '',
    raw: item,
  }
}

function SkeletonRows() {
  return Array.from({ length: 4 }).map((_, index) => (
    <tr key={index} className="animate-pulse border-b border-[#F2F4F7]">
      <td className="py-4"><div className="h-4 w-20 rounded bg-[#E2E8F0]" /></td>
      <td className="py-4"><div className="h-4 w-48 rounded bg-[#E2E8F0]" /></td>
      <td className="py-4 text-right"><div className="ml-auto h-8 w-28 rounded bg-[#E2E8F0]" /></td>
    </tr>
  ))
}

export default function FakultasPage() {
  const { pushToast } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [mode, setMode] = useState('create')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [target, setTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})

  const loadFakultas = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/fakultas')
      setItems(Array.isArray(data) ? data.map(normalizeFakultas) : [])
    } catch {
      setItems([])
      pushToast('Gagal memuat daftar fakultas', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFakultas()
  }, [])

  const filteredItems = useMemo(() => {
    const query = search.toLowerCase().trim()
    if (!query) return items
    return items.filter((item) => `${item.kode} ${item.nama}`.toLowerCase().includes(query))
  }, [items, search])

  const openCreate = () => {
    setMode('create')
    setForm(emptyForm)
    setFieldErrors({})
    setTarget(null)
    setFormOpen(true)
  }

  const openEdit = async (row) => {
    setMode('edit')
    setFieldErrors({})
    setTarget(row)
    setFormOpen(true)
    try {
      const { data } = await api.get(`/fakultas/${row.id}`)
      const detail = normalizeFakultas(data)
      setForm({ kode: detail.kode, nama: detail.nama })
    } catch {
      setForm({ kode: row.kode, nama: row.nama })
    }
  }

  const closeForm = () => {
    setFormOpen(false)
    setTarget(null)
    setForm(emptyForm)
    setFieldErrors({})
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setFieldErrors({})

    try {
      const payload = {
        kode: form.kode.trim().toUpperCase(),
        nama: form.nama.trim(),
      }

      if (!payload.kode) {
        setFieldErrors({ kode: 'Kode fakultas wajib diisi' })
        setSubmitting(false)
        return
      }

      if (!payload.nama) {
        setFieldErrors({ nama: 'Nama fakultas wajib diisi' })
        setSubmitting(false)
        return
      }

      const { data } = mode === 'create'
        ? await api.post('/fakultas', payload)
        : await api.put(`/fakultas/${target.id}`, payload)

      const saved = normalizeFakultas(data)
      setItems((current) => {
        if (mode === 'create') return [saved, ...current]
        return current.map((item) => (item.id === saved.id ? saved : item))
      })
      pushToast(`Fakultas ${mode === 'create' ? 'berhasil dibuat' : 'berhasil diperbarui'}`)
      closeForm()
    } catch (error) {
      const detail = getApiErrorMessage(error, 'Gagal menyimpan fakultas')
      if (String(detail).toLowerCase().includes('kode')) {
        setFieldErrors({ kode: detail })
      } else {
        pushToast(detail, 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/fakultas/${deleteTarget.id}`)
      setItems((current) => current.filter((item) => item.id !== deleteTarget.id))
      pushToast(`Fakultas ${deleteTarget.nama} dihapus`)
      setDeleteTarget(null)
    } catch (error) {
      pushToast(getApiErrorMessage(error, 'Gagal menghapus fakultas'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Panel Super Admin"
        title="Daftar Fakultas"
        description="Kelola master fakultas yang dipakai sebagai scope provisioning dan relasi program studi."
        badge="Super Admin"
        actions={
          <ActionButton onClick={openCreate} data-testid="fakultas-create-button">
            <Plus className="h-4 w-4" />
            Tambah Fakultas
          </ActionButton>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Fakultas" value={items.length} caption="Data master fakultas aktif" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Hasil Pencarian" value={filteredItems.length} caption="Cocok dengan filter saat ini" icon={<Search className="h-4 w-4" />} />
      </div>

      <SectionCard
        title="Tabel Fakultas"
        description="Kode duplikat ditangani sebagai validasi field. Delete akan menampilkan pesan backend jika masih ada relasi."
        action={
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari kode atau nama fakultas..."
              className="h-9 w-72 rounded-[6px] border border-[#CBD5E1] bg-white pl-9 pr-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              data-testid="fakultas-search"
            />
          </label>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="fakultas-table">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                <th className="pb-3 font-semibold">Kode</th>
                <th className="pb-3 font-semibold">Nama Fakultas</th>
                <th className="pb-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {loading ? (
                <SkeletonRows />
              ) : filteredItems.length ? (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                    <td className="py-3.5">
                      <span className="rounded-[4px] bg-[#1A3A6B]/10 px-2 py-0.5 font-bold text-[#1A3A6B]">{item.kode}</span>
                    </td>
                    <td className="py-3.5 font-semibold text-[#142B4A]">{item.nama}</td>
                    <td className="py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-white px-3 text-[11px] font-medium text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                          data-testid={`fakultas-edit-${item.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-red-200 bg-white px-3 text-[11px] font-medium text-red-700 hover:bg-red-50"
                          data-testid={`fakultas-delete-${item.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-sm text-[#64748B]">
                    Tidak ada fakultas yang cocok dengan filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Modal
        open={formOpen}
        title={mode === 'create' ? 'Tambah Fakultas' : 'Edit Fakultas'}
        onClose={closeForm}
      >
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="fakultas-form">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Kode Fakultas</span>
            <input
              type="text"
              value={form.kode}
              onChange={(event) => setForm((current) => ({ ...current, kode: event.target.value.toUpperCase() }))}
              className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-sm focus:border-[#1A3A6B] focus:outline-none"
              data-testid="fakultas-form-kode"
            />
            {fieldErrors.kode ? <p className="text-xs text-red-700" data-testid="fakultas-kode-error">{fieldErrors.kode}</p> : null}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Nama Fakultas</span>
            <input
              type="text"
              value={form.nama}
              onChange={(event) => setForm((current) => ({ ...current, nama: event.target.value }))}
              className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-sm focus:border-[#1A3A6B] focus:outline-none"
              data-testid="fakultas-form-nama"
            />
            {fieldErrors.nama ? <p className="text-xs text-red-700">{fieldErrors.nama}</p> : null}
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <ActionButton type="button" variant="secondary" onClick={closeForm} data-testid="fakultas-form-cancel">
              Batal
            </ActionButton>
            <ActionButton type="submit" disabled={submitting} data-testid="fakultas-form-submit">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? 'Simpan Fakultas' : 'Perbarui Fakultas'}
            </ActionButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Hapus Fakultas"
        onClose={() => setDeleteTarget(null)}
      >
        <div className="space-y-4 text-sm text-[#142B4A]">
          <p>
            Yakin ingin menghapus fakultas <span className="font-semibold">{deleteTarget?.nama}</span>?
          </p>
          <p className="text-xs text-[#64748B]">
            Jika fakultas masih memiliki Program Studi atau akun Dekan, backend akan menolak penghapusan dan pesan error akan ditampilkan apa adanya.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <ActionButton type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              Batal
            </ActionButton>
            <ActionButton type="button" onClick={handleDelete} disabled={deleting} data-testid="fakultas-delete-confirm">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Hapus
            </ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
