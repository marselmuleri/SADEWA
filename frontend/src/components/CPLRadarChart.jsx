import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

export default function CPLRadarChart({ data = [] }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm h-96">
      <h3 className="font-semibold mb-2">Radar Ketercapaian CPL</h3>
      <ResponsiveContainer width="100%" height="90%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="kode_cpl" />
          <PolarRadiusAxis />
          <Radar name="Ketercapaian" dataKey="persentase_ketercapaian" stroke="#2563eb" fill="#2563eb" fillOpacity={0.5} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
