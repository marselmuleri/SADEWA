import { useEffect, useMemo, useState } from 'react'
import { Building2, Loader2, Plus, Search, Pencil, Trash2, Shield, UserCog } from 'lucide-react'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import Modal from '../components/Modal'
import useToast from '../hooks/useToast'
import api from '../services/api'
import { getApiErrorMessage, toId } from './superAdminHelpers'

const roleOptions = [
  { value: 'admin_prodi', label: 'Admin Prodi' },
  { value: 'dekan', label: 'Dekan' },
]

const emptyForm = {
  nama: '',
  nip: '',
  email: '',
  password: '',
  role: 'admin_prodi',
  fakultas_id: '',
  program_studi_id: '',
  is_active: true,
}

function normalizeFaculty(item) {
  return {
    id: item.id,
    kode: item.kode || '',
    nama: item.nama || item.name || '',
  }
}

function normalizeProdi(item, faculties = []) {
  const fakultasId = item.fakultas_id ?? item.fakultas?.id ?? null
  return {
    id: item.id,
    kode: item.kode || '',
    nama: item.nama || item.name || '',
    fakultas_id: fakultasId,
    fakultas_nama: item.fakultas?.nama || item.fakultas_nama || faculties.find((faculty) => String(faculty.id) === String(fakultasId))?.nama || '',
  }
}

function normalizeUser(item, faculties = [], prodi = []) {
  const fakultasId = item.fakultas_id ?? null
  const prodiId = item.program_studi_id ?? null
  return {
    id: item.id,
    nama: item.nama || '',
    nip: item.nip || '',
    email: item.email || '',
    role: item.role || '',
    is_active: Boolean(item.is_active),
    fakultas_id: fakultasId,
    fakultas_nama: item.fakultas_nama || faculties.find((faculty) => String(faculty.id) === String(fakultasId))?.nama || '',
    program_studi_id: prodiId,
    program_studi_nama: item.program_studi_nama || prodi.find((row) => String(row.id) === String(prodiId))?.nama || '',
    raw: item,
  }
}

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, index) => (
    <tr key={index} className="animate-pulse border-b border-[#F2F4F7]">
      <td className="py-4"><div className="h-4 w-40 rounded bg-[#E2E8F0]" /></td>
      <td className="py-4"><div className="h-4 w-44 rounded bg-[#E2E8F0]" /></td>
      <td className="py-4"><div className="h-4 w-24 rounded bg-[#E2E8F0]" /></td>
      <td className="py-4"><div className="h-4 w-36 rounded bg-[#E2E8F0]" /></td>
      <td className="py-4 text-right"><div className="ml-auto h-8 w-44 rounded bg-[#E2E8F0]" /></td>
    </tr>
  ))
}

