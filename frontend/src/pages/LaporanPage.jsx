import { useEffect, useState } from 'react'
import api from '../services/api'

export default function LaporanPage() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    api.get('/analisis/ketercapaian-cpl/1').then((r) => setRows(r.data))
  }, [])

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <h2 className="font-semibold mb-3">Laporan Ketercapaian CPL (Akreditasi)</h2>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left"><th>Kode CPL</th><th>Persentase</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cpl_id} className="border-b"><td>{r.kode_cpl}</td><td>{r.persentase_ketercapaian}%</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
