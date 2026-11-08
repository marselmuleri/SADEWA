import { useMemo, useState } from 'react'
import { AlertOctagon, AlertTriangle, ArrowRight, Download, Info, TrendingUp } from 'lucide-react'
import { ActionButton, Badge, SectionCard } from '../PageChrome'
import { exportToCsv } from '../../utils/csvExport'
import { TARGET_KETUNTASAN, daftarPrioritas, daftarTemuan, fmt } from './analitikModel'

const GAYA_TEMUAN = {
  kritis: { icon: AlertOctagon, border: 'border-l-[#EF4444]', ikon: 'text-[#EF4444]', label: 'Kritis', tone: 'danger' },
  perhatian: { icon: AlertTriangle, border: 'border-l-[#F4A300]', ikon: 'text-[#D97706]', label: 'Perlu perhatian', tone: 'warning' },
  info: { icon: Info, border: 'border-l-[#1A3A6B]', ikon: 'text-[#1A3A6B]', label: 'Info', tone: 'default' },
  positif: { icon: TrendingUp, border: 'border-l-[#10B981]', ikon: 'text-[#10B981]', label: 'Positif', tone: 'success' },
}

export default function RingkasanEvaluasi({ model, onNavigate }) {
  const [level, setLevel] = useState('Semua')
  const [tampil, setTampil] = useState(10)

  const temuan = useMemo(() => daftarTemuan(model), [model])
  const prioritas = useMemo(() => daftarPrioritas(model), [model])
  const terfilter = level === 'Semua' ? prioritas : prioritas.filter((p) => p.level === level)
  const hitung = (lv) => prioritas.filter((p) => p.level === lv).length

  const exportCsv = () =>
    exportToCsv(
      'Papan_Prioritas_Evaluasi_OBE',
      [
        { key: 'peringkat', label: 'Peringkat' },
        { key: 'level', label: 'Level' },
        { key: 'kode', label: 'Kode' },
        { key: 'induk', label: 'Induk' },
        { key: 'nilai', label: 'Rata-rata (%)' },
        { key: 'pct', label: 'Mahasiswa mencapai target (%)' },
        { key: 'tingkat', label: 'Tingkat' },
        { key: 'alasan', label: 'Alasan' },
      ],
      terfilter.map((p, i) => ({ ...p, peringkat: i + 1, nilai: fmt(p.nilai), pct: fmt(p.pct, 0), alasan: p.alasan.join('; '), induk: p.induk || '' })),
    )

  return (
    <div className="space-y-6">
      <SectionCard
        title="Temuan Utama"
        description="Disusun otomatis dari data capaian (bukan AI). Klik tautan pada kartu untuk menelusuri lebih lanjut."
      >
        {temuan.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#64748B]">Belum ada data capaian yang cukup untuk menyusun temuan.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="kartu-temuan">
            {temuan.map((t) => {
              const g = GAYA_TEMUAN[t.tingkat]
              const Icon = g.icon
              return (
                <article key={t.id} className={`rounded-md border border-l-4 border-[#E2E8F0] ${g.border} bg-white p-4`}>
                  <div className="flex items-start gap-2.5">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${g.ikon}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-[#142B4A]">{t.judul}</h4>
                        <Badge tone={g.tone}>{g.label}</Badge>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">{t.isi}</p>
                      {t.aksi && (
                        <button
                          type="button"
                          onClick={() => onNavigate(t.aksi)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1A3A6B] hover:text-[#F4A300]"
                        >
                          {t.aksi.label} <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Papan Prioritas Evaluasi"
        description={`CPL, IK, dan CPMK yang paling perlu dievaluasi, diurutkan dari yang paling jauh dari target. Target ketuntasan: ${TARGET_KETUNTASAN}% mahasiswa mencapai threshold.`}
        action={
          <ActionButton variant="secondary" onClick={exportCsv} disabled={!terfilter.length} data-testid="btn-export-prioritas">
            <Download className="h-4 w-4" /> Export CSV
          </ActionButton>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter level">
          {['Semua', 'CPL', 'IK', 'CPMK'].map((lv) => (
            <button
              key={lv}
              type="button"
              role="tab"
              aria-selected={level === lv}
              onClick={() => { setLevel(lv); setTampil(10) }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                level === lv ? 'border-[#1A3A6B] bg-[#1A3A6B] text-white' : 'border-[#CBD5E1] bg-white text-[#142B4A] hover:border-[#1A3A6B]'
              }`}
            >
              {lv} {lv === 'Semua' ? `(${prioritas.length})` : `(${hitung(lv)})`}
            </button>
          ))}
        </div>

        {terfilter.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#64748B]">
            {prioritas.length ? 'Tidak ada item pada level ini.' : 'Semua capaian berada di atas target. Tidak ada yang perlu diprioritaskan.'}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" data-testid="tabel-prioritas">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3">Rata-rata</th>
                    <th className="py-2 pr-3">Mencapai target</th>
                    <th className="py-2 pr-3">Alasan</th>
                    <th className="py-2" aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7]">
                  {terfilter.slice(0, tampil).map((p, i) => (
                    <tr key={p.id} className="align-top">
                      <td className="py-3 pr-3 text-xs font-bold text-[#64748B]">{i + 1}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-[#CBD5E1] px-1.5 text-[10px] font-bold text-[#64748B]">{p.level}</span>
                          <span className="font-semibold text-[#142B4A]">{p.kode}</span>
                          <Badge tone={p.tingkat === 'kritis' ? 'danger' : 'warning'}>{p.tingkat === 'kritis' ? 'Kritis' : 'Perhatian'}</Badge>
                        </div>
                        <div className="mt-1 max-w-sm text-xs text-[#64748B] line-clamp-2" title={p.deskripsi}>
                          {p.induk ? `${p.induk} · ` : ''}{p.deskripsi}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 text-xs">
                        <span className="font-bold text-[#142B4A]">{fmt(p.nilai)}%</span>
                        <span className="text-[#94A3B8]"> / {fmt(p.target, 0)}%</span>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 text-xs text-[#142B4A]">{fmt(p.pct, 0)}% <span className="text-[#94A3B8]">dari {p.n}</span></td>
                      <td className="py-3 pr-3 text-xs text-[#64748B]">
                        <ul className="list-disc space-y-0.5 pl-4">{p.alasan.map((a) => <li key={a}>{a}</li>)}</ul>
                      </td>
                      <td className="py-3 text-right">
                        {p.cplId && (
                          <button
                            type="button"
                            onClick={() => onNavigate({ tab: 'drilldown', cplId: p.cplId, ikId: p.ikId })}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A3A6B] hover:text-[#F4A300]"
                          >
                            Telusuri <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {p.mkId && (
                          <button
                            type="button"
                            onClick={() => onNavigate({ tab: 'drilldown', mkId: p.mkId })}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A3A6B] hover:text-[#F4A300]"
                          >
                            Lihat MK <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {terfilter.length > tampil && (
              <div className="mt-4 text-center">
                <ActionButton variant="secondary" onClick={() => setTampil((n) => n + 10)}>
                  Tampilkan {Math.min(10, terfilter.length - tampil)} lagi
                </ActionButton>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  )
}
