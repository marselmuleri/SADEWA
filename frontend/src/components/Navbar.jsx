import { Bell, ChevronDown, LogOut, Search, SquareKanban, Building2, PanelLeftClose } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import useAuth from '../hooks/useAuth'
import useToast from '../hooks/useToast'
import { Badge } from './PageChrome'
import { demoProfiles, getMenuItems, getRoleLabel, roleOptions } from '../data/demoUi'

const pageTitles = {
  '/dashboard': 'Ikhtisar',
  '/analisis': 'Analitik OBE',
  '/kurikulum': 'Kurikulum OBE',
  '/dokumen': 'Laporan Saya',
  '/pengaturan': 'Manajemen Pengguna',
  '/super-admin': 'Panel Super Admin',
}

function SidebarItem({ item, active }) {
  return (
    <Link
      to={item.path}
      data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
      className={`group flex items-center justify-between rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-white bg-white text-[#142B4A]'
          : 'border-transparent text-[#E5EDF7] hover:border-white/10 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span>{item.label}</span>
      {item.badge ? <Badge tone="warning">{item.badge}</Badge> : null}
      {item.suffix ? <span className="text-[11px] text-[#C8D3E1]">{item.suffix}</span> : null}
    </Link>
  )
}

export default function Navbar({ children }) {
  const { user, logout, activeRole, switchRole } = useAuth()
  const { pushToast, toasts } = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  const currentRole = activeRole || user?.role || 'admin'
  const profile = demoProfiles[currentRole] || demoProfiles.admin
  const menuItems = useMemo(() => getMenuItems(currentRole), [currentRole])

  const activePage = pageTitles[
    Object.keys(pageTitles).find((path) => location.pathname.startsWith(path)) || '/dashboard'
  ] || 'Ikhtisar'

  const handleRoleChange = (event) => {
    switchRole(event.target.value)
    pushToast(`Lihat sebagai ${getRoleLabel(event.target.value)}`)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
    pushToast('Anda sudah keluar dari sesi SADEWA')
  }

  return (
    <div className="min-h-screen bg-background text-[#142B4A]">
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-[#223E63] bg-[#132D50] text-white">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#F4A300] text-lg font-semibold text-[#142B4A]">S</div>
            <div>
              <div className="text-lg font-semibold tracking-wide">SADEWA</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8D3E1]">Institutional</div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#D7E0EB]">Sistem Analisis Data Evaluasi Wawasan Akademik</p>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#93A7C3]">
            {currentRole === 'super_admin' ? 'Ruang Kerja Super Admin' : 'Ruang Kerja'}
          </div>
          {menuItems.map((item) => (
            <SidebarItem
              key={`${item.path}-${item.label}`}
              item={item}
              active={location.pathname === item.path}
            />
          ))}
          {currentRole === 'super_admin' ? null : (
            <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#93A7C3]">Program Studi</div>
              <div className="mt-2 text-base font-semibold">{profile.program}</div>
              <div className="mt-1 text-xs text-[#D7E0EB]">{profile.faculty}</div>
              <div className="mt-3 flex items-center gap-2">
                <Badge>{profile.code}</Badge>
                <span className="text-xs text-[#C8D3E1]">Semester aktif</span>
              </div>
            </div>
          )}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#93A7C3]">Pengguna aktif</div>
            <div className="mt-2 text-sm font-semibold">{profile.name}</div>
            <div className="mt-1 text-xs text-[#D7E0EB]">{getRoleLabel(currentRole)}</div>
          </div>
        </div>
      </aside>

      <div className="ml-[248px] min-h-screen">
        <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-[#E2E8F0] bg-white/95 px-8 backdrop-blur-sm">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6D778E]">SADEWA &gt; {activePage}</div>
            <div className="text-sm text-[#64748B]">{profile.program || 'Super Admin'} · {getRoleLabel(currentRole)}</div>
          </div>

          <div className="flex items-center gap-3">
            {currentRole === 'super_admin' ? null : (
              <label className="relative hidden lg:block" data-testid="topbar-search">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                <input
                  type="search"
                  placeholder="Cari di SADEWA..."
                  className="h-10 w-72 rounded-md border border-[#CBD5E1] bg-white pl-9 pr-3 text-sm text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20"
                />
              </label>
            )}

            <button
              type="button"
              aria-label="Notifikasi"
              data-testid="topbar-notification"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#CBD5E1] bg-white text-[#142B4A] transition-colors hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#F4A300]" />
            </button>

            <div className="hidden items-center gap-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm lg:flex">
              <SquareKanban className="h-4 w-4 text-[#1A3A6B]" />
              <span className="font-semibold text-[#142B4A]">{getRoleLabel(currentRole)}</span>
              {profile.code ? <Badge>{profile.code}</Badge> : null}
            </div>

            <label className="flex items-center gap-2 rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm">
              <Building2 className="h-4 w-4 text-[#1A3A6B]" />
              <span className="text-[#64748B]">Lihat sebagai</span>
              <select
                value={currentRole}
                onChange={handleRoleChange}
                className="bg-transparent text-sm font-semibold text-[#142B4A] outline-none"
                data-testid="role-switcher"
              >
                {roleOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
            </label>

            <button
              onClick={handleLogout}
              type="button"
              data-testid="logout-button"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1A3A6B] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142B4A]"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        <main className="px-8 py-8">
          <div className="mx-auto max-w-[1460px] animate-[fadeUp_240ms_ease] space-y-8">
            {children}
          </div>
        </main>
      </div>

      <div className="pointer-events-none fixed right-4 top-4 z-[70] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-md border px-4 py-3 text-sm shadow-sm ${toast.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}
