import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ActionButton, SectionCard } from '../PageChrome'
import { exportToCsv } from '../../utils/csvExport'
import { fmt } from './analitikModel'

const WARNA = ['#1A3A6B', '#F4A300', '#10B981', '#6366F1', '#F43F5E', '#0EA5E9', '#8B5CF6', '#D97706']

// Tren rata-rata capaian per angkatan, dihitung dari data analitik yang sudah dimuat
// (dipakai pada cakupan satu mata kuliah).
export default function TrenAngkatan({ model }) {
  const [level, setLevel] = useState('cpl')
  const lv = model.level[level]
  const [dipilih, setDipilih] = useState([])

  useEffect(() => {
    setDipilih(lv.rows.map((r) => r.id))
  }, [lv])

  const angkatan = model.angkatan
  const rows = lv.rows.filter((r) => dipilih.includes(r.id))
  const data = useMemo(
    () => angkatan.map((a) => ({
      angkatan: a,
      ...Object.fromEntries(rows.map((r) => {
        const s = model.statsL(level, r.id, a)
        return [r.kode, s.n ? Number(fmt(s.mean)) : null]
      })),
    })),
    [model, level, angkatan, rows],
  )
  const ambang = Math.round(rows.reduce((s, r) => s + r.threshold, 0) / (rows.length || 1)) || 70

  const exportCsv = () =>
    exportToCsv(
      `Tren_${lv.label}_Per_Angkatan`,
      [{ key: 'kode', label: lv.label }, ...angkatan.map((a) => ({ key: String(a), label: `Angkatan ${a}` }))],
      lv.rows.map((r) => ({
        kode: r.kode,
        ...Object.fromEntries(angkatan.map((a) => {
          const s = model.statsL(level, r.id, a)
          return [String(a), s.n ? fmt(s.mean) : '']
        })),
      })),
    )

  const toggle = (id) => setDipilih((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))

  return (
    <SectionCard
      title={`Tren Capaian ${lv.label} Antar Angkatan`}
      description="Rata-rata capaian per angkatan mahasiswa. Klik kode untuk menampilkan/menyembunyikan garisnya."
      action={
        <ActionButton variant="secondary" onClick={exportCsv} disabled={!angkatan.length} data-testid="btn-export-tren-mk">
          <Download className="h-4 w-4" /> Export CSV
        </ActionButton>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#142B4A]">Level:</span>
        {Object.entries(model.level).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={level === k}
            onClick={() => setLevel(k)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${level === k ? 'border-[#1A3A6B] bg-[#1A3A6B] text-white' : 'border-[#CBD5E1] bg-white text-[#142B4A]'}`}
          >
            {l.label}
          </button>
        ))}
        <span className="ml-3 text-xs font-semibold text-[#142B4A]">Tampilkan:</span>
        {lv.rows.map((r, i) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={dipilih.includes(r.id)}
            onClick={() => toggle(r.id)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${dipilih.includes(r.id) ? 'text-white' : 'border-[#CBD5E1] bg-white text-[#94A3B8]'}`}
            style={dipilih.includes(r.id) ? { backgroundColor: WARNA[i % WARNA.length], borderColor: WARNA[i % WARNA.length] } : undefined}
          >
            {r.kode}
          </button>
        ))}
      </div>

      {angkatan.length < 2 ? (
        <p className="py-8 text-center text-sm text-[#64748B]">
          Tren membutuhkan data dari minimal dua angkatan. Saat ini tersedia: {angkatan.length ? angkatan.join(', ') : 'belum ada'}.
        </p>
      ) : (
        <div className="h-[340px]" data-testid="chart-tren-mk">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: -12, right: 16, top: 10, bottom: 0 }}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="angkatan" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} unit="%" />
              <Tooltip formatter={(v) => (v === null ? 'tidak ada data' : `${Number(v).toFixed(1)}%`)} labelFormatter={(l) => `Angkatan ${l}`} />
              <Legend />
              <ReferenceLine y={ambang} stroke="#EF4444" strokeDasharray="4 4" />
              {rows.map((r) => (
                <Line
                  key={r.id}
                  type="monotone"
                  dataKey={r.kode}
                  stroke={WARNA[lv.rows.indexOf(r) % WARNA.length]}
                  strokeWidth={2}
                  connectNulls
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}
