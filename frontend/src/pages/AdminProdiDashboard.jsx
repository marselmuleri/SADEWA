import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, BookOpen, CheckCircle2, CircleDashed, FileText, Layers3, RefreshCw, Users } from 'lucide-react'
import useAuth from '../hooks/useAuth'
import { ActionButton, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import api from '../services/api'
import { getApiErrorMessage } from './superAdminHelpers'

const asList = (res) => (Array.isArray(res?.data) ? res.data : [])

// Ikhtisar Admin Prodi: status konfigurasi kurikulum saja.
// Angka ketercapaian CPL/IK/CPMK adalah wewenang Dosen, Kaprodi, dan Dekan (Analitik OBE),
// jadi halaman ini sengaja tidak memanggil /dashboard maupun /trending.
export default function AdminProdiDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState({ versions: [], cpl: [], ik: [], mk: [], cpmk: [], pengampu: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [versions, cpl, ik, mk, cpmk, pengampu] = await Promise.all([
        api.get('/kurikulum/versions'),
        api.get('/cpl'),
        api.get('/ik'),
        api.get('/mata-kuliah'),
        api.get('/cpmk'),
        api.get('/pengampu-mata-kuliah'),
      ])
      setData({
        versions: asList(versions),
        cpl: asList(cpl),
        ik: asList(ik),
        mk: asList(mk),
        cpmk: asList(cpmk),
        pengampu: asList(pengampu),
      })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat ringkasan konfigurasi program studi.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const activeVersion = useMemo(
    () => data.versions.find((v) => v.status === 'published') || null,
    [data.versions],
  )

  const checklist = useMemo(() => {
    const cplWithIk = new Set(data.ik.map((i) => i.cpl_id))
    const mkWithCpmk = new Set(data.cpmk.map((c) => c.mata_kuliah_id))
    const mkWithPengampu = new Set(data.pengampu.map((p) => p.mata_kuliah_id))
    const cplTanpaIk = data.cpl.filter((c) => !cplWithIk.has(c.id)).length
    const mkTanpaCpmk = data.mk.filter((m) => !mkWithCpmk.has(m.id)).length
    const mkTanpaPengampu = data.mk.filter((m) => !mkWithPengampu.has(m.id)).length

    return [
      {
        key: 'versi',
        label: 'Versi kurikulum dipublikasikan',
        done: Boolean(activeVersion),
        detail: activeVersion ? `Aktif: ${activeVersion.version_label}` : 'Belum ada versi berstatus published',
        path: '/data-master/kurikulum',
      },
      {
        key: 'cpl',
        label: 'CPL terdefinisi dan memiliki IK',
        done: data.cpl.length > 0 && cplTanpaIk === 0,
        detail: data.cpl.length === 0 ? 'Belum ada CPL' : cplTanpaIk > 0 ? `${cplTanpaIk} CPL belum punya IK` : `${data.cpl.length} CPL, ${data.ik.length} IK`,
        path: '/kurikulum/cpl',
      },
      {
        key: 'cpmk',
        label: 'Setiap mata kuliah memiliki CPMK',
        done: data.mk.length > 0 && mkTanpaCpmk === 0,
        detail: data.mk.length === 0 ? 'Belum ada mata kuliah' : mkTanpaCpmk > 0 ? `${mkTanpaCpmk} mata kuliah belum punya CPMK` : 'Lengkap',
        path: '/kurikulum/cpmk',
      },
      {
        key: 'pengampu',
        label: 'Setiap mata kuliah memiliki dosen pengampu',
        done: data.mk.length > 0 && mkTanpaPengampu === 0,
        detail: data.mk.length === 0 ? 'Belum ada mata kuliah' : mkTanpaPengampu > 0 ? `${mkTanpaPengampu} mata kuliah belum punya pengampu` : 'Lengkap',
        path: '/kurikulum/mata-kuliah',
      },
    ]
  }, [data, activeVersion])

  const prodiNama = user?.program_studi_nama || 'Program Studi'
  const show = (n) => (loading ? '...' : n)

  return (
    <div className="space-y-8 animate-[fadeUp_200ms_ease]">
      <PageHeader
        eyebrow="Dashboard Administrasi Prodi"
        title={`Selamat datang, ${user?.nama || 'Admin Prodi'}`}
        description={`Kelola struktur kurikulum OBE, mata kuliah, dan akun pengguna ${prodiNama}. Data ketercapaian dianalisis oleh Dosen, Kaprodi, dan Dekan.`}
        actions={
          <ActionButton variant="secondary" onClick={load} disabled={loading} data-testid="admin-dashboard-reload">
            <RefreshCw className="h-4 w-4" />
            Muat Ulang
          </ActionButton>
        }
      />

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Kurikulum Aktif"
          value={show(activeVersion ? activeVersion.version_label : '-')}
          caption={`${data.versions.length} versi tersimpan`}
          icon={<BookOpen className="h-4 w-4" />}
        />
        <StatCard
          label="CPL / IK"
          value={show(`${data.cpl.length} / ${data.ik.length}`)}
          caption="Capaian lulusan dan indikator"
          icon={<Layers3 className="h-4 w-4" />}
        />
        <StatCard
          label="Mata Kuliah"
          value={show(data.mk.length)}
          caption={`${data.cpmk.length} CPMK terdefinisi`}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="Penugasan Pengampu"
          value={show(data.pengampu.length)}
          caption="Dosen × mata kuliah"
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <SectionCard
        title="Kesiapan Konfigurasi Kurikulum"
        description="Dosen baru bisa menginput nilai setelah struktur kurikulum dan mata kuliah lengkap."
      >
        <ul className="divide-y divide-[#E2E8F0]" data-testid="admin-setup-checklist">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-start gap-3">
                {item.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#10B981]" />
                ) : (
                  <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-[#F4A300]" />
                )}
                <div>
                  <div className="text-sm font-semibold text-[#142B4A]">{item.label}</div>
                  <div className="text-xs text-[#64748B]">{loading ? 'Memuat...' : item.detail}</div>
                </div>
              </div>
              <ActionButton variant="secondary" onClick={() => navigate(item.path)} data-testid={`admin-setup-${item.key}`}>
                Buka
              </ActionButton>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
