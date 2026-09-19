import { CheckCircle2, Plus, RotateCcw, Send } from 'lucide-react'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import { demoReportRows, demoReportSummary } from '../data/demoUi'
import useAuth from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'

export default function DokumenPage() {
  const { user, activeRole } = useAuth()
  const { role } = useRole()
  const currentRole = activeRole || role || user?.role || 'admin'
  const isDosen = currentRole === 'dosen'
  const canDecide = currentRole === 'kaprodi' || currentRole === 'dekan'

  const pageTitle = isDosen ? 'Laporan Saya' : 'Validasi Laporan'
  const description = isDosen
    ? 'Dosen dapat melihat status laporan miliknya, mengirim dokumen baru, dan meninjau tindak lanjut.'
    : 'Kaprodi dan Dekan melakukan approve/reject terhadap laporan evaluasi yang masuk.'

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Validasi Laporan"
        title={pageTitle}
        description={description}
        badge={isDosen ? 'Mode Dosen' : 'Mode Validasi'}
        actions={isDosen ? (
          <ActionButton data-testid="report-create">
            <Plus className="h-4 w-4" />
            Buat Laporan Baru
          </ActionButton>
        ) : null}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {demoReportSummary.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} caption={isDosen && item.label === 'Pending review' ? 'Laporan terkirim dari akun Anda' : 'Semester aktif'} />
        ))}
      </div>

      <SectionCard title={pageTitle} description="Daftar laporan dibuat sebagai table institusional yang mudah dipindai.">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-left text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
              <th className="pb-3">Dosen pengampu</th>
              <th className="pb-3">Mata kuliah</th>
              <th className="pb-3">Tanggal dikirim</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {demoReportRows.map((item) => (
              <tr key={`${item.lecturer}-${item.course}`} className="border-b border-[#EEF2F7] last:border-0">
                <td className="py-4 font-semibold text-[#142B4A]">{item.lecturer}</td>
                <td className="py-4 text-[#142B4A]">{item.course}</td>
                <td className="py-4 text-[#64748B]">{item.date}</td>
                <td className="py-4">
                  <Badge tone={item.status === 'Disetujui' ? 'success' : item.status === 'Perlu Revisi' ? 'danger' : 'warning'}>{item.status}</Badge>
                </td>
                <td className="py-4">
                  {canDecide ? (
                    <div className="flex flex-wrap gap-2">
                      <ActionButton variant="secondary" data-testid={`report-approve-${item.course}`}>
                        <CheckCircle2 className="h-4 w-4" />
                        Setujui
                      </ActionButton>
                      <ActionButton variant="secondary" data-testid={`report-return-${item.course}`}>
                        <RotateCcw className="h-4 w-4" />
                        Kembalikan
                      </ActionButton>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-[#64748B]">
                      <Badge>{item.status}</Badge>
                      <span>·</span>
                      <button type="button" className="text-[#1A3A6B] hover:text-[#F4A300]">Lihat detail</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      {isDosen ? (
        <SectionCard title="Alur Dosen" description="Generate laporan evaluasi dan kirim ke Kaprodi untuk validasi.">
          <div className="flex flex-wrap gap-2">
            <ActionButton data-testid="report-draft">
              <Send className="h-4 w-4" />
              Submit laporan
            </ActionButton>
            <ActionButton variant="secondary">Lihat arsip</ActionButton>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Aksi cepat" description="Workflow validasi berjalan pada ringkasan status berikut.">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Disetujui bulan ini</Badge>
            <Badge tone="warning">Menunggu review</Badge>
            <Badge tone="danger">Perlu revisi</Badge>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
