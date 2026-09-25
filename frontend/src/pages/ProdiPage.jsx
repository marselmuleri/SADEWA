import { useEffect, useMemo, useState } from 'react'
import { Building2, Loader2, Plus, Search, Pencil, Trash2, Eye } from 'lucide-react'
import { ActionButton, PageHeader, SectionCard, StatCard, Badge } from '../components/PageChrome'
import Modal from '../components/Modal'
import useToast from '../hooks/useToast'
import api from '../services/api'
import { getApiErrorMessage, toId } from './superAdminHelpers'

const emptyForm = { kode: '', nama: '', fakultas_id: '' }

function normalizeFakultas(item) {
  return {
    id: item.id,
    kode: item.kode || '',
    nama: item.nama || item.name || '',
  }
}

function normalizeProdi(item, facultyLookup = []) {
  const fakultasId = item.fakultas_id ?? item.fakultas?.id ?? item.fakultas?.fakultas_id ?? null
  const fakultasNama = item.fakultas?.nama || item.fakultas_nama || facultyLookup.find((faculty) => String(faculty.id) === String(fakultasId))?.nama || ''
  return {
    id: item.id,
    kode: item.kode || '',
    nama: item.nama || item.name || '',
    fakultas_id: fakultasId,
    fakultas_nama: fakultasNama,
    raw: item,
  }
}

function SkeletonRows() {
  return Array.from({ length: 4 }).map((_, index) => (
    <tr key={index} className="animate-pulse border-b border-[#F2F4F7]">
      <td className="py-4"><div className="h-4 w-20 rounded bg-[#E2E8F0]" /></td>
      <td className="py-4"><div className="h-4 w-48 rounded bg-[#E2E8F0]" /></td>
      <td className="py-4"><div className="h-4 w-40 rounded bg-[#E2E8F0]" /></td>
      <td className="py-4 text-right"><div className="ml-auto h-8 w-44 rounded bg-[#E2E8F0]" /></td>
    </tr>
  ))
}

