import { useEffect, useMemo, useState } from 'react'
import {
  Users,
  Plus,
  Search,
  Filter,
  Trash2,
  BookOpen,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserCheck,
} from 'lucide-react'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import Modal from '../components/Modal'
import useDosenCourses from '../hooks/useDosenCourses'
import useToast from '../hooks/useToast'
import api from '../services/api'
import { getApiErrorMessage } from './superAdminHelpers'

export default function PesertaMataKuliahPage() {
  const { pushToast } = useToast()
  const { courses, loading: coursesLoading } = useDosenCourses()

  const [selectedMkId, setSelectedMkId] = useState('')
  const [pesertaList, setPesertaList] = useState([])
  const [mahasiswaList, setMahasiswaList] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [kelasFilter, setKelasFilter] = useState('ALL')

  // Modal State
  const [openAddModal, setOpenAddModal] = useState(false)
  const [openDeleteModal, setOpenDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Form State
  const [form, setForm] = useState({
    mahasiswa_id: '',
    kelas: 'A',
  })

  // Set default selected course
  useEffect(() => {
    if (courses.length > 0 && !selectedMkId) {
      setSelectedMkId(courses[0].id)
    }
  }, [courses, selectedMkId])

  // Fetch Master Mahasiswa for lookup & dropdown
  useEffect(() => {
    api
      .get('/mahasiswa')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setMahasiswaList(res.data)
        }
      })
      .catch(() => {
        // Fallback demo mahasiswa jika backend kosong/offline
        setMahasiswaList([
          { id: 1, nim: '24060121120001', nama: 'Andi Santoso', semester_aktif: 3, status_masuk: 'Reguler' },
          { id: 2, nim: '24060121120002', nama: 'Budi Kurniawan', semester_aktif: 3, status_masuk: 'Reguler' },
          { id: 3, nim: '24060121120003', nama: 'Citra Kirana', semester_aktif: 3, status_masuk: 'Reguler' },
          { id: 4, nim: '24060121120004', nama: 'Dewi Lestari', semester_aktif: 3, status_masuk: 'Reguler' },
          { id: 5, nim: '24060121120005', nama: 'Eko Prasetyo', semester_aktif: 3, status_masuk: 'Reguler' },
        ])
      })
  }, [])

  // Map mahasiswa_id -> Mahasiswa object
  const mahasiswaMap = useMemo(() => {
    const map = new Map()
    mahasiswaList.forEach((m) => map.set(Number(m.id), m))
    return map
  }, [mahasiswaList])

  // Fetch Peserta whenever selected course changes
  const fetchPeserta = async () => {
    if (!selectedMkId) return
    setLoading(true)
    try {
      const res = await api.get('/peserta-mata-kuliah', {
        params: { mata_kuliah_id: selectedMkId },
      })
      if (Array.isArray(res.data)) {
        setPesertaList(res.data)
      } else {
        setPesertaList([])
      }
    } catch (err) {
      console.warn('Gagal memuat peserta:', err)
      // Demo fallback jika belum ada data riil
      setPesertaList([
        { id: 101, mata_kuliah_id: Number(selectedMkId), mahasiswa_id: 1, kelas: 'A' },
        { id: 102, mata_kuliah_id: Number(selectedMkId), mahasiswa_id: 2, kelas: 'A' },
        { id: 103, mata_kuliah_id: Number(selectedMkId), mahasiswa_id: 3, kelas: 'B' },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPeserta()
  }, [selectedMkId])

  const currentCourse = useMemo(() => {
    return courses.find((c) => String(c.id) === String(selectedMkId)) || null
  }, [courses, selectedMkId])

  // Extract unique classes
  const availableClasses = useMemo(() => {
    const set = new Set()
    pesertaList.forEach((p) => {
      if (p.kelas) set.add(p.kelas)
    })
    return Array.from(set).sort()
  }, [pesertaList])

  // Filtered Peserta
  const filteredPeserta = useMemo(() => {
    return pesertaList.filter((p) => {
      const mhs = mahasiswaMap.get(Number(p.mahasiswa_id))
      const searchTarget = `${mhs?.nim || ''} ${mhs?.nama || ''} ${p.kelas || ''}`.toLowerCase()
      const matchesSearch = !search || searchTarget.includes(search.toLowerCase().trim())
      const matchesKelas = kelasFilter === 'ALL' || p.kelas === kelasFilter
      return matchesSearch && matchesKelas
    })
  }, [pesertaList, mahasiswaMap, search, kelasFilter])

  // Handlers
  const handleOpenAdd = () => {
    setForm({ mahasiswa_id: '', kelas: 'A' })
    setFormError('')
    setOpenAddModal(true)
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!form.mahasiswa_id) {
      setFormError('Silakan pilih mahasiswa')
      return
    }

    if (!form.kelas?.trim()) {
      setFormError('Kelas wajib diisi')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/peserta-mata-kuliah', {
        mata_kuliah_id: Number(selectedMkId),
        mahasiswa_id: Number(form.mahasiswa_id),
        kelas: form.kelas.trim().toUpperCase(),
      })

      pushToast('Mahasiswa berhasil didaftarkan sebagai peserta')
      setOpenAddModal(false)
      fetchPeserta()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal mendaftarkan peserta mata kuliah')
      setFormError(msg)
      pushToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    try {
      await api.delete(`/peserta-mata-kuliah/${deleteTarget.id}`)
      pushToast('Peserta mata kuliah berhasil dihapus')
      setOpenDeleteModal(false)
      setDeleteTarget(null)
      fetchPeserta()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal menghapus peserta mata kuliah')
      pushToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 animate-[fadeUp_200ms_ease]">
      <PageHeader
        eyebrow="Manajemen Kelas & Peserta"
        title="Peserta Mata Kuliah"
        description="Kelola pendaftaran mahasiswa ke mata kuliah yang Anda ampu, pisahkan per kelas paralel, dan pantau kelengkapan peserta."
        actions={
          <ActionButton
            onClick={handleOpenAdd}
            disabled={!selectedMkId}
            data-testid="btn-tambah-peserta"
          >
            <Plus className="h-4 w-4" />
            Daftarkan Mahasiswa
          </ActionButton>
        }
      />

      {/* Course Selector & Stat Cards */}
      <div className="grid gap-4 xl:grid-cols-4">
        <SectionCard className="xl:col-span-2" title="Mata Kuliah Yang Diampu">
          <div className="space-y-3">
            <label className="text-xs font-semibold text-[#64748B]">
              Pilih Mata Kuliah yang Anda Ampu:
            </label>
            {coursesLoading ? (
              <div className="h-10 animate-pulse rounded border border-[#E2E8F0] bg-[#F8FAFC]" />
            ) : courses.length === 0 ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Anda belum terdaftar sebagai pengampu pada mata kuliah manapun.
              </div>
            ) : (
              <select
                value={selectedMkId}
                onChange={(e) => setSelectedMkId(e.target.value)}
                data-testid="select-mata-kuliah"
                className="w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.kode} - {c.nama} ({c.sks} SKS · Semester {c.semester})
                  </option>
                ))}
              </select>
            )}

            {currentCourse && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge tone="default">{currentCourse.kode}</Badge>
                <Badge tone="default">{currentCourse.sks} SKS</Badge>
                <Badge tone="default">Semester {currentCourse.semester}</Badge>
                {currentCourse.tahun_ajaran && (
                  <Badge tone="default">TA {currentCourse.tahun_ajaran}</Badge>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        <StatCard
          label="Total Peserta"
          value={pesertaList.length}
          caption="Mahasiswa terdaftar"
          icon={<Users className="h-4 w-4" />}
          accent="text-[#1A3A6B]"
        />

        <StatCard
          label="Kelas Paralel"
          value={availableClasses.length || 1}
          caption={availableClasses.join(', ') || 'Kelas A'}
          icon={<BookOpen className="h-4 w-4" />}
          accent="text-[#F4A300]"
        />
      </div>

      {/* Main Table Section */}
      <SectionCard
        title="Daftar Mahasiswa Terdaftar"
        description="Filter berdasarkan kelas atau cari nama/NIM mahasiswa."
        action={
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari NIM atau nama..."
                data-testid="input-search-peserta"
                className="h-8.5 w-48 rounded-[6px] border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
              />
            </div>

            {/* Filter Kelas */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-[#64748B]" />
              <select
                value={kelasFilter}
                onChange={(e) => setKelasFilter(e.target.value)}
                data-testid="filter-kelas"
                className="h-8.5 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              >
                <option value="ALL">Semua Kelas</option>
                {availableClasses.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        {loading ? (
          <div className="space-y-3 py-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-[#F8FAFC]" />
            ))}
          </div>
        ) : filteredPeserta.length === 0 ? (
          <div className="py-12 text-center" data-testid="peserta-empty-state">
            <UserCheck className="mx-auto h-10 w-10 text-[#94A3B8]" />
            <h4 className="mt-2 text-sm font-semibold text-[#142B4A]">Belum Ada Peserta</h4>
            <p className="mt-1 text-xs text-[#64748B]">
              Belum ada mahasiswa yang didaftarkan ke mata kuliah ini.
            </p>
            <div className="mt-4">
              <ActionButton onClick={handleOpenAdd} data-testid="empty-btn-tambah">
                <Plus className="h-4 w-4" />
                Daftarkan Mahasiswa Sekarang
              </ActionButton>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="table-peserta">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                  <th className="pb-3 w-12 text-center">No</th>
                  <th className="pb-3 w-36">NIM</th>
                  <th className="pb-3">Nama Mahasiswa</th>
                  <th className="pb-3 w-28 text-center">Kelas</th>
                  <th className="pb-3 w-28 text-center">Status</th>
                  <th className="pb-3 w-24 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {filteredPeserta.map((row, idx) => {
                  const mhs = mahasiswaMap.get(Number(row.mahasiswa_id))
                  return (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-[#F8FAFC]"
                      data-testid={`row-peserta-${row.id}`}
                    >
                      <td className="py-3 text-center text-xs text-[#64748B]">{idx + 1}</td>
                      <td className="py-3 font-mono text-xs font-semibold text-[#142B4A]">
                        {mhs?.nim || `ID #${row.mahasiswa_id}`}
                      </td>
                      <td className="py-3 font-medium text-[#142B4A]">
                        {mhs?.nama || 'Mahasiswa ' + row.mahasiswa_id}
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center justify-center rounded-md bg-[#1A3A6B]/10 px-2 py-0.5 text-xs font-bold text-[#1A3A6B]">
                          {row.kelas || 'A'}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <Badge tone="success">Terdaftar</Badge>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget({ ...row, mhsNama: mhs?.nama || `ID #${row.mahasiswa_id}` })
                            setOpenDeleteModal(true)
                          }}
                          data-testid={`btn-delete-peserta-${row.id}`}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                          title="Hapus peserta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Modal Pendaftaran Mahasiswa */}
      <Modal
        open={openAddModal}
        onClose={() => setOpenAddModal(false)}
        title="Daftarkan Mahasiswa ke Mata Kuliah"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4" data-testid="form-tambah-peserta">
          {formError && (
            <div className="flex items-start gap-2 rounded-[6px] border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#64748B]">Mata Kuliah</label>
            <div className="mt-1 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#142B4A]">
              {currentCourse ? `${currentCourse.kode} - ${currentCourse.nama}` : '-'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748B]">Pilih Mahasiswa *</label>
            <select
              value={form.mahasiswa_id}
              onChange={(e) => setForm({ ...form, mahasiswa_id: e.target.value })}
              data-testid="select-mahasiswa"
              required
              className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            >
              <option value="">-- Pilih Mahasiswa --</option>
              {mahasiswaList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nim} - {m.nama} (Semester {m.semester_aktif || '-'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748B]">Kelas Paralel *</label>
            <input
              type="text"
              value={form.kelas}
              onChange={(e) => setForm({ ...form, kelas: e.target.value.toUpperCase() })}
              placeholder="Contoh: A, B, atau C"
              data-testid="input-kelas"
              required
              maxLength={5}
              className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            />
            <p className="mt-1 text-[11px] text-[#64748B]">
              Tentukan kelas mahasiswa dalam mata kuliah ini.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <ActionButton
              type="button"
              variant="secondary"
              onClick={() => setOpenAddModal(false)}
              disabled={submitting}
            >
              Batal
            </ActionButton>
            <ActionButton type="submit" disabled={submitting} data-testid="btn-submit-peserta">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mendaftarkan...
                </>
              ) : (
                'Simpan Pendaftaran'
              )}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        open={openDeleteModal}
        onClose={() => setOpenDeleteModal(false)}
        title="Hapus Mahasiswa dari Mata Kuliah"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#64748B] leading-relaxed">
            Apakah Anda yakin ingin menghapus peserta{' '}
            <strong className="text-[#142B4A]">{deleteTarget?.mhsNama}</strong> dari kelas{' '}
            <strong>{deleteTarget?.kelas}</strong>? Nilai yang terkait dengan mahasiswa ini pada mata
            kuliah ini akan terhapus.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <ActionButton
              type="button"
              variant="secondary"
              onClick={() => setOpenDeleteModal(false)}
              disabled={submitting}
            >
              Batal
            </ActionButton>
            <ActionButton
              type="button"
              onClick={handleDeleteConfirm}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-confirm-delete-peserta"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Ya, Hapus Peserta'
              )}
            </ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
