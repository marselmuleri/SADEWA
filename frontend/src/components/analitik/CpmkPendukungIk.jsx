import { Badge, SectionCard } from '../PageChrome'
import { fmt } from './analitikModel'

// Drill-down sampai CPMK: dari IK terpilih (Level 2) ke CPMK pendukungnya di semua mata kuliah.
export default function CpmkPendukungIk({ model, ikId, kodeIk }) {
  if (!model) return null
  const ik = model.ikById.get(ikId)
  if (!ik) return null
  const cpl = model.cplById.get(ik.cpl_id)
  const threshold = cpl?.threshold ?? 70

  const perMk = (ik.per_mk || [])
    .map((p) => ({ ...p, mk: model.mkById.get(p.mk_id) }))
    .sort((a, b) => (a.rata_rata ?? 0) - (b.rata_rata ?? 0))
  const cpmks = model.cpmk
    .filter((c) => c.ik.some((x) => x.ik_id === ikId))
    .map((c) => ({ ...c, bobotIk: c.ik.find((x) => x.ik_id === ikId)?.bobot, mk: model.mkById.get(c.mk_id) }))
    .sort((a, b) => (a.rata_rata ?? 0) - (b.rata_rata ?? 0))

  return (
    <SectionCard
      title={`Level 3: CPMK Pendukung ${kodeIk || ik.kode}`}
      description="Mata kuliah dan CPMK yang mengukur indikator ini, diurutkan dari capaian terendah. Capaian IK dihitung dalam persen terhadap bobot IK di tiap mata kuliah."
    >
      <div className="grid gap-6 lg:grid-cols-2" data-testid="drill-cpmk-ik">
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#142B4A]">Capaian {ik.kode} per Mata Kuliah</h4>
          {perMk.length === 0 ? <p className="text-xs text-[#64748B]">Belum ada data.</p> : (
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-[#F2F4F7]">
                {perMk.map((p) => (
                  <tr key={p.mk_id}>
                    <td className="py-2 pr-3"><span className="font-semibold text-[#142B4A]">{p.mk?.kode}</span> <span className="text-[#64748B]">{p.mk?.nama}</span></td>
                    <td className="py-2 pr-3 text-[#94A3B8]">bobot {fmt(p.bobot, 0)}</td>
                    <td className="py-2 text-right">
                      <span className={`font-bold ${p.rata_rata >= threshold ? 'text-[#047857]' : 'text-[#B45309]'}`}>{fmt(p.rata_rata)}%</span>
                      <span className="block text-[10px] text-[#94A3B8]">{fmt(p.persen_tercapai, 0)}% dari {p.jumlah_mahasiswa} mhs</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#142B4A]">CPMK yang dipetakan ke {ik.kode}</h4>
          {cpmks.length === 0 ? <p className="text-xs text-[#64748B]">Belum ada CPMK yang dipetakan.</p> : (
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-[#F2F4F7]">
                {cpmks.map((c) => {
                  const lulus = c.rata_rata != null && c.rata_rata >= model.ambangCpmk
                  return (
                    <tr key={c.cpmk_id} className="align-top">
                      <td className="py-2 pr-3">
                        <div><span className="font-semibold text-[#142B4A]">{c.kode}</span> <span className="text-[#94A3B8]">· {c.mk?.kode}</span></div>
                        <div className="text-[#64748B] line-clamp-2" title={c.deskripsi}>{c.deskripsi}</div>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-[#94A3B8]">bobot ke IK {fmt(c.bobotIk, 0)}</td>
                      <td className="py-2 text-right">
                        {c.jumlah_mahasiswa ? (
                          <>
                            <Badge tone={lulus ? 'success' : 'warning'}>{fmt(c.rata_rata)}%</Badge>
                            <span className="mt-1 block text-[10px] text-[#94A3B8]">{c.jumlah_tercapai}/{c.jumlah_mahasiswa} tuntas</span>
                          </>
                        ) : <span className="text-[#94A3B8]">belum dikalkulasi</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
