import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ActionButton, SectionCard } from '../PageChrome'
import { exportToCsv } from '../../utils/csvExport'
import { TARGET_KETUNTASAN, fmt, warnaCapaian } from './analitikModel'

const WARNA = ['#1A3A6B', '#F4A300', '#10B981', '#6366F1', '#F43F5E', '#0EA5E9', '#8B5CF6', '#D97706']

const METRIK = {
  mean: { label: 'Rata-rata capaian', satuan: '%', key: 'mean' },
  pct: { label: '% mahasiswa mencapai target', satuan: '%', key: 'pct' },
}

function Chip({ aktif, onClick, children, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      data-testid={testId}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        aktif ? 'border-[#1A3A6B] bg-[#1A3A6B] text-white' : 'border-[#CBD5E1] bg-white text-[#142B4A] hover:border-[#1A3A6B]'
      }`}
    >
      {children}
    </button>
  )
}

export default function PerbandinganAngkatan({ model }) {
  const angkatanList = model.angkatan
  const [dipilih, setDipilih] = useState([])
  const [metrik, setMetrik] = useState('mean')
  const [level, setLevel] = useState('cpl')
  const lv = model.level[level]

  // Default: dua angkatan terakhir
  useEffect(() => {
    setDipilih(angkatanList.slice(-2))
  }, [angkatanList])

  const urut = [...dipilih].sort((a, b) => a - b)
  const toggle = (a) => setDipilih((d) => (d.includes(a) ? d.filter((x) => x !== a) : [...d, a]))
  const targetMetrik = (c) => (metrik === 'mean' ? c.threshold : TARGET_KETUNTASAN)

  const baris = useMemo(
    () =>
      lv.rows.map((c) => {
        const perAngkatan = Object.fromEntries(angkatanList.map((a) => [a, model.statsL(level, c.id, a)]))
        return { c, perAngkatan }
      }),
    [model, angkatanList, level, lv],
  )

  const chartData = baris.map(({ c, perAngkatan }) => ({
    name: c.kode,
    ...Object.fromEntries(urut.map((a) => [a, perAngkatan[a]?.n ? Number(fmt(perAngkatan[a][metrik])) : null])),
  }))

  const ambangGaris = metrik === 'pct' ? TARGET_KETUNTASAN : Math.round(mean(lv.rows.map((c) => c.threshold)) || 70)

  const exportCsv = () =>
    exportToCsv(
      `Perbandingan_Angkatan_${lv.label}_${metrik}`,
      [{ key: 'cpl', label: lv.label }, ...angkatanList.flatMap((a) => [
        { key: `${a}_nilai`, label: `${a} ${METRIK[metrik].label}` },
        { key: `${a}_n`, label: `${a} jumlah mahasiswa` },
      ])],
      baris.map(({ c, perAngkatan }) => ({
        cpl: c.kode,
        ...Object.fromEntries(angkatanList.flatMap((a) => [
          [`${a}_nilai`, perAngkatan[a].n ? fmt(perAngkatan[a][metrik]) : ''],
          [`${a}_n`, perAngkatan[a].n],
        ])),
      })),
    )

  if (!angkatanList.length) {
    return (
      <SectionCard title="Perbandingan Antar Angkatan">
        <p className="py-8 text-center text-sm text-[#64748B]">
          Belum ada data capaian yang memiliki angkatan. Pastikan data mahasiswa memiliki angkatan dan mata kuliah sudah dikalkulasi.
        </p>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Perbandingan Antar Angkatan"
        description={`Pilih dua angkatan atau lebih untuk membandingkan capaian setiap ${lv.label}${model.scope === 'mata_kuliah' ? ' di mata kuliah ini' : ''}.`}
        action={
          <ActionButton variant="secondary" onClick={exportCsv} data-testid="btn-export-perbandingan">
            <Download className="h-4 w-4" /> Export CSV
          </ActionButton>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#142B4A]">Angkatan:</span>
            {angkatanList.map((a) => (
              <Chip key={a} aktif={dipilih.includes(a)} onClick={() => toggle(a)} testId={`chip-angkatan-${a}`}>{a}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#142B4A]">Level:</span>
            {Object.entries(model.level).map(([k, l]) => (
              <Chip key={k} aktif={level === k} onClick={() => setLevel(k)} testId={`chip-level-${k}`}>{l.label}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#142B4A]">Metrik:</span>
            {Object.entries(METRIK).map(([k, m]) => (
              <Chip key={k} aktif={metrik === k} onClick={() => setMetrik(k)} testId={`chip-metrik-${k}`}>{m.label}</Chip>
            ))}
          </div>
        </div>

        {urut.length < 2 ? (
          <p className="rounded-md border border-dashed border-[#CBD5E1] py-8 text-center text-sm text-[#64748B]">
            Pilih minimal dua angkatan untuk dibandingkan.
          </p>
        ) : (
          <>
            <div className="h-[340px]" data-testid="chart-perbandingan-angkatan">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: -12, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip formatter={(v, name) => [v === null ? 'tidak ada data' : `${Number(v).toFixed(1)}%`, `Angkatan ${name}`]} />
                  <Legend formatter={(v) => `Angkatan ${v}`} />
                  <ReferenceLine y={ambangGaris} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `Target ${ambangGaris}%`, position: 'insideTopRight', fill: '#EF4444', fontSize: 11 }} />
                  {urut.map((a) => (
                    <Bar key={a} dataKey={String(a)} name={String(a)} fill={WARNA[angkatanList.indexOf(a) % WARNA.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm" data-testid="tabel-perbandingan-angkatan">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">
                    <th className="py-2 pr-4">{lv.label}</th>
                    {urut.map((a) => <th key={a} className="py-2 pr-4">Angkatan {a}</th>)}
                    <th className="py-2">Selisih {urut[0]} → {urut[urut.length - 1]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F7]">
                  {baris.map(({ c, perAngkatan }) => {
                    const awal = perAngkatan[urut[0]]
                    const akhir = perAngkatan[urut[urut.length - 1]]
                    const delta = awal?.n && akhir?.n ? akhir[metrik] - awal[metrik] : null
                    return (
                      <tr key={c.id}>
                        <td className="py-2.5 pr-4 font-semibold text-[#142B4A]" title={c.deskripsi}>{c.kode}</td>
                        {urut.map((a) => {
                          const s = perAngkatan[a]
                          const tercapai = s.n && s[metrik] >= targetMetrik(c)
                          return (
                            <td key={a} className="py-2.5 pr-4 text-xs">
                              {s.n ? (
                                <>
                                  <span className={`font-bold ${tercapai ? 'text-[#047857]' : 'text-[#B45309]'}`}>{fmt(s[metrik])}%</span>
                                  <span className="text-[#94A3B8]"> · {s.n} mhs</span>
                                </>
                              ) : <span className="text-[#94A3B8]">–</span>}
                            </td>
                          )
                        })}
                        <td className="py-2.5 text-xs font-bold">
                          {delta === null ? <span className="text-[#94A3B8]">–</span> : (
                            <span className={delta >= 0 ? 'text-[#047857]' : 'text-[#DC2626]'}>
                              {delta >= 0 ? '▲ +' : '▼ '}{fmt(delta)}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        title={`Heatmap ${lv.label} × Angkatan`}
        description={`Warna menunjukkan jarak ke target (${metrik === 'mean' ? `threshold masing-masing ${lv.label}` : `${TARGET_KETUNTASAN}% mahasiswa`}). Klik judul kolom angkatan untuk menambah/melepas dari perbandingan di atas.`}
      >
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1 text-xs" data-testid="heatmap-cpl-angkatan">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">{lv.label}</th>
                {angkatanList.map((a) => (
                  <th key={a} className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => toggle(a)}
                      aria-pressed={dipilih.includes(a)}
                      className={`w-16 rounded px-1 py-1 font-semibold ${dipilih.includes(a) ? 'bg-[#1A3A6B] text-white' : 'text-[#142B4A] hover:bg-[#F2F4F7]'}`}
                    >
                      {a}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {baris.map(({ c, perAngkatan }) => (
                <tr key={c.id}>
                  <th className="whitespace-nowrap px-2 py-1 text-left font-semibold text-[#142B4A]" title={c.deskripsi}>{c.kode}</th>
                  {angkatanList.map((a) => {
                    const s = perAngkatan[a]
                    const v = s.n ? s[metrik] : null
                    const w = warnaCapaian(v, targetMetrik(c))
                    return (
                      <td
                        key={a}
                        className="h-10 w-16 rounded text-center font-semibold"
                        style={{ backgroundColor: w.bg, color: w.fg }}
                        title={s.n ? `${c.kode} · Angkatan ${a}\nRata-rata ${fmt(s.mean)}%\n${fmt(s.pct, 0)}% mencapai target\n${s.n} mahasiswa` : 'Tidak ada data'}
                      >
                        {v === null ? '–' : fmt(v, 0)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#64748B]">
          {[['≥ target +10', 85, 75], ['≥ target', 72, 70], ['< target (≤10)', 65, 70], ['jauh di bawah', 40, 70]].map(([lbl, v, t]) => {
            const w = warnaCapaian(v, t)
            return (
              <span key={lbl} className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: w.bg }} /> {lbl}
              </span>
            )
          })}
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#F2F4F7]" /> tidak ada data</span>
        </div>
      </SectionCard>
    </div>
  )
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}
