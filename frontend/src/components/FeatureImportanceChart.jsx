import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function FeatureImportanceChart({ featureImportance = {} }) {
  const data = Object.entries(featureImportance).map(([name, value]) => ({ name, value: Number(value.toFixed?.(3) ?? value) }))

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 h-80">
      <h3 className="font-semibold mb-3">Feature Importance</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart layout="vertical" data={data}>
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" width={110} />
          <Tooltip />
          <Bar dataKey="value" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
