import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ActionButton, SectionCard, StatCard } from '../../components/PageChrome'
import { exportToCsv } from '../../utils/csvExport'
import { formatNilai } from './portofolioShared'

const NAVY = '#1A3A6B'
const MERAH = '#DC2626'
const ORANYE = '#F4A300'
const GRID = '#E2E8F0'
const TICK = { fontSize: 11, fill: '#64748B' }

function BelumAdaNilai() {
  return (
    <SectionCard>
      <p className="py-6 text-center text-sm text-[#64748B]">
        Belum ada hasil kalkulasi nilai untuk mata kuliah ini. Nilai CP muncul setelah dosen pengampu menginput nilai
        dan menjalankan kalkulasi di menu Penilaian.
      </p>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Lihat Nilai CP
// ---------------------------------------------------------------------------

function SelNilai({ value, ambang }) {
  if (value === null || value === undefined) return <span className="text-[#CBD5E1]">-</span>
  const kurang = Number(value) < ambang
  return <span className={kurang ? 'font-semibold text-red-600' : 'text-[#142B4A]'}>{formatNilai(value)}</span>
}

export function NilaiCpSection({ data }) {
  const [cari, setCari] = useState('')
  const mahasiswa = data.mahasiswa || []
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    if (!q) return mahasiswa
    return mahasiswa.filter((m) => `${m.nim} ${m.nama}`.toLowerCase().includes(q))
  }, [mahasiswa, cari])

  if (!mahasiswa.length) {
    return (
      <SectionCard>
        <p className="py-6 text-center text-sm text-[#64748B]">Belum ada peserta di mata kuliah ini.</p>
      </SectionCard>
    )
  }

  const ekspor = () => {
    const headers = [
      { key: 'nim', label: 'NIM' },
      { key: 'nama', label: 'Nama' },
      { key: 'kelas', label: 'Kelas' },
      ...data.cpmk.map((c) => ({ key: `cpmk_${c.id}`, label: c.kode })),
      ...data.cpl.map((c) => ({ key: `cpl_${c.id}`, label: c.kode })),
      { key: 'nilai_akhir', label: 'Nilai Akhir' },
      { key: 'nilai_huruf', label: 'Huruf' },
      { key: 'status_outcome', label: 'Status' },
    ]
    const rows = mahasiswa.map((m) => {
      const row = { nim: m.nim, nama: m.nama, kelas: m.kelas, nilai_akhir: m.nilai_akhir, nilai_huruf: m.nilai_huruf, status_outcome: m.status_outcome }
      data.cpmk.forEach((c) => { row[`cpmk_${c.id}`] = m.cpmk[c.id] })
      data.cpl.forEach((c) => { row[`cpl_${c.id}`] = m.cpl[c.id] })
      return row
    })
    exportToCsv(`nilai-cp-${data.mata_kuliah.kode}`, headers, rows)
  }

  return (
    <SectionCard
      title="Nilai Capaian Pembelajaran per Mahasiswa"
      description={`${mahasiswa.length} peserta · ${data.jumlah_dinilai} sudah dinilai. Angka merah berada di bawah ambang ketercapaian.`}
      action={
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[#94A3B8]" />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari NIM / nama"
              className="h-9 w-48 rounded-[6px] border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs focus:border-[#1A3A6B] focus:outline-none"
            />
          </label>
          <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" onClick={ekspor}>
            <Download className="h-3.5 w-3.5" /> Ekspor CSV
          </ActionButton>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6D778E]">
              <th rowSpan={2} className="py-2 pr-3 text-left">NIM</th>
              <th rowSpan={2} className="py-2 pr-3 text-left">Nama</th>
              {data.cpmk.length ? <th colSpan={data.cpmk.length} className="border-l border-[#E2E8F0] px-2 py-1 text-center">CPMK</th> : null}
              {data.cpl.length ? <th colSpan={data.cpl.length} className="border-l border-[#E2E8F0] px-2 py-1 text-center">CPL</th> : null}
              <th colSpan={2} className="border-l border-[#E2E8F0] px-2 py-1 text-center">Nilai Akhir</th>
            </tr>
            <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold text-[#142B4A]">
              {data.cpmk.map((c, i) => (
                <th key={c.id} title={c.deskripsi} className={`px-2 py-1.5 text-right ${i === 0 ? 'border-l border-[#E2E8F0]' : ''}`}>{c.kode}</th>
              ))}
              {data.cpl.map((c, i) => (
                <th key={c.id} title={c.deskripsi} className={`px-2 py-1.5 text-right ${i === 0 ? 'border-l border-[#E2E8F0]' : ''}`}>{c.kode}</th>
              ))}
              <th className="border-l border-[#E2E8F0] px-2 py-1.5 text-right">Angka</th>
              <th className="px-2 py-1.5 text-center">Huruf</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((m) => (
              <tr key={m.peserta_id} className="border-b border-[#EEF2F6] hover:bg-[#F8FAFC]">
                <td className="py-2 pr-3 font-mono">{m.nim}</td>
                <td className="py-2 pr-3">
                  {m.nama}
                  {m.kelas ? <span className="ml-1 text-[#94A3B8]">({m.kelas})</span> : null}
                </td>
                {data.cpmk.map((c, i) => (
                  <td key={c.id} className={`px-2 py-2 text-right tabular-nums ${i === 0 ? 'border-l border-[#EEF2F6]' : ''}`}>
                    <SelNilai value={m.cpmk[c.id]} ambang={c.ambang} />
                  </td>
                ))}
                {data.cpl.map((c, i) => (
                  <td key={c.id} className={`px-2 py-2 text-right tabular-nums ${i === 0 ? 'border-l border-[#EEF2F6]' : ''}`}>
                    <SelNilai value={m.cpl[c.id]} ambang={c.ambang} />
                  </td>
                ))}
                <td className="border-l border-[#EEF2F6] px-2 py-2 text-right font-semibold tabular-nums">{formatNilai(m.nilai_akhir)}</td>
                <td className="px-2 py-2 text-center font-semibold">{m.nilai_huruf || '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#E2E8F0] font-semibold text-[#142B4A]">
              <td colSpan={2} className="py-2 pr-3">Rata-rata kelas</td>
              {data.cpmk.map((c, i) => (
                <td key={c.id} className={`px-2 py-2 text-right tabular-nums ${i === 0 ? 'border-l border-[#EEF2F6]' : ''}`}>{formatNilai(c.rata_rata)}</td>
              ))}
              {data.cpl.map((c, i) => (
                <td key={c.id} className={`px-2 py-2 text-right tabular-nums ${i === 0 ? 'border-l border-[#EEF2F6]' : ''}`}>{formatNilai(c.rata_rata)}</td>
              ))}
              <td className="border-l border-[#EEF2F6] px-2 py-2 text-right tabular-nums">{formatNilai(data.sebaran.statistik?.rata_rata)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Lihat Grafik Capaian
// ---------------------------------------------------------------------------

function TooltipCapaian({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="max-w-xs rounded-[6px] border border-[#E2E8F0] bg-white p-3 text-xs shadow-sm">
      <div className="font-semibold text-[#142B4A]">{d.kode}</div>
      <p className="mt-1 text-[#64748B]">{d.deskripsi}</p>
      <div className="mt-2 space-y-0.5 text-[#142B4A]">
        <div>Rata-rata: <b>{formatNilai(d.rata_rata)}</b> (ambang {formatNilai(d.ambang)})</div>
        <div>Tercapai: <b>{d.jumlah_tercapai}/{d.jumlah_dinilai}</b> mahasiswa ({formatNilai(d.persen_tercapai)}%)</div>
      </div>
    </div>
  )
}

function GrafikBatang({ judul, deskripsi, items, kunci, ambangGaris }) {
  const terisi = items.filter((i) => i[kunci] !== null && i[kunci] !== undefined)
  return (
    <SectionCard title={judul} description={deskripsi}>
      {terisi.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#64748B]">Belum ada data.</p>
      ) : (
        <div style={{ height: Math.max(220, 56 + terisi.length * 34) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={terisi} layout="vertical" margin={{ top: 8, right: 48, bottom: 8, left: 8 }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" domain={[0, 100]} tick={TICK} />
              <YAxis type="category" dataKey="kode" width={80} tick={TICK} />
              <Tooltip content={<TooltipCapaian />} cursor={{ fill: '#F1F5F9' }} />
              {ambangGaris !== undefined ? (
                <ReferenceLine x={ambangGaris} stroke={ORANYE} strokeDasharray="4 4" label={{ value: `Ambang ${ambangGaris}`, position: 'top', fontSize: 10, fill: '#B45309' }} />
              ) : null}
              <Bar dataKey={kunci} radius={[0, 3, 3, 0]} maxBarSize={22}>
                {terisi.map((d) => (
                  <Cell key={d.id} fill={kunci === 'rata_rata' && d.rata_rata < d.ambang ? MERAH : NAVY} />
                ))}
                <LabelList dataKey={kunci} position="right" formatter={(v) => formatNilai(v)} style={{ fontSize: 11, fill: '#142B4A' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}

function ambangSeragam(items) {
  const nilai = [...new Set(items.map((i) => i.ambang))]
  return nilai.length === 1 ? nilai[0] : undefined
}

export function GrafikCapaianSection({ data }) {
  if (!data.jumlah_dinilai && !data.cpmk.some((c) => c.jumlah_dinilai)) return <BelumAdaNilai />
  const cpmkTercapai = data.cpmk.filter((c) => c.rata_rata !== null && c.rata_rata >= c.ambang).length
  const cplTercapai = data.cpl.filter((c) => c.rata_rata !== null && c.rata_rata >= c.ambang).length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Peserta dinilai" value={`${data.jumlah_dinilai}/${data.jumlah_peserta}`} />
        <StatCard label="CPMK tercapai (rata-rata kelas)" value={`${cpmkTercapai}/${data.cpmk.length}`} />
        <StatCard label="CPL tercapai (rata-rata kelas)" value={`${cplTercapai}/${data.cpl.length}`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <GrafikBatang
          judul="Rata-rata Capaian CPMK"
          deskripsi="Batang merah: rata-rata kelas di bawah ambang."
          items={data.cpmk}
          kunci="rata_rata"
          ambangGaris={ambangSeragam(data.cpmk)}
        />
        <GrafikBatang
          judul="Rata-rata Capaian CPL"
          deskripsi="Kontribusi mata kuliah ini terhadap CPL prodi."
          items={data.cpl}
          kunci="rata_rata"
          ambangGaris={ambangSeragam(data.cpl)}
        />
        <GrafikBatang
          judul="Persentase Mahasiswa Mencapai CPMK"
          deskripsi="Proporsi mahasiswa dengan nilai CPMK ≥ ambang."
          items={data.cpmk}
          kunci="persen_tercapai"
        />
        <GrafikBatang
          judul="Persentase Mahasiswa Mencapai CPL"
          deskripsi="Proporsi mahasiswa dengan nilai CPL ≥ ambang CPL."
          items={data.cpl}
          kunci="persen_tercapai"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lihat Sebaran Nilai
// ---------------------------------------------------------------------------

function GrafikSebaran({ data, dataKey, height = 260 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={dataKey} tick={TICK} interval={0} />
          <YAxis allowDecimals={false} tick={TICK} />
          <Tooltip cursor={{ fill: '#F1F5F9' }} formatter={(v) => [`${v} mahasiswa`, 'Jumlah']} />
          <Bar dataKey="jumlah" fill={NAVY} radius={[3, 3, 0, 0]} maxBarSize={48}>
            <LabelList dataKey="jumlah" position="top" style={{ fontSize: 11, fill: '#142B4A' }} formatter={(v) => (v ? v : '')} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SebaranNilaiSection({ data }) {
  const s = data.sebaran
  if (!s.statistik) return <BelumAdaNilai />
  const st = s.statistik

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Rata-rata" value={formatNilai(st.rata_rata)} caption={`Median ${formatNilai(st.median)}`} />
        <StatCard label="Rentang" value={`${formatNilai(st.minimum)}–${formatNilai(st.maksimum)}`} caption={`Simpangan baku ${formatNilai(st.simpangan_baku)}`} />
        <StatCard label="Dinilai" value={`${st.n}/${data.jumlah_peserta}`} caption="mahasiswa" />
        <StatCard
          label="Lulus (Tercapai)"
          value={`${st.jumlah_lulus}`}
          caption={`${formatNilai((st.jumlah_lulus / st.n) * 100)}% dari yang dinilai`}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Sebaran Nilai Huruf" description="Jumlah mahasiswa per nilai huruf.">
          <GrafikSebaran data={s.huruf} dataKey="huruf" />
        </SectionCard>
        <SectionCard title="Sebaran Nilai Akhir" description="Histogram nilai angka, interval 10 poin.">
          <GrafikSebaran data={s.rentang} dataKey="label" />
        </SectionCard>
      </div>
      <SectionCard title="Tabel Sebaran Nilai Huruf">
        <table className="w-full max-w-md text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">
              <th className="py-2">Huruf</th>
              <th className="py-2 text-right">Jumlah</th>
              <th className="py-2 text-right">Persen</th>
            </tr>
          </thead>
          <tbody>
            {s.huruf.map((h) => (
              <tr key={h.huruf} className="border-b border-[#EEF2F6]">
                <td className="py-1.5 font-semibold">{h.huruf}</td>
                <td className="py-1.5 text-right tabular-nums">{h.jumlah}</td>
                <td className="py-1.5 text-right tabular-nums">{formatNilai((h.jumlah / st.n) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  )
}
