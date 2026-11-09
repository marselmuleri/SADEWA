import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ActionButton, Badge, SectionCard, StatCard } from '../PageChrome'
import { TARGET_KETUNTASAN, fmt, mean, pctAtLeast } from './analitikModel'

function Slider({ id, label, value, min, max, onChange, suffix = '' }) {
  return (
    <label htmlFor={id} className="block">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[#142B4A]">{label}</span>
        <span className="font-bold text-[#1A3A6B]">{value > 0 && suffix === ' poin' ? '+' : ''}{value}{suffix}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#1A3A6B]"
        data-testid={id}
      />
      <div className="flex justify-between text-[10px] text-[#94A3B8]"><span>{min}{suffix}</span><span>{max}{suffix}</span></div>
    </label>
  )
}

export default function SimulatorThreshold({ model }) {
  const [mode, setMode] = useState('seragam') // 'seragam' | 'geser'
  const [seragam, setSeragam] = useState(70)
  const [geser, setGeser] = useState(0)
  const [ketuntasan, setKetuntasan] = useState(TARGET_KETUNTASAN)
  const [angkatan, setAngkatan] = useState('all')
  const [level, setLevel] = useState('cpl')
  const lv = model.level[level]
  const [cplHistogram, setCplHistogram] = useState(lv.rows[0]?.id ?? null)
  const gantiLevel = (k) => { setLevel(k); setCplHistogram(model.level[k].rows[0]?.id ?? null) }

  const reset = () => { setMode('seragam'); setSeragam(70); setGeser(0); setKetuntasan(TARGET_KETUNTASAN); setAngkatan('all') }
  const thSimulasi = (c) => Math.min(100, Math.max(0, mode === 'seragam' ? seragam : c.threshold + geser))

  const baris = useMemo(
    () =>
      lv.rows
        .map((c) => {
          const v = model.valuesL(level, c.id, angkatan === 'all' ? 'all' : Number(angkatan))
          if (!v.length) return null
          const pctNow = pctAtLeast(v, c.threshold)
          const pctSim = pctAtLeast(v, thSimulasi(c))
          return { c, n: v.length, rata: mean(v), pctNow, pctSim, amanNow: pctNow >= ketuntasan, amanSim: pctSim >= ketuntasan }
        })
        .filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, level, angkatan, mode, seragam, geser, ketuntasan],
  )

  const amanNow = baris.filter((b) => b.amanNow).length
  const amanSim = baris.filter((b) => b.amanSim).length
  const berubah = baris.filter((b) => b.amanNow !== b.amanSim).length

  // Histogram sebaran nilai satu CPL (bin 10 poin)
  const histo = useMemo(() => {
    const c = lv.rows.find((r) => r.id === cplHistogram)
    if (!c) return null
    const v = model.valuesL(level, c.id, angkatan === 'all' ? 'all' : Number(angkatan))
    const th = thSimulasi(c)
    const bins = Array.from({ length: 10 }, (_, i) => ({ rentang: `${i * 10}–${i === 9 ? 100 : i * 10 + 9}`, batas: i * 10, jumlah: 0 }))
    v.forEach((x) => { bins[Math.min(9, Math.floor(x / 10))].jumlah += 1 })
    return { c, bins, th, n: v.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, level, cplHistogram, angkatan, mode, seragam, geser])

  return (
    <div className="space-y-6">
      <SectionCard
        title="Simulator Threshold"
        description="Uji dampak perubahan target capaian sebelum diputuskan. Simulasi ini tidak mengubah data; target resmi diubah di Kurikulum OBE."
        action={
          <ActionButton variant="secondary" onClick={reset} data-testid="btn-reset-simulator">
            <RotateCcw className="h-4 w-4" /> Reset
          </ActionButton>
        }
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="flex gap-2" role="radiogroup" aria-label="Level">
              {Object.entries(model.level).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={level === k}
                  onClick={() => gantiLevel(k)}
                  data-testid={`sim-level-${k}`}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold ${level === k ? 'border-[#F4A300] bg-[#FFF7E6] text-[#142B4A]' : 'border-[#CBD5E1] bg-white text-[#64748B]'}`}
                >
                  Level {l.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2" role="radiogroup" aria-label="Mode threshold">
              {[['seragam', `Seragam semua ${lv.label}`], ['geser', `Geser threshold tiap ${lv.label}`]].map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={mode === k}
                  onClick={() => setMode(k)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold ${mode === k ? 'border-[#1A3A6B] bg-[#1A3A6B] text-white' : 'border-[#CBD5E1] bg-white text-[#142B4A]'}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {mode === 'seragam' ? (
              <Slider id="sim-threshold" label="Threshold simulasi" value={seragam} min={40} max={95} onChange={setSeragam} suffix="%" />
            ) : (
              <Slider id="sim-geser" label="Geser dari threshold saat ini" value={geser} min={-20} max={20} onChange={setGeser} suffix=" poin" />
            )}
          </div>
          <Slider id="sim-ketuntasan" label="Target ketuntasan (% mahasiswa mencapai threshold)" value={ketuntasan} min={40} max={100} onChange={setKetuntasan} suffix="%" />
          <label className="block text-xs">
            <span className="font-semibold text-[#142B4A]">Angkatan</span>
            <select
              value={angkatan}
              onChange={(e) => setAngkatan(e.target.value)}
              className="mt-2 h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#142B4A]"
              data-testid="sim-angkatan"
            >
              <option value="all">Semua angkatan</option>
              {model.angkatan.map((a) => <option key={a} value={a}>Angkatan {a}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label={`${lv.label} aman saat ini`} value={`${amanNow} / ${baris.length}`} caption="Dengan threshold resmi" />
          <StatCard label={`${lv.label} aman (simulasi)`} value={`${amanSim} / ${baris.length}`} caption="Dengan pengaturan di atas" accent={amanSim < amanNow ? 'text-[#DC2626]' : 'text-[#047857]'} />
          <StatCard label={`${lv.label} berubah status`} value={berubah} caption="Aman ↔ perlu perhatian" accent={berubah ? 'text-[#D97706]' : 'text-[#64748B]'} />
        </div>

        {baris.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#64748B]">Belum ada data capaian untuk disimulasikan.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="tabel-simulator">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">
                  <th className="py-2 pr-4">{lv.label}</th>
                  <th className="py-2 pr-4">Rata-rata</th>
                  <th className="py-2 pr-4">Threshold saat ini → simulasi</th>
                  <th className="py-2 pr-4">Mencapai target saat ini</th>
                  <th className="py-2 pr-4">Mencapai target simulasi</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {baris.map((b) => {
                  const d = b.pctSim - b.pctNow
                  return (
                    <tr
                      key={b.c.id}
                      onClick={() => setCplHistogram(b.c.id)}
                      className={`cursor-pointer ${cplHistogram === b.c.id ? 'bg-[#F8FAFC]' : 'hover:bg-[#F8FAFC]'}`}
                    >
                      <td className="py-2.5 pr-4 font-semibold text-[#142B4A]">{b.c.kode} <span className="text-xs font-normal text-[#94A3B8]">({b.n})</span></td>
                      <td className="py-2.5 pr-4 text-xs">{fmt(b.rata)}%</td>
                      <td className="py-2.5 pr-4 text-xs">{fmt(b.c.threshold, 0)}% → <span className="font-bold">{fmt(thSimulasi(b.c), 0)}%</span></td>
                      <td className="py-2.5 pr-4 text-xs">{fmt(b.pctNow, 0)}%</td>
                      <td className="py-2.5 pr-4 text-xs">
                        <span className="font-bold text-[#142B4A]">{fmt(b.pctSim, 0)}%</span>
                        {Math.abs(d) >= 0.5 && <span className={`ml-1 ${d > 0 ? 'text-[#047857]' : 'text-[#DC2626]'}`}>({d > 0 ? '+' : ''}{fmt(d, 0)})</span>}
                      </td>
                      <td className="py-2.5 text-xs">
                        <Badge tone={b.amanNow ? 'success' : 'warning'}>{b.amanNow ? 'Aman' : 'Perhatian'}</Badge>
                        {b.amanNow !== b.amanSim && (
                          <> <span className="text-[#94A3B8]">→</span> <Badge tone={b.amanSim ? 'success' : 'danger'}>{b.amanSim ? 'Aman' : 'Perhatian'}</Badge></>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-[#94A3B8]">Klik baris {lv.label} untuk melihat sebaran nilainya di bawah.</p>
          </div>
        )}
      </SectionCard>

      {histo && histo.n > 0 && (
        <SectionCard
          title={`Sebaran Capaian ${histo.c.kode}`}
          description={`${histo.n} mahasiswa. Batang merah berada di bawah threshold simulasi ${fmt(histo.th, 0)}%.`}
        >
          <div className="h-[260px]" data-testid="histogram-cpl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histo.bins} margin={{ left: -16, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="rentang" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [`${v} mahasiswa`, 'Jumlah']} labelFormatter={(l) => `Nilai ${l}`} />
                <ReferenceLine x={histo.bins[Math.min(9, Math.floor(histo.th / 10))].rentang} stroke="#EF4444" strokeDasharray="4 4" />
                <Bar dataKey="jumlah" radius={[4, 4, 0, 0]}>
                  {histo.bins.map((b) => <Cell key={b.batas} fill={b.batas + 10 <= histo.th ? '#F87171' : '#1A3A6B'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
