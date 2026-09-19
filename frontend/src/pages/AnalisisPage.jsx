import { useState } from 'react'
import { BarChart3, ChevronRight, LineChart as LineChartIcon } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ActionButton, Badge, PageHeader, SectionCard } from '../components/PageChrome'
import { demoIkRows, demoTrend, demoTrendInsights, demoCplOverview } from '../data/demoUi'

export default function AnalisisPage() {
  const [selectedCpl, setSelectedCpl] = useState(demoCplOverview[0])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Analitik OBE"
        title="Level 1 · CPL Overview > Level 2 · CPL-A / IK Breakdown > Level 3 · CPMK detail"
        description="Tampilan analitik dibuat bertingkat, formal, dan mudah dipindai untuk menelusuri ketercapaian dari CPL sampai CPMK."
        badge="Data demo lokal"
      />

      <SectionCard title="Navigasi Hirarki" description="Pilih CPL untuk melihat level IK dan CPMK yang mendukungnya.">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#64748B]">
          <span className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2">Level 1</span>
          <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
          <span className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2">{selectedCpl.code} · {selectedCpl.name}</span>
          <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
          <span className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2">CPMK detail</span>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
        <SectionCard title="CPL Overview" description="Klik salah satu CPL untuk membuka IK Breakdown.">
          <div className="space-y-3">
            {demoCplOverview.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setSelectedCpl(item)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${selectedCpl.code === item.code ? 'border-[#1A3A6B] bg-[#F8FAFC]' : 'border-[#E2E8F0] bg-white hover:border-[#1A3A6B]/40'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D778E]">{item.code}</div>
                    <div className="mt-1 text-sm font-semibold text-[#142B4A]">{item.name}</div>
                  </div>
                  <Badge tone={item.status === 'ACHIEVED' ? 'success' : 'warning'}>{item.status === 'ACHIEVED' ? 'Tercapai' : 'Perlu Perhatian'}</Badge>
                </div>
                <div className="mt-3 flex items-end justify-between text-sm text-[#64748B]">
                  <span>{item.students} mahasiswa</span>
                  <span className="text-base font-semibold text-[#142B4A]">{item.achievement}%</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[#F2F4F7]">
                  <div className={`h-1.5 rounded-full ${item.achievement >= item.target ? 'bg-[#1A3A6B]' : 'bg-[#F4A300]'}`} style={{ width: `${item.achievement}%` }} />
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={`IK Breakdown untuk ${selectedCpl.code}`}
          description="Tabel IK memuat capaian, jumlah mahasiswa tercapai, dan CPMK pendukung."
          action={
            <ActionButton variant="secondary" onClick={() => window.print()} data-testid="analysis-print">
              <BarChart3 className="h-4 w-4" />
              Export
            </ActionButton>
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-left text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                <th className="pb-3">Kode IK</th>
                <th className="pb-3">Nama indikator</th>
                <th className="pb-3">Ketercapaian</th>
                <th className="pb-3">Mahasiswa</th>
                <th className="pb-3">CPMK pendukung</th>
              </tr>
            </thead>
            <tbody>
              {demoIkRows.map((item) => (
                <tr key={item.code} className="border-b border-[#EEF2F7] last:border-0">
                  <td className="py-4 font-semibold text-[#142B4A]">{item.code}</td>
                  <td className="py-4 text-[#142B4A]">{item.name}</td>
                  <td className="py-4">
                    <div className="w-36">
                      <div className="mb-1 flex items-center justify-between text-xs text-[#64748B]">
                        <span>{item.progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#F2F4F7]">
                        <div className="h-1.5 rounded-full bg-[#1A3A6B]" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-[#142B4A]">{item.achieved} tercapai</td>
                  <td className="py-4 text-[#64748B]">{item.supporting}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Tren tahun 2021-2024" description="Gariskan perubahan CPL-A, CPL-B, dan CPL-C terhadap waktu.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={demoTrend} margin={{ left: -12, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="cplA" stroke="#1A3A6B" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="cplB" stroke="#F4A300" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="cplC" stroke="#10B981" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Insight" description="Ringkasan cepat untuk Kaprodi dan Dekan.">
          <div className="space-y-3">
            {demoTrendInsights.map((item) => (
              <div key={item.title} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D778E]">{item.title}</div>
                <div className="mt-1 text-sm text-[#142B4A]">{item.text}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2 text-xs text-[#64748B]">
            <Badge tone="success">Tercapai</Badge>
            <Badge tone="warning">Perlu perhatian</Badge>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
