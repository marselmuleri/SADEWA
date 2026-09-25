import { Bell, ChevronDown, LogOut, Search, SquareKanban, Building2, Layers, Users, FileCheck, BookOpen, ShieldAlert } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMemo } from 'react'
import useAuth from '../hooks/useAuth'
import useToast from '../hooks/useToast'
import { Badge } from './PageChrome'
import { demoProfiles, getRoleLabel, roleOptions } from '../data/demoUi'

const pageTitles = {
  '/dashboard': 'Ikhtisar',
  '/analisis': 'Analitik OBE',
  '/kurikulum': 'Kurikulum OBE',
  '/dokumen': 'Validasi Laporan',
  '/pengaturan': 'Manajemen Pengguna',
  '/super-admin': 'Panel Super Admin',
}

function SidebarLink({ item, active, onClick }) {
  return (
    <Link
      to={item.tab ? `${item.path}?tab=${item.tab}` : item.path}
      onClick={onClick}
      data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
      className={`group flex items-center justify-between rounded-[6px] border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-white bg-white text-[#142B4A] shadow-sm font-semibold'
          : 'border-transparent text-[#E5EDF7] hover:border-white/10 hover:bg-white/10 hover:text-white'
      }`}
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

export default function Navbar({ children }) {
  const { user, logout, activeRole, switchRole } = useAuth()
  const { pushToast, toasts } = useToast()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isSuperAdmin = currentRole === 'super_admin'
  const isAdminProdi = currentRole === 'admin_prodi'
  const isDosen = currentRole === 'dosen'

  const profile = demoProfiles[currentRole] || demoProfiles.admin_prodi
  const currentTab = searchParams.get('tab') || ''

  // Academic menus
  const academicMenus = useMemo(() => {
    return [
      { label: 'Ikhtisar', path: '/dashboard' },
      { label: 'Analitik OBE', path: '/analisis' },
      {
        label: 'Kurikulum OBE',
        path: '/kurikulum',
        suffix: isDosen || currentRole === 'kaprodi' || currentRole === 'dekan' ? 'Mode Lihat' : undefined,
      },
      {
        label: isDosen ? 'Laporan Saya' : 'Validasi Laporan',
        path: '/dokumen',
      },
    ]
  }, [currentRole, isDosen])

  // Super Admin menus
  const superAdminMenus = useMemo(() => {
    return [
      { label: 'Daftar Prodi', path: '/super-admin', tab: 'programs' },
      { label: 'Pengajuan Onboarding', path: '/super-admin', tab: 'onboarding', badge: '2' },
      { label: 'Manajemen Pengguna Lintas Prodi', path: '/super-admin', tab: 'users' },
    ]
  }, [])

  const activePage = pageTitles[
    Object.keys(pageTitles).find((path) => location.pathname.startsWith(path)) || '/dashboard'
  ] || 'Ikhtisar'

  const handleRoleChange = (event) => {
    const nextRole = event.target.value
    switchRole(nextRole)
    pushToast(`Beralih tampilan ke ${getRoleLabel(nextRole)}`)

    // Role-aligned routing enforcement
    if (nextRole === 'super_admin' && !location.pathname.startsWith('/super-admin')) {
      navigate('/super-admin')
    } else if (nextRole !== 'super_admin' && location.pathname.startsWith('/super-admin')) {
      navigate('/dashboard')
    } else if (nextRole !== 'admin_prodi' && location.pathname.startsWith('/pengaturan')) {
      navigate('/dashboard')
    }
  }

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
            <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-[#F4A300] text-lg font-bold text-[#142B4A]">
              S
            </div>
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
          {isSuperAdmin ? (
            /* Super Admin Workspace (Completely isolated per PRD 3.2) */
            <div className="space-y-1.5">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#93A7C3]">
                Ruang Kerja Super Admin
              </div>
              {superAdminMenus.map((item) => {
                const isActive = location.pathname === item.path && (item.tab ? currentTab === item.tab || (!currentTab && item.tab === 'programs') : true)
                return (
                  <SidebarLink
                    key={`${item.path}-${item.tab || ''}-${item.label}`}
                    item={item}
                    active={isActive}
                  />
                )
              })}
            </div>
          ) : (
            /* Academic Workspace (Admin Prodi, Dosen, Kaprodi, Dekan) */
            <>
              <div className="space-y-1.5">
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#93A7C3]">
                  Ruang Kerja
                </div>
                {academicMenus.map((item) => (
                  <SidebarLink
                    key={`${item.path}-${item.label}`}
                    item={item}
                    active={location.pathname === item.path}
                  />
                ))}
              </div>

              {/* Administrasi Group: HANYA MUNCUL UNTUK ADMIN PRODI (DESIGN.md Section 4) */}
              {isAdminProdi && (
                <div className="space-y-1.5 border-t border-white/10 pt-4">
                  <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#93A7C3]">
                    Administrasi
                  </div>
                  <SidebarLink
                    item={{ label: 'Manajemen Pengguna', path: '/pengaturan' }}
                    active={location.pathname === '/pengaturan'}
                  />
                </div>
              )}

              {/* Program Context Card (Only for non-superadmin) */}
              <div className="mt-4 rounded-[6px] border border-white/10 bg-white/5 p-3.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#93A7C3]">
                  Program Studi
                </div>
                <div className="mt-1.5 text-sm font-semibold truncate">{profile.program}</div>
                <div className="mt-0.5 text-xs text-[#D7E0EB] truncate">{profile.faculty}</div>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="rounded-[4px] bg-[#F4A300] px-1.5 py-0.5 text-[10px] font-bold text-[#142B4A]">
                    {profile.code || 'TK'}
                  </span>
                  <span className="text-[11px] text-[#C8D3E1]">Semester 2024 Genap</span>
                </div>
              </div>
            </>
          )}
        </nav>

        {/* User Profile Card at Sidebar Footer */}
        <div className="border-t border-white/10 p-4">
          <div className="rounded-[6px] border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#93A7C3]">
              Pengguna Aktif
            </div>
            <div className="mt-1 text-sm font-semibold truncate">{user?.nama || profile.name}</div>
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
              {isSuperAdmin ? 'Platform Administrator' : profile.program} · <span className="font-medium text-[#142B4A]">{getRoleLabel(currentRole)}</span>
            </div>
          </div>

          {/* Action Zone */}
          <div className="flex items-center gap-3">
            {/* Search: Disembunyikan pada tampilan Super Admin per DESIGN.md */}
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
              {!isSuperAdmin && profile.code ? (
                <span className="rounded-[4px] border border-[#CBD5E1] bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#142B4A]">
                  {profile.code}
                </span>
              ) : null}
            </div>

            {/* Role Switcher (Wajib untuk demo visual per DESIGN.md Section 0 & 25) */}
            <div className="flex items-center gap-2 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5 text-[#1A3A6B]" />
              <span className="text-[#64748B]">Lihat sebagai:</span>
              <select
                value={currentRole}
                onChange={handleRoleChange}
                className="bg-transparent text-xs font-semibold text-[#142B4A] outline-none cursor-pointer"
                data-testid="role-switcher"
              >
                {roleOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-[#94A3B8]" />
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
            className={`pointer-events-auto flex items-center gap-2 rounded-[6px] border px-4 py-2.5 text-xs font-medium shadow-sm transition-all ${
              toast.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
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
