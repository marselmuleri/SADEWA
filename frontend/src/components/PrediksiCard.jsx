export default function PrediksiCard({ data }) {
  const value = Number(data?.probabilitas_lulus || 0)
  const color = value >= 60 ? 'bg-success' : 'bg-warning'

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <h3 className="font-semibold mb-3">Prediksi Ketercapaian</h3>
      <div className="w-full bg-slate-100 rounded h-3 overflow-hidden">
        <div className={`${color} h-full`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <p className="mt-2 text-sm">Probabilitas Lulus: <b>{value}%</b></p>
      <p className="text-sm">Status: <b>{data?.prediksi || '-'}</b></p>
    </div>
  )
}
