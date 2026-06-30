import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import api from '../services/api'
import HeatmapGrid from '../components/HeatmapGrid'

export default function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState([])
  const [heatmap, setHeatmap] = useState([])

  useEffect(() => {
    api.get('/dashboard/ringkasan').then((r) => setSummary(r.data))
    api.get('/dashboard/tren-semester').then((r) => setTrend(r.data))
    api.get('/dashboard/heatmap').then((r) => setHeatmap(r.data))
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Total Mahasiswa" value={summary?.total_mahasiswa} />
        <Card title="Total MK" value={summary?.total_mata_kuliah} />
        <Card title="Total CPL" value={summary?.total_cpl} />
        <Card title="Rata CPL" value={`${summary?.rata_rata_ketercapaian_cpl || 0}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 h-80">
          <h3 className="font-semibold mb-3">Tren Ketercapaian Semester</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={trend}>
              <XAxis dataKey="tahun_akademik" />
              <YAxis />
              <Tooltip />
              <Line dataKey="rata_ketercapaian" stroke="#2563eb" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 h-80">
          <h3 className="font-semibold mb-3">Distribusi Trend</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={trend}>
              <XAxis dataKey="semester" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="rata_ketercapaian" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <h3 className="font-semibold mb-3">Heatmap CPMK per MK</h3>
        <HeatmapGrid data={heatmap} />
      </div>
    </div>
  )
}

function Card({ title, value }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-primary">{value ?? '-'}</p>
    </div>
  )
}
