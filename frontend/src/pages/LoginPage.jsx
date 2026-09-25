import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LockKeyhole, ShieldCheck, University, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react'
import useAuth from '../hooks/useAuth'
import { demoCredentials, roleLabels } from '../data/demoUi'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@sadewa.ac.id')
  const [password, setPassword] = useState('admin123')
  const [selectedRole, setSelectedRole] = useState('admin_prodi')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSelectCredential = (cred) => {
    setEmail(cred.email)
    setPassword(cred.password)
    setSelectedRole(cred.role)
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await login(email, password)
      const userRole = result?.user?.role || selectedRole
      if (userRole === 'super_admin') {
        navigate('/super-admin')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err?.message || 'Email atau password tidak valid')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#142B4A] lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1340px] overflow-hidden rounded-[8px] border border-[#E2E8F0] bg-white shadow-sm lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left Branding Panel */}
        <section className="relative flex flex-col justify-between border-b border-[#223E63] bg-[#132D50] p-8 text-white lg:border-b-0 lg:border-r lg:p-12">
          {/* Header Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[6px] bg-[#F4A300] text-xl font-bold text-[#142B4A]">
              S
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">SADEWA</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#C8D3E1]">
                INSTITUTIONAL
              </div>
            </div>
          </div>

          {/* Main Statement */}
          <div className="my-10 space-y-6">
            <span className="inline-flex items-center gap-2 rounded-[6px] border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E9EEF5]">
              <University className="h-3.5 w-3.5 text-[#F4A300]" />
              Outcome-Based Education
            </span>
            <div className="space-y-4">
              <h1 className="text-[34px] font-semibold leading-[1.12] tracking-tight lg:text-[44px]">
                Sistem evaluasi akademik yang formal, terukur, dan role-aware.
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-[#D7E0EB]">
                Masuk untuk memantau ketercapaian CPL, mengelola kurikulum OBE, memvalidasi laporan evaluasi,
                serta menjalankan provisioning program studi dengan isolasi kewenangan yang tegas.
              </p>
            </div>

            {/* Scope separation info cards */}
            <div className="space-y-2 pt-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#93A7C3]">
                Prinsip Isolasi Kewenangan (PRD Section 3.2)
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[6px] border border-white/10 bg-white/5 p-3 text-xs text-[#E9EEF5]">
                  <span className="font-semibold text-[#F4A300]">Super Admin:</span> Provisioning prodi & metadata pengguna lintas prodi (tanpa akses data akademik).
                </div>
                <div className="rounded-[6px] border border-white/10 bg-white/5 p-3 text-xs text-[#E9EEF5]">
                  <span className="font-semibold text-[#10B981]">Admin Prodi:</span> CRUD Kurikulum OBE & kelola user di prodinya sendiri.
                </div>
              </div>
            </div>
          </div>

          {/* Institutional Badge Footer */}
          <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-[#93A7C3]">
            <span>Sistem Analisis Data Evaluasi Wawasan Akademik</span>
            <span className="rounded-[4px] border border-white/15 px-2 py-0.5 font-mono text-[10px]">v2.1 Role-Aligned</span>
          </div>
        </section>

        {/* Right Form Panel */}
        <section className="flex flex-col justify-center p-8 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-6 bg-[#F4A300]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6D778E]">
                  Akses Sistem
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#142B4A]">
                Masuk ke SADEWA
              </h2>
              <p className="text-xs leading-relaxed text-[#64748B]">
                Pilih peran demo di bawah untuk mengisi kredensial otomatis, atau masukkan akun aktif Anda.
              </p>
            </div>

            {/* Role Preset Quick Switcher */}
            <div className="mb-5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#6D778E]">
                <span>PILIH ROLE DEMO</span>
                <span className="text-[10px] text-[#94A3B8]">5 Hak Akses</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {demoCredentials.map((cred) => {
                  const isActive = selectedRole === cred.role
                  return (
                    <button
                      key={cred.role}
                      type="button"
                      onClick={() => handleSelectCredential(cred)}
                      data-testid={`quick-role-${cred.role}`}
                      className={`flex flex-col items-start rounded-[6px] border p-2 text-left transition-colors ${
                        isActive
                          ? 'border-[#1A3A6B] bg-[#F8FAFC] shadow-sm'
                          : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className={`text-xs font-semibold ${isActive ? 'text-[#1A3A6B]' : 'text-[#142B4A]'}`}>
                          {roleLabels[cred.role]}
                        </span>
                        {isActive ? <CheckCircle2 className="h-3 w-3 text-[#1A3A6B]" /> : null}
                      </div>
                      <span className="mt-0.5 truncate text-[10px] text-[#64748B]">
                        {cred.email.split('@')[0]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-5">
              {error ? (
                <div
                  role="alert"
                  className="rounded-[6px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
                  data-testid="login-error-alert"
                >
                  <div className="font-semibold">Gagal masuk</div>
                  <div>{error}</div>
                </div>
              ) : null}

              <label className="block space-y-1.5" htmlFor="login-email-input">
                <span className="text-xs font-semibold text-[#142B4A]">Alamat Email</span>
                <input
                  id="login-email-input"
                  type="email"
                  required
                  autoComplete="email"
                  className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-sm text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@sadewa.ac.id"
                  data-testid="login-email"
                />
              </label>

              <label className="block space-y-1.5" htmlFor="login-password-input">
                <span className="text-xs font-semibold text-[#142B4A]">Password</span>
                <input
                  id="login-password-input"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-sm text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  data-testid="login-password"
                />
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[6px] bg-[#1A3A6B] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142B4A] disabled:opacity-70"
                data-testid="login-submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <LockKeyhole className="h-4 w-4" />
                    <span>Masuk sebagai {roleLabels[selectedRole] || 'Pengguna'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="flex items-start gap-2.5 rounded-[6px] border border-[#E2E8F0] bg-white p-3 text-xs text-[#64748B]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
                <p className="leading-normal">
                  Sistem mendukung autentikasi JWT langsung ke backend serta demo visual terpadu. Role switcher di topbar dapat digunakan sewaktu-waktu untuk menguji pemisahan halaman.
                </p>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}