export default function ProdiPage() {
  const { pushToast } = useToast()
  const [items, setItems] = useState([])
  const [faculties, setFaculties] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [mode, setMode] = useState('create')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [target, setTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})

  const loadData = async () => {
    setLoading(true)
    try {
      const [facultyRes, prodiRes] = await Promise.all([api.get('/fakultas'), api.get('/prodi')])
      const facultyData = Array.isArray(facultyRes.data) ? facultyRes.data.map(normalizeFakultas) : []
      setFaculties(facultyData)
      setItems(Array.isArray(prodiRes.data) ? prodiRes.data.map((item) => normalizeProdi(item, facultyData)) : [])
    } catch {
      setFaculties([])
      setItems([])
      pushToast('Gagal memuat daftar program studi', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredItems = useMemo(() => {
    const query = search.toLowerCase().trim()
    if (!query) return items
    return items.filter((item) => `${item.kode} ${item.nama} ${item.fakultas_nama}`.toLowerCase().includes(query))
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
      const { data } = await api.get(`/prodi/${row.id}`)
      const detail = normalizeProdi(data, faculties)
      setForm({ kode: detail.kode, nama: detail.nama, fakultas_id: detail.fakultas_id || '' })
    } catch {
      setForm({ kode: row.kode, nama: row.nama, fakultas_id: row.fakultas_id || '' })
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
        fakultas_id: toId(form.fakultas_id),
      }

      if (!payload.kode) {
        setFieldErrors({ kode: 'Kode program studi wajib diisi' })
        setSubmitting(false)
        return
      }

      if (!payload.nama) {
        setFieldErrors({ nama: 'Nama program studi wajib diisi' })
        setSubmitting(false)
        return
      }

      if (!payload.fakultas_id) {
        setFieldErrors({ fakultas_id: 'Fakultas wajib dipilih' })
        setSubmitting(false)
        return
      }

      const { data } = mode === 'create'
        ? await api.post('/prodi', payload)
        : await api.put(`/prodi/${target.id}`, payload)

      const saved = normalizeProdi(data, faculties)
      setItems((current) => {
        if (mode === 'create') return [saved, ...current]
        return current.map((item) => (item.id === saved.id ? saved : item))
      })
      pushToast(`Program studi ${mode === 'create' ? 'berhasil dibuat' : 'berhasil diperbarui'}`)
      closeForm()
    } catch (error) {
      const detail = getApiErrorMessage(error, 'Gagal menyimpan program studi')
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
      await api.delete(`/prodi/${deleteTarget.id}`)
      setItems((current) => current.filter((item) => item.id !== deleteTarget.id))
      pushToast(`Program studi ${deleteTarget.nama} dihapus`)
      setDeleteTarget(null)
    } catch (error) {
      pushToast(getApiErrorMessage(error, 'Gagal menghapus program studi'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Panel Super Admin"
        title="Daftar Program Studi"
        description="Kelola master program studi dan relasinya dengan fakultas menggunakan CRUD backend nyata."
        badge="Super Admin"
        actions={
          <ActionButton onClick={openCreate} data-testid="prodi-create-button">
            <Plus className="h-4 w-4" />
            Tambah Prodi
          </ActionButton>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Program Studi" value={items.length} caption="Data master prodi" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Total Fakultas" value={faculties.length} caption="Sumber dropdown relasi" icon={<Building2 className="h-4 w-4" />} />
      </div>

      <SectionCard
        title="Tabel Program Studi"
        description="Gunakan detail hanya untuk metadata. Isi akademik tetap di luar kewenangan Super Admin."
        action={
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, kode, atau fakultas..."
              className="h-9 w-80 rounded-[6px] border border-[#CBD5E1] bg-white pl-9 pr-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              data-testid="prodi-search"
            />
          </label>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="prodi-table">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                <th className="pb-3 font-semibold">Kode</th>
                <th className="pb-3 font-semibold">Nama Prodi</th>
                <th className="pb-3 font-semibold">Fakultas</th>
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
                    <td className="py-3.5 text-[#64748B]">{item.fakultas_nama}</td>
                    <td className="py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailTarget(item)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-white px-3 text-[11px] font-medium text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                          data-testid={`prodi-detail-${item.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Detail
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-white px-3 text-[11px] font-medium text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                          data-testid={`prodi-edit-${item.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-red-200 bg-white px-3 text-[11px] font-medium text-red-700 hover:bg-red-50"
                          data-testid={`prodi-delete-${item.id}`}
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
                  <td colSpan={4} className="py-10 text-center text-sm text-[#64748B]">
                    Tidak ada program studi yang cocok dengan filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Modal
        open={formOpen}
        title={mode === 'create' ? 'Tambah Program Studi' : 'Edit Program Studi'}
        onClose={closeForm}
        size="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2" data-testid="prodi-form">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Kode Prodi</span>
            <input
              type="text"
              value={form.kode}
              onChange={(event) => setForm((current) => ({ ...current, kode: event.target.value.toUpperCase() }))}
              className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-sm focus:border-[#1A3A6B] focus:outline-none"
              data-testid="prodi-form-kode"
            />
            {fieldErrors.kode ? <p className="text-xs text-red-700" data-testid="prodi-kode-error">{fieldErrors.kode}</p> : null}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Nama Prodi</span>
            <input
              type="text"
              value={form.nama}
              onChange={(event) => setForm((current) => ({ ...current, nama: event.target.value }))}
              className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-sm focus:border-[#1A3A6B] focus:outline-none"
              data-testid="prodi-form-nama"
            />
            {fieldErrors.nama ? <p className="text-xs text-red-700">{fieldErrors.nama}</p> : null}
          </label>

          <label className="block space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-[#142B4A]">Fakultas</span>
            <select
              value={form.fakultas_id}
              onChange={(event) => setForm((current) => ({ ...current, fakultas_id: event.target.value }))}
              className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-sm focus:border-[#1A3A6B] focus:outline-none"
              data-testid="prodi-form-fakultas"
            >
              <option value="">Pilih fakultas</option>
              {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {faculty.nama} ({faculty.kode})
                </option>
              ))}
            </select>
            {fieldErrors.fakultas_id ? <p className="text-xs text-red-700">{fieldErrors.fakultas_id}</p> : null}
          </label>

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
            <ActionButton type="button" variant="secondary" onClick={closeForm} data-testid="prodi-form-cancel">
              Batal
            </ActionButton>
            <ActionButton type="submit" disabled={submitting} data-testid="prodi-form-submit">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? 'Simpan Prodi' : 'Perbarui Prodi'}
            </ActionButton>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(detailTarget)} title="Detail Program Studi" onClose={() => setDetailTarget(null)} size="max-w-xl">
        {detailTarget ? (
          <div className="space-y-4 text-sm text-[#142B4A]">
            <div className="grid grid-cols-2 gap-3 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs">
              <div>
                <div className="text-[#64748B]">Kode</div>
                <div className="font-semibold">{detailTarget.kode}</div>
              </div>
              <div>
                <div className="text-[#64748B]">Nama</div>
                <div className="font-semibold">{detailTarget.nama}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[#64748B]">Fakultas</div>
                <div className="font-semibold">{detailTarget.fakultas_nama}</div>
              </div>
            </div>
            <div className="rounded-[6px] border border-[#1A3A6B]/20 bg-[#1A3A6B]/5 p-3 text-xs text-[#142B4A]">
              Panel ini hanya menampilkan metadata program studi. Isi CPL, IK, CPMK, nilai, dan laporan evaluasi tidak dirender di ruang kerja Super Admin.
            </div>
            <div className="flex justify-end">
              <ActionButton variant="secondary" onClick={() => setDetailTarget(null)}>Tutup</ActionButton>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="Hapus Program Studi" onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4 text-sm text-[#142B4A]">
          <p>
            Yakin ingin menghapus program studi <span className="font-semibold">{deleteTarget?.nama}</span>?
          </p>
          <p className="text-xs text-[#64748B]">
            Backend akan menolak jika masih ada user atau data akademik yang terhubung.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <ActionButton type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>Batal</ActionButton>
            <ActionButton type="button" onClick={handleDelete} disabled={deleting} data-testid="prodi-delete-confirm">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Hapus
            </ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
