import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge, SectionCard } from '../PageChrome'
import CpmkPendukungIk from './CpmkPendukungIk'
import { fmt, r1 } from './analitikModel'

// Drill-down CPL → IK → CPMK dari data analitik yang sudah dimuat
// (dipakai pada cakupan satu mata kuliah).
export default function DrilldownModel({ model, focus }) {
  const [cplId, setCplId] = useState(focus?.cplId ?? model.cpl[0]?.cpl_id ?? null)
  const iks = model.ik.filter((i) => i.cpl_id === cplId)
  const [ikId, setIkId] = useState(focus?.ikId ?? null)

  useEffect(() => {
    if (focus?.cplId) setCplId(focus.cplId)
    if (focus?.ikId) setIkId(focus.ikId)
  }, [focus])

  // Pilih IK pertama otomatis saat CPL berganti
  useEffect(() => {
    if (!iks.some((i) => i.ik_id === ikId)) setIkId(iks[0]?.ik_id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cplId, model])

  const cpl = model.cplById.get(cplId)
  const ik = model.ikById.get(ikId)

  return (
    <div className="space-y-6">
      <SectionCard title="Navigasi Hirarki OBE" description="Capaian dihitung berjenjang dari CPL, IK, hingga CPMK di mata kuliah ini.">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#64748B]">
          <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 font-medium">Level 1 · CPL</span>
          <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
          <span className="rounded-md border border-[#1A3A6B]/20 bg-white px-3 py-1.5 font-semibold text-[#1A3A6B]">{cpl?.kode || 'Pilih CPL'}</span>
          <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
          <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 font-medium">Level 2 · {ik?.kode || 'IK'}</span>
          <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
          <span className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 font-medium">Level 3 · CPMK Pendukung</span>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard title="Level 1: CPL yang Diukur Mata Kuliah Ini" description="Capaian CPL dari penilaian di mata kuliah ini saja.">
          {model.cpl.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#64748B]">Mata kuliah ini belum dipetakan ke CPL mana pun.</p>
          ) : (
            <div className="space-y-3" data-testid="drill-mk-cpl">
              {model.cpl.map((c) => {
                const s = model.stats(c.cpl_id)
                const tercapai = s.n && r1(s.mean) >= c.threshold
                const aktif = c.cpl_id === cplId
                return (
                  <button
                    key={c.cpl_id}
                    type="button"
                    onClick={() => setCplId(c.cpl_id)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${aktif ? 'border-[#1A3A6B] bg-[#F8FAFC] ring-1 ring-[#1A3A6B]' : 'border-[#E2E8F0] bg-white hover:border-[#1A3A6B]/50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D778E]">{c.kode}</div>
                        <div className="mt-1 text-sm font-semibold text-[#142B4A] line-clamp-1" title={c.deskripsi}>{c.deskripsi}</div>
                      </div>
                      {s.n ? <Badge tone={tercapai ? 'success' : 'warning'}>{tercapai ? 'Tercapai' : 'Perlu Perhatian'}</Badge> : <Badge>Belum ada data</Badge>}
                    </div>
                    <div className="mt-3 flex items-end justify-between text-xs text-[#64748B]">
                      <span>{s.n ? `${fmt(s.pct, 0)}% dari ${s.n} mahasiswa mencapai ${fmt(c.threshold, 0)}%` : '–'}</span>
                      <span className="text-base font-bold text-[#142B4A]">{s.n ? `${fmt(s.mean)}%` : '–'}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[#E2E8F0]">
                      <div className={`h-1.5 rounded-full ${tercapai ? 'bg-[#1A3A6B]' : 'bg-[#F4A300]'}`} style={{ width: `${Math.min(s.mean || 0, 100)}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title={`Level 2: IK untuk ${cpl?.kode || '-'}`} description="Klik baris untuk melihat CPMK pendukungnya.">
          {iks.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#64748B]">Tidak ada IK dari CPL ini yang dipetakan ke mata kuliah ini.</p>
          ) : (
            <table className="w-full text-left text-sm" data-testid="drill-mk-ik">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
                  <th className="pb-3">Kode IK</th>
                  <th className="pb-3">Deskripsi</th>
                  <th className="pb-3">Capaian</th>
                  <th className="pb-3 text-right">Mencapai target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {iks.map((i) => {
                  const ok = i.jumlah_mahasiswa && r1(i.rata_rata) >= (cpl?.threshold ?? 70)
                  return (
                    <tr key={i.ik_id} onClick={() => setIkId(i.ik_id)} className={`cursor-pointer ${i.ik_id === ikId ? 'bg-[#F8FAFC]' : 'hover:bg-[#F8FAFC]'}`}>
                      <td className="py-3 font-bold text-[#142B4A]">{i.kode}</td>
                      <td className="max-w-xs py-3 pr-4 text-xs text-[#142B4A]">{i.deskripsi}</td>
                      <td className="py-3">
                        {i.jumlah_mahasiswa ? <Badge tone={ok ? 'success' : 'warning'}>{fmt(i.rata_rata)}%</Badge> : <span className="text-xs text-[#94A3B8]">–</span>}
                      </td>
                      <td className="py-3 text-right text-xs text-[#64748B]">{i.jumlah_mahasiswa ? `${fmt(i.persen_tercapai, 0)}% dari ${i.jumlah_mahasiswa}` : '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>

      {ik && <CpmkPendukungIk model={model} ikId={ik.ik_id} kodeIk={ik.kode} />}

      <SectionCard title="Semua CPMK Mata Kuliah" description={`Rata-rata capaian dan ketuntasan (≥ ${fmt(model.ambangCpmk, 0)}%) tiap CPMK.`}>
        {model.cpmk.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#64748B]">Belum ada CPMK.</p>
        ) : (
          <table className="w-full text-left text-sm" data-testid="drill-mk-cpmk">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
                <th className="pb-2">Kode</th>
                <th className="pb-2">Deskripsi</th>
                <th className="pb-2">Bobot</th>
                <th className="pb-2">Rata-rata</th>
                <th className="pb-2 text-right">Tuntas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {model.cpmk.map((c) => {
                const ok = c.jumlah_mahasiswa && r1(c.rata_rata) >= model.ambangCpmk
                return (
                  <tr key={c.cpmk_id}>
                    <td className="py-2.5 font-bold text-[#142B4A]">{c.kode}</td>
                    <td className="max-w-md py-2.5 pr-4 text-xs text-[#64748B]">{c.deskripsi}</td>
                    <td className="py-2.5 text-xs">{fmt(c.bobot, 0)}%</td>
                    <td className="py-2.5">{c.jumlah_mahasiswa ? <Badge tone={ok ? 'success' : 'warning'}>{fmt(c.rata_rata)}%</Badge> : <span className="text-xs text-[#94A3B8]">belum dikalkulasi</span>}</td>
                    <td className="py-2.5 text-right text-xs text-[#64748B]">{c.jumlah_mahasiswa ? `${c.jumlah_tercapai}/${c.jumlah_mahasiswa}` : '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  )
}
