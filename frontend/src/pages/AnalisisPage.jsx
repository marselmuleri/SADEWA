import { useEffect, useState } from 'react'
import api from '../services/api'
import PrediksiCard from '../components/PrediksiCard'
import FeatureImportanceChart from '../components/FeatureImportanceChart'

export default function AnalisisPage() {
  const [mahasiswa, setMahasiswa] = useState([])
  const [cpl, setCpl] = useState([])
  const [mataKuliah, setMataKuliah] = useState([])
  const [form, setForm] = useState({ mahasiswa_id: '', mata_kuliah_id: '', cpl_id: '' })
  const [hasil, setHasil] = useState(null)

  useEffect(() => {
    api.get('/mahasiswa').then((r) => setMahasiswa(r.data))
    api.get('/cpl').then((r) => setCpl(r.data))
    api.get('/mata-kuliah').then((r) => setMataKuliah(r.data))
  }, [])

  const prediksi = async () => {
    const { data } = await api.post('/analisis/prediksi', {
      mahasiswa_id: Number(form.mahasiswa_id),
      mata_kuliah_id: Number(form.mata_kuliah_id),
      cpl_id: Number(form.cpl_id),
    })
    setHasil(data)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 border border-slate-200 grid md:grid-cols-4 gap-2">
        <select className="border rounded px-3 py-2" onChange={(e) => setForm({ ...form, mahasiswa_id: e.target.value })}>
          <option>Pilih Mahasiswa</option>
          {mahasiswa.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
        </select>
        <select className="border rounded px-3 py-2" onChange={(e) => setForm({ ...form, mata_kuliah_id: e.target.value })}>
          <option>Pilih MK</option>
          {mataKuliah.map((m) => <option key={m.id} value={m.id}>{m.nama_mk}</option>)}
        </select>
        <select className="border rounded px-3 py-2" onChange={(e) => setForm({ ...form, cpl_id: e.target.value })}>
          <option>Pilih CPL</option>
          {cpl.map((c) => <option key={c.id} value={c.id}>{c.kode_cpl}</option>)}
        </select>
        <button className="bg-primary text-white rounded" onClick={prediksi}>Prediksi</button>
      </div>

      {hasil && (
        <div className="grid md:grid-cols-2 gap-4">
          <PrediksiCard data={hasil} />
          <FeatureImportanceChart featureImportance={hasil.feature_importance} />
        </div>
      )}
    </div>
  )
}
