export default function HeatmapGrid({ data = [] }) {
  const getColor = (value) => {
    if (value >= 80) return 'bg-green-500'
    if (value >= 60) return 'bg-yellow-400'
    return 'bg-red-500'
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {data.map((item, idx) => (
        <div key={idx} className={`rounded p-3 text-white ${getColor(item.ketercapaian)}`}>
          <p className="text-xs">{item.nama_mk}</p>
          <p className="font-semibold">{item.kode_cpmk}</p>
          <p className="text-sm">{item.ketercapaian}%</p>
        </div>
      ))}
    </div>
  )
}
