import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, FileText, Layers3, Users, Download, Printer } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import useAuth from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import {
  demoDashboard,
  demoCpl,
  demoCplBars,
  demoLatestActivities,
  demoProfiles,
} from '../data/demoUi'

function pillTone(status) {
  return status === 'Tercapai' ? 'success' : 'warning'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, activeRole } = useAuth()
  const { role } = useRole()
  const currentRole = activeRole || role || user?.role || 'admin'
  const profile = demoProfiles[currentRole] || demoProfiles.admin

  const metricCards = [
    {
      label: 'Ketercapaian OBE',
      value: `${demoDashboard.overall}%`,
      caption: `Target institusi ${demoDashboard.target}%`,
      icon: <Layers3 className="h-4 w-4" />,
    },
    {
      label: 'Mahasiswa dievaluasi',
      value: demoDashboard.students,
      caption: 'Pada semester berjalan',
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: 'Mata kuliah aktif',
      value: demoDashboard.activeCourses,
      caption: 'Dengan pemetaan CPMK',
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: 'Laporan menunggu',
      value: demoDashboard.pendingReports,
      caption: currentRole === 'dosen' ? 'Laporan yang Anda kirim' : 'Perlu validasi Kaprodi',
      icon: <ArrowUpRight className="h-4 w-4" />,
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard Operasional"
        title={`Selamat pagi, ${profile.name}`}
        description="Pantau ketercapaian OBE dan aktivitas akademik program studi Anda dalam tampilan formal, terstruktur, dan data-dense."
        actions={(
          <>
            <ActionButton variant="secondary" onClick={() => window.print()} data-testid="dashboard-print">
              <Printer className="h-4 w-4" />
              Print
            </ActionButton>
            <ActionButton onClick={() => window.alert('Export demo dashboard')} data-testid="dashboard-export">
              <Download className="h-4 w-4" />
              Export
            </ActionButton>
          </>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {metricCards.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <SectionCard
          title="Ringkasan ketercapaian CPL"
          description="CPL-A sampai CPL-F dibandingkan dengan target 70%."
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demoCplBars} margin={{ left: -12, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {demoCplBars.map((entry) => (
                    <Cell key={entry.name} fill={entry.value >= entry.target ? '#1A3A6B' : '#F4A300'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Aktivitas terbaru" description="Timeline singkat yang menunjukkan alur kerja terkini.">
          <div className="space-y-4">
            {demoLatestActivities.map((item, index) => (
              <div key={item.time} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#1A3A6B]">{index + 1}</span>
                  {index < demoLatestActivities.length - 1 ? <span className="mt-1 h-full w-px bg-[#E2E8F0]" /> : null}
                </div>
                <div className="pb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D778E]">{item.time}</div>
                  <p className="mt-1 text-sm leading-6 text-[#142B4A]">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="CPL Overview"
        description="Klik kartu untuk membuka analitik OBE dengan CPL terpilih."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {demoCpl.map((item) => (
            <button
              key={item.code}
              type="button"
              data-testid={`cpl-card-${item.code.toLowerCase()}`}
              onClick={() => navigate('/analisis')}
              className="rounded-lg border border-[#E2E8F0] bg-white p-5 text-left transition-transform hover:-translate-y-px hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D778E]">{item.code}</div>
                  <div className="mt-2 text-[17px] font-semibold text-[#142B4A]">{item.name}</div>
                </div>
                <Badge tone={pillTone(item.status)}>{item.status}</Badge>
              </div>
              <div className="mt-5 text-3xl font-semibold tracking-tight text-[#142B4A]">{item.achievement}%</div>
              <div className="mt-3 h-1.5 rounded-full bg-[#F2F4F7]">
                <div className={`h-1.5 rounded-full ${item.achievement >= demoDashboard.target ? 'bg-[#1A3A6B]' : 'bg-[#F4A300]'}`} style={{ width: `${item.achievement}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-[#64748B]">
                <span>{item.students}</span>
                <span className={item.trend >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                  {item.trend >= 0 ? '↑' : '↓'} {Math.abs(item.trend)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Konteks Program Studi"
        description="Ringkasan konteks akademik untuk memastikan data selalu terbaca dalam skope program studi yang benar."
        className="bg-[#132D50] text-white"
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C8D3E1]">{demoDashboard.faculty}</div>
            <div className="mt-2 text-2xl font-semibold">{demoDashboard.program}</div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#D7E0EB]">
              Semester {demoDashboard.semester} · {demoDashboard.version} · Sinkron terakhir {demoDashboard.lastSync}
            </p>
          </div>
          <div className="flex items-center justify-start lg:justify-end">
            <ActionButton variant="secondary" onClick={() => navigate('/kurikulum')} data-testid="dashboard-context-action">
              Lihat struktur kurikulum
            </ActionButton>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
