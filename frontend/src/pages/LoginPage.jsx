import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LockKeyhole, ShieldCheck, University } from 'lucide-react'
import useAuth from '../hooks/useAuth'
import { roleLabels } from '../data/demoUi'

const demoCredentials = [
  { role: 'admin', email: 'admin@sadewa.ac.id', password: 'admin123' },
  { role: 'dosen', email: 'dosen@sadewa.ac.id', password: 'dosen123' },
  { role: 'kaprodi', email: 'kaprodi@sadewa.ac.id', password: 'kaprodi123' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@sadewa.ac.id')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      setError('Email atau password tidak valid')
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(26,58,107,0.12),_transparent_30%),linear-gradient(180deg,_#F8FAFC_0%,_#EEF3F8_100%)] px-6 py-10 text-[#142B4A] lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1320px] overflow-hidden rounded-[20px] border border-[#DCE3ED] bg-white shadow-[0_24px_80px_rgba(20,43,74,0.08)] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative flex flex-col justify-between bg-[#132D50] px-8 py-10 text-white lg:px-12">
          <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(244,163,0,0.08),transparent_32%)]" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#F4A300] text-xl font-semibold text-[#142B4A]">S</div>
            <div>
              <div className="text-2xl font-semibold tracking-wide">SADEWA</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#C8D3E1]">Institutional</div>
            </div>
          </div>

          <div className="relative z-10 max-w-xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E9EEF5]">
              <University className="h-3.5 w-3.5 text-[#F4A300]" />
              Outcome-Based Education
            </span>
            <div className="space-y-4">
              <h1 className="text-[44px] font-semibold leading-[1.02] tracking-tight lg:text-[56px]">
                Sistem evaluasi akademik yang formal, terukur, dan role-aware.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#D7E0EB]">
                Masuk untuk memantau ketercapaian CPL, mengelola kurikulum OBE, memvalidasi laporan,
                dan menjalankan provisioning program studi dari satu ruang kerja yang terstruktur.
              </p>
            </div>
          </div>

          <div className="relative z-10 grid gap-3 sm:grid-cols-3">
            {['Dashboard OBE', 'Analitik CPL→IK→CPMK', 'Panel Super Admin'].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/6 px-4 py-3 text-sm text-[#E9EEF5]">{item}</div>
            ))}
          </div>
        </section>

        <section className="flex flex-col justify-center px-8 py-10 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6D778E]">Akses Sistem</div>
              <h2 className="text-3xl font-semibold tracking-tight text-[#142B4A]">Masuk ke SADEWA</h2>
              <p className="text-sm leading-6 text-[#64748B]">Gunakan akun demo atau akun backend aktif untuk lanjut ke dashboard institusional.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
              {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#142B4A]">Email</span>
                <input
                  type="email"
                  required
                  className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@sadewa.ac.id"
                  data-testid="login-email"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#142B4A]">Password</span>
                <input
                  type="password"
                  minLength="6"
                  required
                  className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  data-testid="login-password"
                />
              </label>

              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1A3A6B] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#142B4A]"
                data-testid="login-submit"
              >
                <LockKeyhole className="h-4 w-4" />
                Masuk
              </button>

              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                {demoCredentials.map((cred) => (
                  <button
                    key={cred.role}
                    type="button"
                    onClick={() => {
                      setEmail(cred.email)
                      setPassword(cred.password)
                      setError('')
                    }}
                    className="rounded-md border border-[#DCE3ED] bg-white px-3 py-3 text-left text-sm transition-colors hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                  >
                    <div className="font-semibold text-[#142B4A]">{roleLabels[cred.role]}</div>
                    <div className="mt-1 text-xs text-[#64748B]">{cred.email}</div>
                  </button>
                ))}
              </div>

              <div className="flex items-start gap-3 rounded-md border border-[#E2E8F0] bg-white px-3 py-3 text-sm text-[#64748B]">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-[#10B981]" />
                <div>Role switcher tersedia setelah login untuk demo visual, agar perbedaan kewenangan terlihat langsung di sidebar dan konten.</div>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}
