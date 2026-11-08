import { useMemo, useState } from 'react'
import { AlertTriangle, Download, X } from 'lucide-react'
import { ActionButton, SectionCard } from '../PageChrome'
import { exportToCsv } from '../../utils/csvExport'
import { fmt, warnaCapaian } from './analitikModel'

// Cakupan satu mata kuliah: peta CPMK × IK (bobot pemetaan, warna = capaian IK di MK ini).
function PetaCpmkIk({ model }) {
  const iks = model.ik
  const ikCapaian = (i) => (i.per_mk || [])[0]
  return (
    <SectionCard
      title="Peta CPMK × Indikator Kinerja"
      description="Angka di sel = bobot pemetaan CPMK ke IK. Warna kolom = capaian IK di mata kuliah ini terhadap threshold CPL-nya. Kolom kanan = capaian CPMK."
    >
      {!model.cpmk.length || !iks.length ? (
        <p className="py-8 text-center text-sm text-[#64748B]">Belum ada CPMK atau pemetaan IK untuk mata kuliah ini.</p>
      ) : (
        <div className="overflow-auto">
          <table className="border-separate border-spacing-1 text-xs" data-testid="peta-cpmk-ik">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">CPMK</th>
                {iks.map((i) => (
                  <th key={i.ik_id} className="min-w-[64px] px-1 py-1 text-center font-semibold text-[#142B4A]" title={i.deskripsi}>
                    {i.kode}
                    <div className="text-[10px] font-normal text-[#94A3B8]">{model.cplById.get(i.cpl_id)?.kode}</div>
                  </th>
                ))}
                <th className="px-2 py-1 text-[10px] font-semibold uppercase text-[#6D778E]">Capaian CPMK</th>
              </tr>
            </thead>
            <tbody>
              {model.cpmk.map((c) => (
                <tr key={c.cpmk_id}>
                  <th className="max-w-[240px] px-2 py-1 text-left font-normal">
                    <div className="font-semibold text-[#142B4A]">{c.kode} <span className="font-normal text-[#94A3B8]">· {fmt(c.bobot, 0)}%</span></div>
                    <div className="truncate text-[11px] text-[#64748B]" title={c.deskripsi}>{c.deskripsi}</div>
                  </th>
                  {iks.map((i) => {
                    const m = c.ik.find((x) => x.ik_id === i.ik_id)
                    if (!m) return <td key={i.ik_id} className="h-10 rounded bg-[#F8FAFC]" />
                    const d = ikCapaian(i)
                    const w = warnaCapaian(d?.rata_rata ?? null, model.cplById.get(i.cpl_id)?.threshold ?? 70)
                    return (
                      <td
                        key={i.ik_id}
                        className="h-10 rounded text-center font-bold"
                        style={{ backgroundColor: w.bg, color: w.fg }}
                        title={`${c.kode} → ${i.kode}\nBobot ${fmt(m.bobot, 0)}\nCapaian IK ${d?.rata_rata == null ? 'belum ada' : `${fmt(d.rata_rata)}%`}`}
                      >
                        {fmt(m.bobot, 0)}
                      </td>
                    )
                  })}
                  <td className="px-2 text-center">
                    {c.jumlah_mahasiswa ? (
                      <span className={`font-bold ${c.rata_rata >= model.ambangCpmk ? 'text-[#047857]' : 'text-[#B45309]'}`}>{fmt(c.rata_rata)}%</span>
                    ) : <span className="text-[#94A3B8]">–</span>}
                  </td>
                </tr>
              ))}
              <tr>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">Capaian IK</th>
                {iks.map((i) => {
                  const d = ikCapaian(i)
                  return (
                    <td key={i.ik_id} className="py-2 text-center font-bold text-[#142B4A]">
                      {d?.rata_rata == null ? '–' : `${fmt(d.rata_rata, 0)}%`}
                    </td>
                  )
                })}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

export default function PetaKurikulum({ model }) {
  if (model.scope === 'mata_kuliah') return <PetaCpmkIk model={model} />
  return <PetaKurikulumProdi model={model} />
}

function PetaKurikulumProdi({ model }) {
  const [tampilan, setTampilan] = useState('capaian') // 'capaian' | 'bobot'
  const [sel, setSel] = useState(null) // { cplId, mkId }

  // Hanya MK yang berkontribusi ke minimal satu CPL, ditambah MK yang belum terpetakan sama sekali.
  const mkList = model.mk
  const dukungan = useMemo(
    () => Object.fromEntries(model.cpl.map((c) => {
      const m = model.peta.get(c.cpl_id)
      const total = m ? Array.from(m.values()).reduce((s, x) => s + (x.bobot_cp || 0), 0) : 0
      return [c.cpl_id, { jumlah: m?.size || 0, total }]
    })),
    [model],
  )
  const cplPerMk = (mkId) => model.cpl.filter((c) => model.peta.get(c.cpl_id)?.has(mkId)).length
  const maxBobot = Math.max(1, ...(model.raw.capaian_cpl_mk || []).map((s) => s.bobot_cp || 0))

  const detail = useMemo(() => {
    if (!sel) return null
    const c = model.cplById.get(sel.cplId)
    const m = model.mkById.get(sel.mkId)
    const s = model.peta.get(sel.cplId)?.get(sel.mkId)
    const iks = model.ik
      .filter((i) => i.cpl_id === sel.cplId)
      .map((i) => ({ i, d: (i.per_mk || []).find((p) => p.mk_id === sel.mkId) }))
      .filter((x) => x.d)
    const ikIds = new Set(iks.map((x) => x.i.ik_id))
    const cpmks = model.cpmk.filter((cp) => cp.mk_id === sel.mkId && cp.ik.some((x) => ikIds.has(x.ik_id)))
    return { c, m, s, iks, cpmks }
  }, [model, sel])

  const exportCsv = () =>
    exportToCsv(
      'Peta_Kurikulum_MK_CPL',
      [{ key: 'mk', label: 'Mata Kuliah' }, ...model.cpl.flatMap((c) => [
        { key: `${c.cpl_id}_b`, label: `${c.kode} bobot` },
        { key: `${c.cpl_id}_c`, label: `${c.kode} capaian (%)` },
      ])],
      mkList.map((m) => ({
        mk: `${m.kode} ${m.nama}`,
        ...Object.fromEntries(model.cpl.flatMap((c) => {
          const s = model.peta.get(c.cpl_id)?.get(m.mk_id)
          return [[`${c.cpl_id}_b`, s ? fmt(s.bobot_cp, 0) : ''], [`${c.cpl_id}_c`, s?.rata_rata != null ? fmt(s.rata_rata) : '']]
        })),
      })),
    )

  if (!model.cpl.length || !mkList.length) {
    return (
      <SectionCard title="Peta Kurikulum">
        <p className="py-8 text-center text-sm text-[#64748B]">Belum ada CPL atau mata kuliah pada prodi ini.</p>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Peta Kurikulum: Mata Kuliah × CPL"
        description="Kontribusi setiap mata kuliah ke CPL (Σ bobot IK pada pemetaan CPMK) dan capaian CPL di mata kuliah itu. Klik sel untuk melihat IK dan CPMK di baliknya."
        action={
          <ActionButton variant="secondary" onClick={exportCsv} data-testid="btn-export-peta">
            <Download className="h-4 w-4" /> Export CSV
          </ActionButton>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {[['capaian', 'Warna: capaian'], ['bobot', 'Warna: bobot kontribusi']].map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              aria-pressed={tampilan === k}
              onClick={() => setTampilan(k)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${tampilan === k ? 'border-[#1A3A6B] bg-[#1A3A6B] text-white' : 'border-[#CBD5E1] bg-white text-[#142B4A]'}`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="max-h-[560px] overflow-auto">
          <table className="border-separate border-spacing-1 text-xs" data-testid="peta-kurikulum">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className="sticky left-0 z-20 bg-white px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">Mata Kuliah</th>
                {model.cpl.map((c) => (
                  <th key={c.cpl_id} className="min-w-[64px] px-1 py-1 text-center font-semibold text-[#142B4A]" title={c.deskripsi}>{c.kode}</th>
                ))}
                <th className="px-2 py-1 text-[10px] font-semibold uppercase text-[#6D778E]">CPL</th>
              </tr>
            </thead>
            <tbody>
              {mkList.map((m) => {
                const jml = cplPerMk(m.mk_id)
                return (
                  <tr key={m.mk_id}>
                    <th className="sticky left-0 z-10 max-w-[220px] bg-white px-2 py-1 text-left font-normal">
                      <div className="font-semibold text-[#142B4A]">{m.kode}</div>
                      <div className="truncate text-[11px] text-[#64748B]" title={m.nama}>{m.nama}</div>
                    </th>
                    {model.cpl.map((c) => {
                      const s = model.peta.get(c.cpl_id)?.get(m.mk_id)
                      if (!s) return <td key={c.cpl_id} className="h-11 rounded bg-[#F8FAFC]" />
                      const aktif = sel?.cplId === c.cpl_id && sel?.mkId === m.mk_id
                      const w = tampilan === 'capaian'
                        ? warnaCapaian(s.rata_rata, c.threshold)
                        : { bg: `rgba(26,58,107,${0.15 + 0.85 * ((s.bobot_cp || 0) / maxBobot)})`, fg: (s.bobot_cp || 0) / maxBobot > 0.5 ? '#FFFFFF' : '#142B4A' }
                      return (
                        <td key={c.cpl_id} className="p-0">
                          <button
                            type="button"
                            onClick={() => setSel(aktif ? null : { cplId: c.cpl_id, mkId: m.mk_id })}
                            className={`h-11 w-full min-w-[64px] rounded text-center leading-tight ${aktif ? 'ring-2 ring-[#F4A300] ring-offset-1' : ''}`}
                            style={{ backgroundColor: w.bg, color: w.fg }}
                            title={`${m.kode} → ${c.kode}\nBobot ${fmt(s.bobot_cp, 0)}\nCapaian ${s.rata_rata == null ? 'belum ada' : `${fmt(s.rata_rata)}%`}`}
                            data-testid={`peta-sel-${m.mk_id}-${c.cpl_id}`}
                          >
                            <div className="font-bold">{tampilan === 'capaian' ? (s.rata_rata == null ? '–' : fmt(s.rata_rata, 0)) : fmt(s.bobot_cp, 0)}</div>
                            <div className="text-[10px] opacity-80">{tampilan === 'capaian' ? `b ${fmt(s.bobot_cp, 0)}` : (s.rata_rata == null ? '–' : `${fmt(s.rata_rata, 0)}%`)}</div>
                          </button>
                        </td>
                      )
                    })}
                    <td className={`px-2 text-center font-semibold ${jml === 0 ? 'text-[#DC2626]' : 'text-[#64748B]'}`} title={jml === 0 ? 'Mata kuliah ini belum dipetakan ke CPL mana pun' : ''}>
                      {jml}
                    </td>
                  </tr>
                )
              })}
              <tr>
                <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">Jumlah MK pendukung</th>
                {model.cpl.map((c) => {
                  const d = dukungan[c.cpl_id]
                  const risiko = d.jumlah <= 1
                  return (
                    <td key={c.cpl_id} className={`rounded px-1 py-2 text-center font-bold ${risiko ? 'bg-red-50 text-[#DC2626]' : 'text-[#142B4A]'}`} title={`Total bobot ${fmt(d.total, 0)}`}>
                      <span className="inline-flex items-center gap-0.5">{risiko && <AlertTriangle className="h-3 w-3" />}{d.jumlah}</span>
                    </td>
                  )
                })}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-[#64748B]">
          Angka besar = {tampilan === 'capaian' ? 'capaian CPL di MK (%)' : 'bobot kontribusi'}, angka kecil = {tampilan === 'capaian' ? 'bobot kontribusi (b)' : 'capaian'}. Sel abu-abu: MK tidak berkontribusi ke CPL itu. Tanda merah: CPL yang didukung 0–1 mata kuliah.
        </p>
      </SectionCard>

      {detail && (
        <SectionCard
          title={`${detail.m?.kode} → ${detail.c?.kode}`}
          description={`${detail.m?.nama}. Bobot kontribusi ${fmt(detail.s?.bobot_cp, 0)}, capaian ${detail.s?.rata_rata == null ? 'belum ada' : `${fmt(detail.s.rata_rata)}% (${fmt(detail.s.persen_tercapai, 0)}% dari ${detail.s.jumlah_mahasiswa} mahasiswa mencapai target)`}.`}
          action={
            <ActionButton variant="secondary" onClick={() => setSel(null)}>
              <X className="h-4 w-4" /> Tutup
            </ActionButton>
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#142B4A]">Indikator Kinerja di MK ini</h4>
              <ul className="space-y-2 text-xs">
                {detail.iks.map(({ i, d }) => (
                  <li key={i.ik_id} className="flex items-start justify-between gap-3 border-b border-[#F2F4F7] pb-2">
                    <span><span className="font-semibold text-[#142B4A]">{i.kode}</span> <span className="text-[#64748B]">{i.deskripsi}</span></span>
                    <span className="shrink-0 text-right">
                      <span className="font-bold">{d.rata_rata == null ? '–' : `${fmt(d.rata_rata)}%`}</span>
                      <span className="block text-[10px] text-[#94A3B8]">bobot {fmt(d.bobot, 0)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#142B4A]">CPMK yang mengukur IK tersebut</h4>
              {detail.cpmks.length === 0 ? <p className="text-xs text-[#64748B]">–</p> : (
                <ul className="space-y-2 text-xs">
                  {detail.cpmks.map((cp) => (
                    <li key={cp.cpmk_id} className="flex items-start justify-between gap-3 border-b border-[#F2F4F7] pb-2">
                      <span><span className="font-semibold text-[#142B4A]">{cp.kode}</span> <span className="text-[#64748B]">{cp.deskripsi}</span></span>
                      <span className="shrink-0 text-right">
                        <span className="font-bold">{cp.rata_rata == null ? '–' : `${fmt(cp.rata_rata)}%`}</span>
                        <span className="block text-[10px] text-[#94A3B8]">{cp.jumlah_tercapai}/{cp.jumlah_mahasiswa} tuntas</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