export default function UserManagementSAPage() {
  const { pushToast } = useToast()
  const [users, setUsers] = useState([])
  const [faculties, setFaculties] = useState([])
  const [prodi, setProdi] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [mode, setMode] = useState('create')
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [target, setTarget] = useState(null)
  const [facultyFilter, setFacultyFilter] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})

  const loadData = async () => {
    setLoading(true)
    try {
      const [userRes, facultyRes, prodiRes] = await Promise.all([api.get('/users'), api.get('/fakultas'), api.get('/prodi')])
      const facultyData = Array.isArray(facultyRes.data) ? facultyRes.data.map(normalizeFaculty) : []
      const prodiData = Array.isArray(prodiRes.data) ? prodiRes.data.map((item) => normalizeProdi(item, facultyData)) : []
      setFaculties(facultyData)
      setProdi(prodiData)
      setUsers(Array.isArray(userRes.data) ? userRes.data.map((item) => normalizeUser(item, facultyData, prodiData)) : [])
    } catch {
      setUsers([])
      setFaculties([])
      setProdi([])
      pushToast('Gagal memuat daftar pengguna Super Admin', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const query = search.toLowerCase().trim()
      const matchSearch = !query || `${user.nama} ${user.email} ${user.nip}`.toLowerCase().includes(query)
      const matchRole = roleFilter === 'ALL' || user.role === roleFilter
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && user.is_active) ||
        (statusFilter === 'INACTIVE' && !user.is_active)
      return matchSearch && matchRole && matchStatus
    })
  }, [users, search, roleFilter, statusFilter])

  const adminProdiCount = users.filter((user) => user.role === 'admin_prodi').length
  const dekanCount = users.filter((user) => user.role === 'dekan').length
  const activeCount = users.filter((user) => user.is_active).length

  const openCreate = () => {
    setMode('create')
    setTarget(null)
    setForm(emptyForm)
    setFacultyFilter('')
    setFieldErrors({})
    setFormOpen(true)
  }

  const openEdit = (user) => {
    setMode('edit')
    setTarget(user)
    setFacultyFilter(user.fakultas_id || '')
    setFieldErrors({})
    setForm({
      nama: user.nama,
      nip: user.nip || '',
      email: user.email || '',
      password: '',
      role: user.role,
      fakultas_id: user.fakultas_id || '',
      program_studi_id: user.program_studi_id || '',
      is_active: user.is_active,
    })
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setTarget(null)
    setFieldErrors({})
    setForm(emptyForm)
    setFacultyFilter('')
  }

  const availableProdi = useMemo(() => {
    if (!facultyFilter) return prodi
    return prodi.filter((item) => String(item.fakultas_id) === String(facultyFilter))
  }, [prodi, facultyFilter])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setFieldErrors({})

    try {
      const payload = {
        nama: form.nama.trim(),
        nip: form.nip.trim() || null,
        email: form.email.trim(),
        role: form.role,
        password: form.password,
      }

      if (!payload.nama) {
        setFieldErrors({ nama: 'Nama wajib diisi' })
        setSubmitting(false)
        return
      }
      if (!payload.email) {
        setFieldErrors({ email: 'Email wajib diisi' })
        setSubmitting(false)
        return
      }
      if (mode === 'create' && !payload.password) {
        setFieldErrors({ password: 'Password wajib diisi' })
        setSubmitting(false)
        return
      }

      if (form.role === 'admin_prodi') {
        if (!form.program_studi_id) {
          setFieldErrors({ program_studi_id: 'Program Studi wajib dipilih' })
          setSubmitting(false)
          return
        }
        payload.program_studi_id = toId(form.program_studi_id)
      } else if (form.role === 'dekan') {
        if (!form.fakultas_id) {
          setFieldErrors({ fakultas_id: 'Fakultas wajib dipilih' })
          setSubmitting(false)
          return
        }
        payload.fakultas_id = toId(form.fakultas_id)
      }

      const { data } = mode === 'create'
        ? await api.post('/users', payload)
        : await api.put(`/users/${target.id}`, {
            nama: payload.nama,
            nip: payload.nip,
            email: payload.email,
            role: payload.role,
            ...(payload.password ? { password: payload.password } : {}),
            is_active: form.is_active,
            ...(form.role === 'admin_prodi' ? { program_studi_id: payload.program_studi_id, fakultas_id: null } : {}),
            ...(form.role === 'dekan' ? { fakultas_id: payload.fakultas_id, program_studi_id: null } : {}),
          })

      const saved = normalizeUser(data, faculties, prodi)
      setUsers((current) => {
        if (mode === 'create') return [saved, ...current]
        return current.map((item) => (item.id === saved.id ? saved : item))
      })
      pushToast(`Akun ${saved.nama} berhasil ${mode === 'create' ? 'dibuat' : 'diperbarui'}`)
      closeForm()
    } catch (error) {
      const detail = getApiErrorMessage(error, 'Gagal menyimpan pengguna')
      if (String(detail).toLowerCase().includes('email')) {
        setFieldErrors({ email: detail })
      } else {
        pushToast(detail, 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/users/${deleteTarget.id}`)
      setUsers((current) => current.map((item) => (item.id === deleteTarget.id ? { ...item, is_active: false } : item)))
      pushToast(`Akun ${deleteTarget.nama} dinonaktifkan`)
      setDeleteTarget(null)
    } catch (error) {
      pushToast(getApiErrorMessage(error, 'Gagal menonaktifkan akun'), 'error')
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Panel Super Admin"
        title="Manajemen Pengguna Lintas Prodi"
        description="Backend hanya menerima akun Admin Prodi dan Dekan. Form ini menyesuaikan scope yang dipilih secara kondisional."
        badge="Super Admin"
        actions={
          <ActionButton onClick={openCreate} data-testid="user-create-button">
            <Plus className="h-4 w-4" />
            Tambah Pengguna
          </ActionButton>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Akun" value={users.length} caption="Akun yang dapat dikelola backend" icon={<UserCog className="h-4 w-4" />} />
        <StatCard label="Admin Prodi" value={adminProdiCount} caption="Role yang diizinkan" icon={<Shield className="h-4 w-4" />} />
        <StatCard label="Dekan" value={dekanCount} caption="Role yang diizinkan" icon={<Shield className="h-4 w-4" />} />
        <StatCard label="Akun Aktif" value={activeCount} caption={`${users.length - activeCount} akun nonaktif`} icon={<UserCog className="h-4 w-4" />} />
      </div>

      <SectionCard
        title="Tabel Pengguna"
        description="Daftar ini sudah difilter backend ke admin_prodi dan dekan. Frontend hanya memantulkan hasil backend apa adanya."
        action={
          <div className="flex items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, email, atau NIP..."
                className="h-9 w-72 rounded-[6px] border border-[#CBD5E1] bg-white pl-9 pr-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                data-testid="user-search"
              />
            </label>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="h-9 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              data-testid="user-role-filter"
            >
              <option value="ALL">Semua Role</option>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              data-testid="user-status-filter"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
            </select>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="user-table">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                <th className="pb-3 font-semibold">Nama</th>
                <th className="pb-3 font-semibold">Email</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Scope</th>
                <th className="pb-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {loading ? (
                <SkeletonRows />
              ) : filteredUsers.length ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                    <td className="py-3.5">
                      <div className="font-semibold text-[#142B4A]">{user.nama}</div>
                      <div className="text-[11px] text-[#64748B]">{user.nip || '-'}</div>
                    </td>
                    <td className="py-3.5 text-[#64748B]">{user.email}</td>
                    <td className="py-3.5">
                      <Badge tone={user.role === 'dekan' ? 'warning' : 'default'}>{user.role === 'admin_prodi' ? 'Admin Prodi' : 'Dekan'}</Badge>
                    </td>
                    <td className="py-3.5 text-[#64748B]">
                      {user.role === 'admin_prodi' ? `Prodi: ${user.program_studi_nama || '-'}` : `Fakultas: ${user.fakultas_nama || '-'}`}
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-white px-3 text-[11px] font-medium text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                          data-testid={`user-edit-${user.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(user)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-red-200 bg-white px-3 text-[11px] font-medium text-red-700 hover:bg-red-50"
                          data-testid={`user-deactivate-${user.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Nonaktifkan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[#64748B]">
                    Tidak ada akun yang cocok dengan filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Modal open={formOpen} title={mode === 'create' ? 'Tambah Pengguna' : 'Edit Pengguna'} onClose={closeForm} size="max-w-2xl">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} data-testid="user-form">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Nama Lengkap</span>
            <input
              type="text"
              value={form.nama}
              onChange={(event) => setForm((current) => ({ ...current, nama: event.target.value }))}
              className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-sm focus:border-[#1A3A6B] focus:outline-none"
              data-testid="user-form-nama"
            />
            {fieldErrors.nama ? <p className="text-xs text-red-700">{fieldErrors.nama}</p> : null}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">NIP</span>
            <input
              type="text"
              value={form.nip}
              onChange={(event) => setForm((current) => ({ ...current, nip: event.target.value }))}
              className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-sm focus:border-[#1A3A6B] focus:outline-none"
              data-testid="user-form-nip"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-sm focus:border-[#1A3A6B] focus:outline-none"
              data-testid="user-form-email"
            />
            {fieldErrors.email ? <p className="text-xs text-red-700">{fieldErrors.email}</p> : null}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Password {mode === 'edit' ? '(kosongkan jika tidak diubah)' : ''}</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-sm focus:border-[#1A3A6B] focus:outline-none"
              data-testid="user-form-password"
            />
            {fieldErrors.password ? <p className="text-xs text-red-700">{fieldErrors.password}</p> : null}
          </label>

          <label className="block space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-[#142B4A]">Role</span>
            <select
              value={form.role}
              onChange={(event) => {
                const nextRole = event.target.value
                setForm((current) => ({
                  ...current,
                  role: nextRole,
                  fakultas_id: nextRole === 'dekan' ? current.fakultas_id : '',
                  program_studi_id: nextRole === 'admin_prodi' ? current.program_studi_id : '',
                }))
                if (nextRole === 'dekan') {
                  setFacultyFilter('')
                }
              }}
              className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-sm focus:border-[#1A3A6B] focus:outline-none"
              data-testid="user-form-role"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          {form.role === 'admin_prodi' ? (
            <>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-[#142B4A]">Fakultas Penyaring</span>
                <select
                  value={facultyFilter}
                  onChange={(event) => {
                    const nextFaculty = event.target.value
                    setFacultyFilter(nextFaculty)
                    setForm((current) => ({ ...current, program_studi_id: '' }))
                  }}
                  className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-sm focus:border-[#1A3A6B] focus:outline-none"
                  data-testid="user-form-faculty-filter"
                >
                  <option value="">Pilih fakultas terlebih dahulu</option>
                  {faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>{faculty.nama} ({faculty.kode})</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-[#142B4A]">Program Studi</span>
                <select
                  value={form.program_studi_id}
                  onChange={(event) => setForm((current) => ({ ...current, program_studi_id: event.target.value }))}
                  disabled={!facultyFilter}
                  className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-sm focus:border-[#1A3A6B] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC]"
                  data-testid="user-form-prodi"
                >
                  <option value="">{facultyFilter ? 'Pilih prodi' : 'Pilih fakultas terlebih dahulu'}</option>
                  {availableProdi.map((item) => (
                    <option key={item.id} value={item.id}>{item.nama} ({item.kode})</option>
                  ))}
                </select>
                {fieldErrors.program_studi_id ? <p className="text-xs text-red-700">{fieldErrors.program_studi_id}</p> : null}
              </label>
            </>
          ) : (
            <label className="block space-y-1 md:col-span-2">
              <span className="text-xs font-semibold text-[#142B4A]">Fakultas</span>
              <select
                value={form.fakultas_id}
                onChange={(event) => setForm((current) => ({ ...current, fakultas_id: event.target.value }))}
                className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-sm focus:border-[#1A3A6B] focus:outline-none"
                data-testid="user-form-fakultas"
              >
                <option value="">Pilih fakultas</option>
                {faculties.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>{faculty.nama} ({faculty.kode})</option>
                ))}
              </select>
              {fieldErrors.fakultas_id ? <p className="text-xs text-red-700">{fieldErrors.fakultas_id}</p> : null}
            </label>
          )}

          <label className="flex items-center gap-2 md:col-span-2 text-sm text-[#142B4A]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
              className="h-4 w-4 rounded border-[#CBD5E1] text-[#1A3A6B] focus:ring-[#1A3A6B]"
              data-testid="user-form-active"
            />
            Aktif
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 md:col-span-2">
            <ActionButton type="button" variant="secondary" onClick={closeForm}>Batal</ActionButton>
            <ActionButton type="submit" disabled={submitting} data-testid="user-form-submit">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? 'Buat Pengguna' : 'Perbarui Pengguna'}
            </ActionButton>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="Nonaktifkan Akun" onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4 text-sm text-[#142B4A]">
          <p>
            Nonaktifkan akun <span className="font-semibold">{deleteTarget?.nama}</span>?
          </p>
          <p className="text-xs text-[#64748B]">
            Backend akan memproses deactivate lewat DELETE dan menolak jika akun tidak berada di wewenang Super Admin.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <ActionButton type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>Batal</ActionButton>
            <ActionButton type="button" onClick={handleDeactivate} data-testid="user-deactivate-confirm">Nonaktifkan</ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
