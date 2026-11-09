import { Bell, LogOut, Search, SquareKanban, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import useAuth from '../hooks/useAuth'
import useToast from '../hooks/useToast'
import { Badge } from './PageChrome'
import { getRoleLabel } from '../data/demoUi'
import { useDekanScope } from '../context/DekanScopeContext'
import { SadewaMark } from './brand/SadewaLogo'

const pageTitles = {
  '/dashboard': 'Ikhtisar',
  '/peserta': 'Peserta Kuliah',
  '/mahasiswa': 'Data Mahasiswa',
  '/penilaian': 'Penilaian',
  '/nilai': 'Penilaian',
  '/analisis': 'Analitik OBE',
  '/portofolio': 'Portofolio',
  '/kurikulum/cpl': 'Capaian Pembelajaran (CPL)',
  '/kurikulum/pemetaan': 'Pemetaan IK',
  '/kurikulum/mata-kuliah': 'Mata Kuliah & Pengampu',
  '/kurikulum/cpmk': 'Capaian Pembelajaran Mata Kuliah (CPMK)',
  '/kurikulum/jenis-evaluasi': 'Jenis Evaluasi',
  '/kurikulum/bentuk-penilaian': 'Bentuk Penilaian',
  '/kurikulum': 'Kurikulum OBE',
  '/dokumen': 'Validasi Laporan',
  '/pengaturan': 'Manajemen Pengguna',
  '/aturan-penilaian': 'Aturan Penilaian',
  '/data-master/kurikulum': 'DATA MASTER > Versi Kurikulum',
  '/data-master/cpl': 'DATA MASTER > CPL',
  '/data-master/ik': 'DATA MASTER > IK',
  '/data-master/cpmk': 'DATA MASTER > CPMK',
  '/data-master/arsip': 'DATA MASTER > Arsip Kurikulum',
  '/data-master': 'DATA MASTER',
  '/super-admin/prodi': 'Daftar Prodi',
  '/super-admin/fakultas': 'Daftar Fakultas',
  '/super-admin/users': 'Manajemen Pengguna Lintas Prodi',
}

function SidebarLink({ item, active, onClick, isSubItem = false }) {
  return (
    <Link
      to={item.path}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
      className={`group flex items-center justify-between rounded-[6px] border px-3 py-2 text-sm font-medium transition-colors ${
        isSubItem ? 'pl-7 text-xs' : ''
      } ${
        active
          ? 'border-white bg-white text-[#142B4A] shadow-sm font-semibold'
          : 'border-transparent text-[#E5EDF7] hover:border-white/10 hover:bg-white/10 hover:text-white'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4A300] focus-visible:ring-offset-2 focus-visible:ring-offset-[#132D50]`}
    >
      <div className="flex items-center gap-2.5 truncate">
        <span>{item.label}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {item.badge ? (
          <span className="inline-flex h-5 items-center justify-center rounded-full bg-[#F4A300] px-1.5 text-[10px] font-bold text-[#142B4A]">
            {item.badge}
          </span>
        ) : null}
        {item.suffix ? <span className="text-[10px] text-[#C8D3E1]">{item.suffix}</span> : null}
      </div>
    </Link>
  )
}

function SidebarMenuGroup({ id, label, icon: Icon, isActive, isOpen, onToggle, subItems, pathname }) {
  return (
    <div className="space-y-1 pt-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`${id}-submenu`}
        data-testid={`nav-group-${id}`}
        className={`flex w-full items-center justify-between rounded-[6px] border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4A300] focus-visible:ring-offset-2 focus-visible:ring-offset-[#132D50] ${
          isActive
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-transparent text-[#E5EDF7] hover:border-white/10 hover:bg-white/5 hover:text-white'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-[#F4A300]" />
          <span className="truncate">{label}</span>
        </div>
        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-[#C8D3E1]" /> : <ChevronRight className="h-4 w-4 shrink-0 text-[#C8D3E1]" />}
      </button>

      {isOpen ? (
        <div id={`${id}-submenu`} className="ml-3 space-y-1 border-l border-white/10 pl-2">
          {subItems.map((subItem) => (
            <SidebarLink key={subItem.path} item={subItem} active={pathname === subItem.path} isSubItem={true} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function Navbar({ children }) {
  const { user, logout, activeRole } = useAuth()
  const { pushToast, toasts } = useToast()
  const { selectedProdi } = useDekanScope()
  const location = useLocation()
  const navigate = useNavigate()

  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isSuperAdmin = currentRole === 'super_admin'
  const isAdminProdi = currentRole === 'admin_prodi'
  const isDosen = currentRole === 'dosen'
  const isDekan = currentRole === 'dekan'

  // Admin Prodi collapsible Kurikulum group state
  const isKurikulumActive = location.pathname.startsWith('/kurikulum')
  const [isKurikulumGroupOpen, setIsKurikulumGroupOpen] = useState(true)
  const isDataMasterActive = location.pathname.startsWith('/data-master')
  const [isDataMasterGroupOpen, setIsDataMasterGroupOpen] = useState(false)

  useEffect(() => {
    if (isKurikulumActive) {
      setIsKurikulumGroupOpen(true)
    }
  }, [isKurikulumActive])

  useEffect(() => {
    if (isDataMasterActive) {
      setIsDataMasterGroupOpen(true)
    }
  }, [isDataMasterActive])

  const profileProgram = isDekan
    ? (selectedProdi ? selectedProdi.nama : 'Pilih Program Studi')
    : (user?.program_studi_nama || user?.fakultas_nama || 'Platform Administrator')
  const profileFaculty = user?.fakultas_nama || ''
  const profileCode = isDekan
    ? (selectedProdi?.kode || '')
    : (user?.program_studi_kode || user?.kode_program_studi || user?.kode_fakultas || '')

  const adminKurikulumSubItems = [
    { label: 'Capaian Pembelajaran (CPL)', path: '/kurikulum/cpl' },
    { label: 'Pemetaan IK', path: '/kurikulum/pemetaan' },
    { label: 'Mata Kuliah', path: '/kurikulum/mata-kuliah' },
    { label: 'CPMK', path: '/kurikulum/cpmk' },
    { label: 'Jenis Evaluasi', path: '/kurikulum/jenis-evaluasi' },
    { label: 'Bentuk Penilaian', path: '/kurikulum/bentuk-penilaian' },
  ]

  const dataMasterSubItems = [
    { label: 'Versi Kurikulum', path: '/data-master/kurikulum' },
    { label: 'CPL', path: '/data-master/cpl' },
    { label: 'IK', path: '/data-master/ik' },
    { label: 'CPMK', path: '/data-master/cpmk' },
    { label: 'Arsip Kurikulum', path: '/data-master/arsip' },
  ]

  const menuItems = useMemo(() => {
    if (isSuperAdmin) {
      return [
        { label: 'Daftar Prodi', path: '/super-admin/prodi' },
        { label: 'Daftar Fakultas', path: '/super-admin/fakultas' },
        { label: 'Manajemen Pengguna Lintas Prodi', path: '/super-admin/users' },
      ]
    }

    if (isDosen) {
      return [
        { label: 'Ikhtisar', path: '/dashboard' },
        { label: 'Peserta Kuliah', path: '/peserta' },
        { label: 'Penilaian', path: '/penilaian' },
        { label: 'Analitik OBE', path: '/analisis' },
        { label: 'Portofolio', path: '/portofolio' },
        { label: 'Data Master', path: '/data-master' },
        {
          label: 'Kurikulum OBE',
          path: '/kurikulum',
          suffix: 'Mode Lihat',
        },
        {
          label: 'Laporan Saya',
          path: '/dokumen',
        },
      ]
    }

    if (isAdminProdi) {
      return [
        { label: 'Ikhtisar', path: '/dashboard' },
        { label: 'Peserta Kuliah', path: '/peserta' },
        { label: 'Data Mahasiswa', path: '/mahasiswa' },
        { label: 'Data Master', path: '/data-master' },
        // Kurikulum OBE is rendered separately as collapsible group.
        // Analitik OBE sengaja tidak ada: wewenang Dosen, Kaprodi, dan Dekan.
        { label: 'Aturan Penilaian', path: '/aturan-penilaian' },
        { label: 'Validasi Laporan', path: '/dokumen' },
        { label: 'Manajemen Pengguna', path: '/pengaturan' },
      ]
    }

    const baseMenus = [
      { label: 'Ikhtisar', path: '/dashboard' },
      { label: 'Analitik OBE', path: '/analisis' },
      { label: 'Portofolio', path: '/portofolio', suffix: 'Mode Lihat' },
      { label: 'Data Master', path: '/data-master' },
      {
        label: 'Kurikulum OBE',
        path: '/kurikulum',
        suffix: currentRole === 'kaprodi' || currentRole === 'dekan' ? 'Mode Lihat' : undefined,
      },
      {
        label: 'Validasi Laporan',
        path: '/dokumen',
        suffix: currentRole === 'dekan' ? 'Mode Lihat' : undefined,
      },
    ]

    return baseMenus
  }, [currentRole, isAdminProdi, isDosen, isSuperAdmin])

  const activePage = useMemo(() => {
    const matched = Object.keys(pageTitles)
      .sort((left, right) => right.length - left.length)
      .find((path) => location.pathname.startsWith(path))
    if (isDosen && matched === '/dokumen') return 'Laporan Saya'
    return pageTitles[matched] || 'Ikhtisar'
  }, [location.pathname, isDosen])

  const handleLogout = () => {
    logout()
    navigate('/login')
    pushToast('Sesi SADEWA berakhir')
  }

  return (
    <div className="min-h-screen bg-background text-[#142B4A]">
      {/* Sidebar Desktop 248px */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-[#223E63] bg-[#132D50] text-white">
        {/* Brand Header */}
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <SadewaMark size={40} variant="onDark" className="shrink-0" />
            <div>
              <div className="text-lg font-bold tracking-tight">SADEWA</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#C8D3E1]">
                Institutional
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#D7E0EB]">
            Sistem Analisis Data Evaluasi Wawasan Akademik
          </p>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          <div className="space-y-1.5">
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#93A7C3]">
              {isSuperAdmin ? 'Ruang Kerja Super Admin' : 'Ruang Kerja'}
            </div>

            {isAdminProdi ? (
              <>
                {/* Standard Admin Prodi top items */}
                {menuItems.slice(0, 3).map((item) => (
                  <SidebarLink
                    key={`${item.path}-${item.label}`}
                    item={item}
                    active={location.pathname === item.path}
                  />
                ))}

                <SidebarMenuGroup
                  id="data-master"
                  label="Data Master"
                  icon={Layers}
                  isActive={isDataMasterActive}
                  isOpen={isDataMasterGroupOpen}
                  onToggle={() => setIsDataMasterGroupOpen((prev) => !prev)}
                  subItems={dataMasterSubItems}
                  pathname={location.pathname}
                />

                <SidebarMenuGroup
                  id="kurikulum"
                  label="Kurikulum OBE"
                  icon={Layers}
                  isActive={isKurikulumActive}
                  isOpen={isKurikulumGroupOpen}
                  onToggle={() => setIsKurikulumGroupOpen((prev) => !prev)}
                  subItems={adminKurikulumSubItems}
                  pathname={location.pathname}
                />

                {/* Remaining Admin Prodi items */}
                {menuItems.slice(3).filter((item) => item.path !== '/data-master').map((item) => (
                  <SidebarLink
                    key={`${item.path}-${item.label}`}
                    item={item}
                    active={location.pathname === item.path}
                  />
                ))}
              </>
            ) : (
              menuItems.map((item) => (
                item.path === '/data-master' ? (
                  <SidebarMenuGroup
                    key={item.path}
                    id="data-master"
                    label="Data Master"
                    icon={Layers}
                    isActive={isDataMasterActive}
                    isOpen={isDataMasterGroupOpen}
                    onToggle={() => setIsDataMasterGroupOpen((prev) => !prev)}
                    subItems={dataMasterSubItems}
                    pathname={location.pathname}
                  />
                ) : (
                  <SidebarLink
                    key={`${item.path}-${item.label}`}
                    item={item}
                    active={
                      location.pathname === item.path ||
                      (item.path === '/portofolio' && location.pathname.startsWith('/portofolio/'))
                    }
                  />
                )
              ))
            )}
          </div>

          {!isSuperAdmin ? (
            <div className="mt-4 rounded-[6px] border border-white/10 bg-white/5 p-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#93A7C3]">
                Program Studi
              </div>
              <div className="mt-1.5 text-sm font-semibold truncate">{profileProgram}</div>
              <div className="mt-0.5 text-xs text-[#D7E0EB] truncate">{profileFaculty || ' '}</div>
              <div className="mt-2.5 flex items-center gap-2">
                {profileCode ? (
                  <span className="rounded-[4px] bg-[#F4A300] px-1.5 py-0.5 text-[10px] font-bold text-[#142B4A]">
                    {profileCode}
                  </span>
                ) : null}
                <span className="text-[11px] text-[#C8D3E1]">Tahun Berjalan</span>
              </div>
            </div>
          ) : null}
        </nav>

        {/* User Profile Card at Sidebar Footer */}
        <div className="border-t border-white/10 p-4">
          <div className="rounded-[6px] border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#93A7C3]">
              Pengguna Aktif
            </div>
            <div className="mt-1 text-sm font-semibold truncate">{user?.nama || 'Pengguna'}</div>
            <div className="mt-0.5 flex items-center justify-between text-xs text-[#D7E0EB]">
              <span>{getRoleLabel(currentRole)}</span>
              {isSuperAdmin && (
                <span className="rounded-[3px] bg-red-500/20 px-1 py-0.2 text-[9px] font-mono text-red-200">
                  ROOT
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="ml-[248px] min-h-screen">
        {/* Topbar Header */}
        <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-[#E2E8F0] bg-white px-8">
          {/* Breadcrumbs */}
          <div className="space-y-0.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6D778E]">
              SADEWA &gt; {activePage}
            </div>
            <div className="text-xs text-[#64748B]">
              {isSuperAdmin ? 'Platform Administrator' : profileProgram} · <span className="font-medium text-[#142B4A]">{getRoleLabel(currentRole)}</span>
            </div>
          </div>

          {/* Action Zone */}
          <div className="flex items-center gap-3">
            {!isSuperAdmin && (
              <label className="relative hidden lg:block" data-testid="topbar-search">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                <input
                  type="search"
                  placeholder="Cari di SADEWA..."
                  className="h-9 w-64 rounded-[6px] border border-[#CBD5E1] bg-white pl-9 pr-3 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
                />
              </label>
            )}

            {/* Notification Bell */}
            <button
              type="button"
              aria-label="Notifikasi"
              data-testid="topbar-notification"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-[#CBD5E1] bg-white text-[#142B4A] transition-colors hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#F4A300]" />
            </button>

            {/* Role Indicator Pill */}
            <div className="hidden items-center gap-2 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs lg:flex">
              <SquareKanban className="h-3.5 w-3.5 text-[#1A3A6B]" />
              <span className="font-semibold text-[#142B4A]">{getRoleLabel(currentRole)}</span>
              {!isSuperAdmin && profileCode ? (
                <span className="rounded-[4px] border border-[#CBD5E1] bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#142B4A]">
                  {profileCode}
                </span>
              ) : null}
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              type="button"
              data-testid="logout-button"
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#142B4A]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="px-8 py-8">
          <div className="mx-auto max-w-[1460px] animate-[fadeUp_240ms_ease] space-y-8">
            {children}
          </div>
        </main>
      </div>

      {/* Toast Notification Container */}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-[6px] border px-4 py-2.5 text-xs font-medium shadow-sm transition-colors ${
              toast.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : toast.type === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
