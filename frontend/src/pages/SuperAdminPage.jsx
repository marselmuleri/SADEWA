import { Check, Filter, Plus, Send, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ActionButton, Badge, PageHeader, SectionCard } from '../components/PageChrome'
import { demoPrograms, demoProvisioningRequests } from '../data/demoUi'
import useAuth from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'

const initialForm = { program: '', faculty: '', adminName: '', adminEmail: '' }

export default function SuperAdminPage() {
  const { user, activeRole } = useAuth()
  const { role } = useRole()
  const currentRole = activeRole || role || user?.role || 'admin'
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(initialForm)

  const filteredPrograms = useMemo(() => {
    return demoPrograms.filter((item) => `${item.name} ${item.faculty}`.toLowerCase().includes(query.toLowerCase()))
  }, [query])

  if (currentRole !== 'super_admin') {
    return (
      <SectionCard title="Akses terbatas" description="Panel ini hanya muncul untuk Super Admin.">
        <p className="text-sm text-[#64748B]">Role lain tidak dapat melihat metadata lintas prodi atau provisioning onboarding.</p>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Panel Super Admin"
        title="Manajemen Program Studi"
        description="Provisioning prodi baru dan tinjau pengajuan onboarding tanpa menampilkan isi kurikulum atau laporan evaluasi."
        actions={(
          <ActionButton data-testid="superadmin-add-program">
            <Plus className="h-4 w-4" />
            Tambah Prodi Baru
          </ActionButton>
        )}
      />

      <SectionCard
        title="Daftar Prodi"
        description="Metadata lintas prodi hanya menampilkan angka ringkas, bukan isi akademik."
        action={(
          <div className="flex items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari prodi..."
                className="h-10 w-64 rounded-md border border-[#CBD5E1] bg-white pl-9 pr-3 text-sm focus:border-[#1A3A6B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20"
              />
            </label>
            <ActionButton variant="secondary"><Filter className="h-4 w-4" />Filter</ActionButton>
          </div>
        )}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-left text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
              <th className="pb-3">Nama program studi</th>
              <th className="pb-3">Fakultas</th>
              <th className="pb-3">Tanggal onboard</th>
              <th className="pb-3">User aktif</th>
              <th className="pb-3">CPL</th>
              <th className="pb-3">MK</th>
            </tr>
          </thead>
          <tbody>
            {filteredPrograms.map((item) => (
              <tr key={item.name} className="border-b border-[#EEF2F7] last:border-0">
                <td className="py-4 font-semibold text-[#142B4A]">{item.name}</td>
                <td className="py-4 text-[#142B4A]">{item.faculty}</td>
                <td className="py-4 text-[#64748B]">{item.onboardedAt}</td>
                <td className="py-4 text-[#64748B]">{item.activeUsers}</td>
                <td className="py-4 text-[#64748B]">{item.cplCount}</td>
                <td className="py-4 text-[#64748B]">{item.courseCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <SectionCard title="Provisioning Prodi Baru" description="Buat prodi baru dan admin pertama dari satu formulir terstruktur.">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { key: 'program', label: 'Nama program studi' },
              { key: 'faculty', label: 'Fakultas' },
              { key: 'adminName', label: 'Nama admin pertama' },
              { key: 'adminEmail', label: 'Email admin pertama', type: 'email' },
            ].map((item) => (
              <label key={item.key} className="block space-y-2 md:col-span-1">
                <span className="text-sm font-medium text-[#142B4A]">{item.label}</span>
                <input
                  type={item.type || 'text'}
                  value={form[item.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [item.key]: e.target.value }))}
                  className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm focus:border-[#1A3A6B] focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton variant="secondary">Batal</ActionButton>
            <ActionButton data-testid="superadmin-provision">
              <Send className="h-4 w-4" />
              Buat Prodi & Kirim Kredensial
            </ActionButton>
          </div>
        </SectionCard>

        <SectionCard title="Pengajuan Onboarding" description="Alur approve/reject hanya muncul di tampilan Super Admin.">
          <div className="space-y-3">
            {demoProvisioningRequests.map((item) => (
              <div key={item.ref} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D778E]">{item.ref}</div>
                    <div className="mt-1 text-sm font-semibold text-[#142B4A]">{item.program}</div>
                    <div className="mt-1 text-xs text-[#64748B]">{item.requester} · {item.email} · {item.date}</div>
                  </div>
                  <Badge tone={item.status === 'DISETUJUI' ? 'success' : 'warning'}>{item.status}</Badge>
                </div>
                <div className="mt-4 flex gap-2">
                  <ActionButton variant="secondary">
                    <Check className="h-4 w-4" />
                    Approve
                  </ActionButton>
                  <ActionButton variant="secondary">Reject</ActionButton>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
