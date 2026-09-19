import { Plus } from 'lucide-react'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import { demoCurriculumRows, demoCurriculumStats } from '../data/demoUi'
import useAuth from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'

export default function KurikulumPage() {
  const { user, activeRole } = useAuth()
  const { role } = useRole()
  const currentRole = activeRole || role || user?.role || 'admin'
  const canEdit = currentRole === 'admin'

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Kurikulum OBE"
        title="Kurikulum OBE"
        description="Struktur CPL → IK → CPMK ditampilkan sebagai kurikulum institusional yang rapi dan mudah dipindai."
        badge={canEdit ? 'Mode Edit' : 'Mode Lihat'}
        actions={canEdit ? <ActionButton data-testid="curriculum-add"><Plus className="h-4 w-4" />Tambah CPL</ActionButton> : null}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {demoCurriculumStats.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} caption="Semester aktif" />
        ))}
      </div>

      <SectionCard title="Hierarki Kurikulum" description="Daftar CPL dengan jumlah IK dan CPMK yang sudah terpetakan.">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-left text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
              <th className="pb-3">Kode CPL</th>
              <th className="pb-3">Nama CPL</th>
              <th className="pb-3">Jumlah IK</th>
              <th className="pb-3">CPMK terpetakan</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {demoCurriculumRows.map((item) => (
              <tr key={item.cpl} className="border-b border-[#EEF2F7] last:border-0">
                <td className="py-4 font-semibold text-[#142B4A]">{item.cpl}</td>
                <td className="py-4 text-[#142B4A]">{item.name}</td>
                <td className="py-4 text-[#64748B]">{item.ik}</td>
                <td className="py-4 text-[#64748B]">{item.cpmk}</td>
                <td className="py-4"><Badge tone="success">{item.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard
        title="Arah kerja"
        description={currentRole === 'dosen' ? 'Dosen melihat kurikulum dalam mode baca saja.' : 'Admin Prodi dapat melakukan CRUD penuh pada kurikulum OBE.'}
        action={currentRole === 'dosen' ? <Badge>Mode Lihat</Badge> : null}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { title: 'CPL', value: '8' },
            { title: 'IK', value: '35' },
            { title: 'CPMK', value: '60' },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-[#E2E8F0] bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D778E]">{item.title}</div>
              <div className="mt-2 text-2xl font-semibold text-[#142B4A]">{item.value}</div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
