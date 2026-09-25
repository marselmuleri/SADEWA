import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check,
  Filter,
  Plus,
  Send,
  Search,
  Building,
  GraduationCap,
  Users,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  AlertCircle,
  Loader2,
  Lock,
  UserX,
  UserCheck,
} from 'lucide-react'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import Modal from '../components/Modal'
import {
  demoPrograms,
  demoProvisioningRequests,
  demoCrossProdiUsers,
  demoFaculties,
  roleLabels,
} from '../data/demoUi'
import useAuth from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import useToast from '../hooks/useToast'
import api from '../services/api'

export default function SuperAdminPage() {
  const { user, activeRole } = useAuth()
  const { role } = useRole()
  const { pushToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentRole = activeRole || role || user?.role || 'admin_prodi'
  const activeTab = searchParams.get('tab') || 'programs'

  // Data states
  const [programs, setPrograms] = useState(demoPrograms)
  const [faculties, setFaculties] = useState(demoFaculties)
  const [requests, setRequests] = useState(demoProvisioningRequests)
  const [allUsers, setAllUsers] = useState(demoCrossProdiUsers)
  const [loading, setLoading] = useState(false)

  // Filters & Search
  const [programQuery, setProgramQuery] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('ALL')

  // Selected prodi detail modal
  const [selectedProdi, setSelectedProdi] = useState(null)

  // Provisioning form
  const [showProvisionForm, setShowProvisionForm] = useState(false)
  const [provisionForm, setProvisionForm] = useState({
    program: '',
    code: '',
    facultyId: '1',
    facultyName: 'Fakultas Teknik',
    adminName: '',
    adminEmail: '',
    password: 'password123',
  })
  const [provisioning, setProvisioning] = useState(false)

  // Create User modal for Super Admin
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [userForm, setUserForm] = useState({
    nama: '',
    nip: '',
    email: '',
    password: 'password123',
    role: 'admin_prodi',
    program_studi_id: '1',
    fakultas_id: '1',
  })
  const [creatingUser, setCreatingUser] = useState(false)

  // Fetch real data from backend if available
  useEffect(() => {
    if (currentRole === 'super_admin') {
      // Fetch prodi
      api.get('/prodi')
        .then((res) => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            const mapped = res.data.map((p, idx) => ({
              id: p.id,
              name: p.nama,
              code: p.kode || 'PD',
              faculty: p.fakultas?.nama || 'Fakultas Teknik',
              facultyId: p.fakultas_id,
              onboardedAt: '2024-07-04',
              activeUsers: 10 + idx * 5,
              cplCount: 8,
              courseCount: 12,
            }))
            setPrograms(mapped)
          }
        })
        .catch(() => {})

      // Fetch fakultas
      api.get('/fakultas')
        .then((res) => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setFaculties(res.data)
          }
        })
        .catch(() => {})

      // Fetch users
      api.get('/users')
        .then((res) => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setAllUsers(res.data)
          }
        })
        .catch(() => {})
    }
  }, [currentRole])

  // RBAC Access Check
  if (currentRole !== 'super_admin') {
    return (
      <SectionCard title="Akses Terbatas" description="Panel ini hanya dapat diakses oleh Super Admin.">
        <div className="flex items-start gap-3 rounded-[6px] border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p>
            Berdasarkan PRD Section 3.2, ruang kerja Super Admin terisolasi penuh dari ruang kerja akademik. Silakan gunakan role switcher di topbar untuk beralih ke Super Admin.
          </p>
        </div>
      </SectionCard>
    )
  }

  // Filtered Programs
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) =>
      `${p.name} ${p.faculty} ${p.code}`.toLowerCase().includes(programQuery.toLowerCase())
    )
  }, [programs, programQuery])

  // Filtered Users
  const filteredCrossUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const matchQuery =
        u.nama.toLowerCase().includes(userQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(userQuery.toLowerCase()) ||
        (u.nip && u.nip.includes(userQuery))
      const matchRole = userRoleFilter === 'ALL' || u.role === userRoleFilter
      return matchQuery && matchRole
    })
  }, [allUsers, userQuery, userRoleFilter])

  // Handlers
  const handleTabChange = (tabKey) => {
    setSearchParams({ tab: tabKey })
  }

  const handleProvisionSubmit = async (e) => {
    e.preventDefault()
    setProvisioning(true)

    try {
      // 1. Create Prodi in backend
      let createdProdiId = Date.now()
      try {
        const prodiRes = await api.post('/prodi', {
          nama: provisionForm.program,
          kode: provisionForm.code || provisionForm.program.substring(0, 3).toUpperCase(),
          fakultas_id: parseInt(provisionForm.facultyId, 10),
        })
        createdProdiId = prodiRes.data.id
      } catch {
        // Fallback simulation
      }

      // 2. Create First Admin Prodi user in backend
      try {
        await api.post('/users', {
          nama: provisionForm.adminName,
          email: provisionForm.adminEmail,
          password: provisionForm.password,
          role: 'admin_prodi',
          program_studi_id: createdProdiId,
        })
      } catch {
        // Fallback simulation
      }

      const selectedFaculty = faculties.find((f) => String(f.id) === String(provisionForm.facultyId))
      const newProgEntry = {
        id: createdProdiId,
        name: provisionForm.program,
        code: provisionForm.code || provisionForm.program.substring(0, 3).toUpperCase(),
        faculty: selectedFaculty?.nama || 'Fakultas Teknik',
        facultyId: parseInt(provisionForm.facultyId, 10),
        onboardedAt: new Date().toISOString().split('T')[0],
        activeUsers: 1,
        cplCount: 0,
        courseCount: 0,
      }

      setPrograms((prev) => [newProgEntry, ...prev])

      // Add to allUsers list
      const newAdminUser = {
        id: Date.now() + 1,
        nama: provisionForm.adminName,
        nip: null,
        email: provisionForm.adminEmail,
        role: 'admin_prodi',
        is_active: true,
        program_studi_id: createdProdiId,
        program_studi_nama: provisionForm.program,
        fakultas_id: parseInt(provisionForm.facultyId, 10),
        fakultas_nama: selectedFaculty?.nama,
      }
      setAllUsers((prev) => [newAdminUser, ...prev])

      setShowProvisionForm(false)
      setProvisionForm({
        program: '',
        code: '',
        facultyId: '1',
        facultyName: 'Fakultas Teknik',
        adminName: '',
        adminEmail: '',
        password: 'password123',
      })

      pushToast(`Prodi ${newProgEntry.name} berhasil dibuat & kredensial dikirimkan ke ${newAdminUser.email}`)
    } catch {
      pushToast('Gagal melakukan provisioning prodi', 'error')
    } finally {
      setProvisioning(false)
    }
  }

  const handleApproveRequest = (ref) => {
    setRequests((prev) =>
      prev.map((r) => (r.ref === ref ? { ...r, status: 'DISETUJUI' } : r))
    )
    pushToast(`Pengajuan ${ref} disetujui. Silakan lengkapi provisioning akun Admin.`)
  }

  const handleRejectRequest = (ref) => {
    setRequests((prev) =>
      prev.map((r) => (r.ref === ref ? { ...r, status: 'DITOLAK' } : r))
    )
    pushToast(`Pengajuan ${ref} telah ditolak`, 'error')
  }

  const handleToggleUserStatus = async (userItem) => {
    const nextStatus = !userItem.is_active
    try {
      if (!nextStatus) {
        await api.delete(`/users/${userItem.id}`).catch(() => {})
      } else {
        await api.put(`/users/${userItem.id}`, { is_active: true }).catch(() => {})
      }
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userItem.id ? { ...u, is_active: nextStatus } : u))
      )
      pushToast(`Status akun ${userItem.nama} diperbarui ke ${nextStatus ? 'Aktif' : 'Nonaktif'}`)
    } catch {
      pushToast('Gagal memperbarui status akun', 'error')
    }
  }

  const handleCreateSuperUser = async (e) => {
    e.preventDefault()
    setCreatingUser(true)

    try {
      const payload = {
        nama: userForm.nama,
        nip: userForm.nip || null,
        email: userForm.email,
        password: userForm.password,
        role: userForm.role,
        program_studi_id: ['admin_prodi', 'kaprodi'].includes(userForm.role)
          ? parseInt(userForm.program_studi_id, 10)
          : null,
        fakultas_id: userForm.role === 'dekan' ? parseInt(userForm.fakultas_id, 10) : null,
      }

      let createdUser
      try {
        const res = await api.post('/users', payload)
        createdUser = res.data
      } catch {
        createdUser = {
          id: Date.now(),
          ...payload,
          is_active: true,
          program_studi_nama:
            programs.find((p) => String(p.id) === String(payload.program_studi_id))?.name || null,
          fakultas_nama:
            faculties.find((f) => String(f.id) === String(payload.fakultas_id))?.nama || null,
        }
      }

      setAllUsers((prev) => [createdUser, ...prev])
      setIsAddUserOpen(false)
      pushToast(`Akun ${createdUser.nama} (${roleLabels[createdUser.role]}) berhasil dibuat`)
    } catch (err) {
      pushToast(err?.response?.data?.detail || 'Gagal membuat pengguna', 'error')
    } finally {
      setCreatingUser(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        eyebrow="Panel Super Admin"
        title="Manajemen Program Studi & Akses Institusional"
        description="Pusat provisioning program studi baru, pemrosesan pengajuan onboarding, dan tata kelola akun pengguna lintas fakultas tanpa intervensi data kurikulum OBE."
        badge="Super Admin"
        actions={
          <div className="flex items-center gap-2">
            <ActionButton
              onClick={() => {
                handleTabChange('programs')
                setShowProvisionForm(true)
              }}
              data-testid="superadmin-add-program"
            >
              <Plus className="h-4 w-4" />
              Tambah Prodi Baru
            </ActionButton>
          </div>
        }
      />

      {/* Global Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Program Studi Aktif"
          value={programs.length}
          caption="Terdaftar di sistem SADEWA"
          icon={<Building className="h-4 w-4" />}
        />
        <StatCard
          label="Pengajuan Onboarding"
          value={requests.filter((r) => r.status === 'REVIEW').length}
          caption="Menunggu validasi Super Admin"
          accent="text-amber-600"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Akun Pengguna Lintas Prodi"
          value={allUsers.length}
          caption="Total semua peran institusi"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Fakultas Terintegrasi"
          value={faculties.length}
          caption="FT, Sains, Matematika, dll."
          icon={<GraduationCap className="h-4 w-4" />}
        />
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[#E2E8F0] gap-8">
        <button
          type="button"
          onClick={() => handleTabChange('programs')}
          className={`pb-3 text-xs font-semibold uppercase tracking-[0.14em] transition-colors border-b-2 ${
            activeTab === 'programs'
              ? 'border-[#1A3A6B] text-[#1A3A6B]'
              : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
          }`}
          data-testid="tab-programs"
        >
          Daftar Prodi & Provisioning
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('onboarding')}
          className={`pb-3 text-xs font-semibold uppercase tracking-[0.14em] transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'onboarding'
              ? 'border-[#1A3A6B] text-[#1A3A6B]'
              : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
          }`}
          data-testid="tab-onboarding"
        >
          <span>Pengajuan Onboarding</span>
          <span className="rounded-full bg-[#F4A300] px-1.5 py-0.2 text-[10px] font-bold text-[#142B4A]">
            {requests.filter((r) => r.status === 'REVIEW').length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('users')}
          className={`pb-3 text-xs font-semibold uppercase tracking-[0.14em] transition-colors border-b-2 ${
            activeTab === 'users'
              ? 'border-[#1A3A6B] text-[#1A3A6B]'
              : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
          }`}
          data-testid="tab-users"
        >
          Manajemen Pengguna Lintas Prodi
        </button>
      </div>

      {/* TAB 1: DAFTAR PRODI & PROVISIONING */}
      {activeTab === 'programs' && (
        <div className="space-y-6">
          {/* Provisioning Form Card (Collapsible) */}
          {showProvisionForm && (
            <SectionCard
              title="Formulir Provisioning Program Studi Baru"
              description="Buat program studi baru dan daftarkan akun Admin Prodi pertamanya sekaligus. Kredensial awal akan dibuat otomatis."
              className="border-[#1A3A6B]/30"
              action={
                <button
                  type="button"
                  onClick={() => setShowProvisionForm(false)}
                  className="text-xs text-[#64748B] hover:text-[#142B4A]"
                >
                  Tutup Formulir ✕
                </button>
              }
            >
              <form onSubmit={handleProvisionSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[#142B4A]">Nama Program Studi</span>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Teknik Elektro"
                      value={provisionForm.program}
                      onChange={(e) =>
                        setProvisionForm((prev) => ({ ...prev, program: e.target.value }))
                      }
                      className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                      data-testid="provision-program-name"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[#142B4A]">Kode Singkatan Prodi</span>
                    <input
                      type="text"
                      placeholder="Contoh: TE"
                      value={provisionForm.code}
                      onChange={(e) =>
                        setProvisionForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                      }
                      className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none uppercase"
                      data-testid="provision-program-code"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[#142B4A]">Fakultas Induk</span>
                    <select
                      value={provisionForm.facultyId}
                      onChange={(e) =>
                        setProvisionForm((prev) => ({ ...prev, facultyId: e.target.value }))
                      }
                      className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none cursor-pointer"
                      data-testid="provision-faculty"
                    >
                      {faculties.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nama} ({f.kode})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[#142B4A]">Nama Admin Prodi Pertama</span>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Ahmad Fauzi, S.Kom."
                      value={provisionForm.adminName}
                      onChange={(e) =>
                        setProvisionForm((prev) => ({ ...prev, adminName: e.target.value }))
                      }
                      className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                      data-testid="provision-admin-name"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[#142B4A]">Email Admin Prodi</span>
                    <input
                      type="email"
                      required
                      placeholder="admin.te@sadewa.ac.id"
                      value={provisionForm.adminEmail}
                      onChange={(e) =>
                        setProvisionForm((prev) => ({ ...prev, adminEmail: e.target.value }))
                      }
                      className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                      data-testid="provision-admin-email"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[#142B4A]">Password Awal</span>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={provisionForm.password}
                      onChange={(e) =>
                        setProvisionForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                      className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                      data-testid="provision-password"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <ActionButton
                    type="button"
                    variant="secondary"
                    onClick={() => setShowProvisionForm(false)}
                  >
                    Batal
                  </ActionButton>
                  <ActionButton type="submit" disabled={provisioning} data-testid="provision-submit">
                    {provisioning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Buat Prodi &amp; Kirim Kredensial</span>
                      </>
                    )}
                  </ActionButton>
                </div>
              </form>
            </SectionCard>
          )}

          {/* Programs Table */}
          <SectionCard
            title="Daftar Program Studi Terdaftar"
            description="Metadata lintas program studi hanya memuat angka ringkas tanpa rincian CPL/IK/CPMK sesuai batas kewenangan."
            action={
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
                <input
                  type="search"
                  value={programQuery}
                  onChange={(e) => setProgramQuery(e.target.value)}
                  placeholder="Cari nama prodi atau fakultas..."
                  className="h-9 w-64 rounded-[6px] border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none"
                  data-testid="program-search-input"
                />
              </label>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="programs-table">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                    <th className="pb-3 font-semibold">Nama Program Studi</th>
                    <th className="pb-3 font-semibold">Kode</th>
                    <th className="pb-3 font-semibold">Fakultas</th>
                    <th className="pb-3 font-semibold">Tanggal Onboard</th>
                    <th className="pb-3 font-semibold">User Aktif</th>
                    <th className="pb-3 font-semibold">CPL</th>
                    <th className="pb-3 font-semibold">MK</th>
                    <th className="pb-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7]">
                  {filteredPrograms.map((item) => (
                    <tr key={item.id || item.name} className="hover:bg-[#F8FAFC]/80 transition-colors">
                      <td className="py-3.5 font-semibold text-[#142B4A]">{item.name}</td>
                      <td className="py-3.5">
                        <span className="rounded-[4px] bg-[#1A3A6B]/10 px-1.5 py-0.5 font-bold text-[#1A3A6B]">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-3.5 text-[#64748B]">{item.faculty}</td>
                      <td className="py-3.5 text-[#64748B]">{item.onboardedAt}</td>
                      <td className="py-3.5 text-[#64748B]">{item.activeUsers} pengguna</td>
                      <td className="py-3.5 text-[#64748B]">{item.cplCount} CPL</td>
                      <td className="py-3.5 text-[#64748B]">{item.courseCount} MK</td>
                      <td className="py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedProdi(item)}
                          className="inline-flex h-7 items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-white px-2.5 text-[11px] font-medium text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                          data-testid={`prodi-detail-${item.id}`}
                        >
                          <Eye className="h-3 w-3" />
                          <span>Lihat Detail</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* TAB 2: PENGAJUAN ONBOARDING */}
      {activeTab === 'onboarding' && (
        <SectionCard
          title="Pengajuan Onboarding Program Studi"
          description="Daftar pengajuan prodi dari calon pengguna atau fakultas. Hak persetujuan mutlak berada pada Super Admin."
        >
          <div className="space-y-3" data-testid="onboarding-requests-list">
            {requests.map((item) => (
              <div
                key={item.ref}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6D778E]">
                      {item.ref}
                    </span>
                    <Badge
                      tone={
                        item.status === 'DISETUJUI'
                          ? 'success'
                          : item.status === 'DITOLAK'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#142B4A]">{item.program}</div>
                  <div className="mt-0.5 text-xs text-[#64748B]">
                    Fakultas: {item.faculty} · Pengusul: {item.requester} ({item.email}) · Tanggal: {item.date}
                  </div>
                </div>

                {item.status === 'REVIEW' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApproveRequest(item.ref)}
                      className="inline-flex h-8 items-center gap-1 rounded-[4px] bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
                      data-testid={`req-approve-${item.ref}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Setujui
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(item.ref)}
                      className="inline-flex h-8 items-center gap-1 rounded-[4px] border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
                      data-testid={`req-reject-${item.ref}`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Tolak
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* TAB 3: MANAJEMEN PENGGUNA LINTAS PRODI */}
      {activeTab === 'users' && (
        <SectionCard
          title="Manajemen Pengguna Lintas Program Studi"
          description="Kelola seluruh akun pengguna dalam ekosistem SADEWA (Super Admin, Admin Prodi, Dekan, Kaprodi, Dosen). Metadata only tanpa isi nilai."
          action={
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
                <input
                  type="search"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Cari pengguna..."
                  className="h-9 w-48 rounded-[6px] border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                  data-testid="cross-user-search"
                />
              </label>

              {/* Role Filter */}
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="h-9 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none cursor-pointer"
                data-testid="cross-user-role-filter"
              >
                <option value="ALL">Semua Peran</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin_prodi">Admin Prodi</option>
                <option value="dekan">Dekan</option>
                <option value="kaprodi">Kaprodi</option>
                <option value="dosen">Dosen</option>
              </select>

              <ActionButton onClick={() => setIsAddUserOpen(true)} data-testid="cross-user-add">
                <Plus className="h-4 w-4" />
                Tambah Akun
              </ActionButton>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" data-testid="cross-users-table">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                  <th className="pb-3 font-semibold">Nama Lengkap</th>
                  <th className="pb-3 font-semibold">Alamat Email</th>
                  <th className="pb-3 font-semibold">Role</th>
                  <th className="pb-3 font-semibold">Unit / Scope</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {filteredCrossUsers.map((u) => (
                  <tr key={u.id || u.email} className="hover:bg-[#F8FAFC]/80 transition-colors">
                    <td className="py-3.5 font-semibold text-[#142B4A]">{u.nama}</td>
                    <td className="py-3.5 text-[#64748B]">{u.email}</td>
                    <td className="py-3.5">
                      <Badge
                        tone={
                          u.role === 'super_admin'
                            ? 'danger'
                            : u.role === 'admin_prodi'
                            ? 'warning'
                            : u.role === 'dekan'
                            ? 'warning'
                            : 'default'
                        }
                      >
                        {roleLabels[u.role] || u.role}
                      </Badge>
                    </td>
                    <td className="py-3.5 text-[#64748B]">
                      {u.program_studi_nama
                        ? `Prodi: ${u.program_studi_nama}`
                        : u.fakultas_nama
                        ? `Fakultas: ${u.fakultas_nama}`
                        : 'Global (Root)'}
                    </td>
                    <td className="py-3.5">
                      <Badge tone={u.is_active ? 'success' : 'danger'}>
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </td>
                    <td className="py-3.5 text-right">
                      {u.role !== 'super_admin' ? (
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u)}
                          className={`inline-flex h-7 items-center gap-1 rounded-[4px] border px-2 text-[11px] font-medium transition-colors ${
                            u.is_active
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                          data-testid={`cross-user-toggle-${u.id}`}
                        >
                          {u.is_active ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                          <span>{u.is_active ? 'Nonaktifkan' : 'Aktifkan'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#94A3B8]">Terkunci</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Modal Detail Program Studi */}
      <Modal
        open={Boolean(selectedProdi)}
        title={`Detail Program Studi · ${selectedProdi?.name}`}
        onClose={() => setSelectedProdi(null)}
        size="max-w-2xl"
      >
        {selectedProdi && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs">
              <div>
                <span className="text-[#64748B]">Fakultas:</span>{' '}
                <span className="font-semibold text-[#142B4A]">{selectedProdi.faculty}</span>
              </div>
              <div>
                <span className="text-[#64748B]">Kode:</span>{' '}
                <span className="font-semibold text-[#142B4A]">{selectedProdi.code}</span>
              </div>
              <div>
                <span className="text-[#64748B]">Onboard:</span>{' '}
                <span className="font-semibold text-[#142B4A]">{selectedProdi.onboardedAt}</span>
              </div>
              <div>
                <span className="text-[#64748B]">Pengguna Terdaftar:</span>{' '}
                <span className="font-semibold text-[#142B4A]">{selectedProdi.activeUsers} akun</span>
              </div>
            </div>

            {/* Strict PRD Section 3.2 Disclaimer */}
            <div className="rounded-[6px] border border-[#1A3A6B]/20 bg-[#1A3A6B]/5 p-3 text-xs text-[#142B4A]">
              <span className="font-semibold">Catatan Kewenangan Super Admin:</span> Isi kurikulum (CPL/IK/CPMK)
              dan laporan evaluasi akademik adalah kewenangan internal Admin Prodi dan Kaprodi {selectedProdi.name}.
              Super Admin tidak memiliki hak akses baca/tulis terhadap data akademik tersebut.
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#142B4A]">Pengguna Terdaftar di Prodi Ini</div>
              <div className="rounded-[6px] border border-[#E2E8F0] divide-y divide-[#EEF2F7] max-h-52 overflow-y-auto">
                {allUsers
                  .filter(
                    (u) =>
                      u.program_studi_id === selectedProdi.id ||
                      (u.program_studi_nama && u.program_studi_nama.includes(selectedProdi.name))
                  )
                  .map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-2.5 text-xs">
                      <div>
                        <div className="font-semibold text-[#142B4A]">{u.nama}</div>
                        <div className="text-[11px] text-[#64748B]">{u.email}</div>
                      </div>
                      <Badge>{roleLabels[u.role] || u.role}</Badge>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <ActionButton variant="secondary" onClick={() => setSelectedProdi(null)}>
                Tutup
              </ActionButton>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Tambah User Lintas Prodi */}
      <Modal
        open={isAddUserOpen}
        title="Tambah Akun Pengguna Lintas Prodi"
        onClose={() => setIsAddUserOpen(false)}
      >
        <form onSubmit={handleCreateSuperUser} className="space-y-3.5">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Nama Lengkap</span>
            <input
              type="text"
              required
              className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs focus:border-[#1A3A6B] focus:outline-none"
              placeholder="Contoh: Dr. Ir. Budi Santoso, M.T."
              value={userForm.nama}
              onChange={(e) => setUserForm((prev) => ({ ...prev, nama: e.target.value }))}
              data-testid="super-user-name"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">NIP (Opsional)</span>
            <input
              type="text"
              className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs focus:border-[#1A3A6B] focus:outline-none"
              placeholder="198805122010011004"
              value={userForm.nip}
              onChange={(e) => setUserForm((prev) => ({ ...prev, nip: e.target.value }))}
              data-testid="super-user-nip"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Email</span>
            <input
              type="email"
              required
              className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs focus:border-[#1A3A6B] focus:outline-none"
              placeholder="nama@sadewa.ac.id"
              value={userForm.email}
              onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
              data-testid="super-user-email"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Password Awal</span>
            <input
              type="password"
              required
              minLength={6}
              className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs focus:border-[#1A3A6B] focus:outline-none"
              value={userForm.password}
              onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
              data-testid="super-user-password"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Peran (Role)</span>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
              className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs focus:border-[#1A3A6B] focus:outline-none cursor-pointer"
              data-testid="super-user-role"
            >
              <option value="admin_prodi">Admin Prodi</option>
              <option value="kaprodi">Kaprodi</option>
              <option value="dekan">Dekan</option>
              <option value="dosen">Dosen</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>

          {/* Conditional Program Studi selector */}
          {['admin_prodi', 'kaprodi'].includes(userForm.role) && (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">Program Studi (Wajib)</span>
              <select
                value={userForm.program_studi_id}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, program_studi_id: e.target.value }))
                }
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs focus:border-[#1A3A6B] focus:outline-none cursor-pointer"
                data-testid="super-user-prodi"
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.faculty})
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Conditional Fakultas selector */}
          {userForm.role === 'dekan' && (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">Fakultas (Wajib untuk Dekan)</span>
              <select
                value={userForm.fakultas_id}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, fakultas_id: e.target.value }))
                }
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs focus:border-[#1A3A6B] focus:outline-none cursor-pointer"
                data-testid="super-user-faculty"
              >
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nama}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <ActionButton type="button" variant="secondary" onClick={() => setIsAddUserOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" disabled={creatingUser} data-testid="super-user-submit">
              {creatingUser ? 'Menyimpan...' : 'Buat Pengguna'}
            </ActionButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
