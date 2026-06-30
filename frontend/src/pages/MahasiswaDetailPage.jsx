import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import CPLRadarChart from '../components/CPLRadarChart'
import EarlyWarningBadge from '../components/EarlyWarningBadge'
import Modal from '../components/Modal'
import ToastContainer from '../components/ToastContainer'
import useToast from '../hooks/useToast'
import { useRole } from '../hooks/useRole'

const nilaiInit = {
  mata_kuliah_id: '',
  cpmk_id: '',
  jenis: 'tugas',
  nilai: '',
  semester: 'Ganjil',
  tahun_akademik: '',
}

export default function MahasiswaDetailPage() {
  const { canEdit, canDelete } = useRole()
  const { toasts, pushToast } = useToast()
  const { id } = useParams()
  const [mahasiswa, setMahasiswa] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [cplData, setCplData] = useState([])
  const [nilaiRows, setNilaiRows] = useState([])
  const [mkOptions, setMkOptions] = useState([])
  const [cpmkOptions, setCpmkOptions] = useState([])
  const [openModal, setOpenModal] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [selectedNilai, setSelectedNilai] = useState(null)
  const [nilaiForm, setNilaiForm] = useState(nilaiInit)

  const mkMap = mkOptions.reduce((acc, item) => ({ ...acc, [item.id]: item.nama_mk }), {})
  const cpmkMap = cpmkOptions.reduce((acc, item) => ({ ...acc, [item.id]: item.kode_cpmk }), {})

  const loadData = async () => {
    const [mhsRes, warningRes, cplRes, nilaiRes, mkRes] = await Promise.all([
      api.get(`/mahasiswa/${id}`),
      api.get('/analisis/early-warning'),
      api.get('/analisis/ketercapaian-cpl/1'),
      api.get('/penilaian', { params: { mahasiswa_id: Number(id) } }),
      api.get('/mata-kuliah'),
    ])
    setMahasiswa(mhsRes.data)
    setWarnings(warningRes.data)
    setCplData(cplRes.data)
    setNilaiRows(nilaiRes.data)
    setMkOptions(mkRes.data)
  }

  useEffect(() => {
    loadData().catch(() => pushToast('Gagal memuat detail mahasiswa', 'error'))
  }, [id])

  const warning = warnings.find((w) => w.mahasiswa_id === Number(id))

  const fetchCpmk = async (mkId) => {
    const { data } = await api.get('/cpmk', { params: { mk_id: Number(mkId) } })
    setCpmkOptions(data)
  }

  const openInput = async () => {
    setSelectedNilai(null)
    setNilaiForm(nilaiInit)
    setOpenModal(true)
  }

  const openEditNilai = async (row) => {
    setSelectedNilai(row)
    setNilaiForm({
      mata_kuliah_id: row.mata_kuliah_id,
      cpmk_id: row.cpmk_id,
      jenis: row.jenis,
      nilai: row.nilai,
      semester: row.semester,
      tahun_akademik: row.tahun_akademik,
    })
    await fetchCpmk(row.mata_kuliah_id)
    setOpenModal(true)
  }

  const submitNilai = async (e) => {
    e.preventDefault()
    if (!/^\d{4}\/\d{4}$/.test(nilaiForm.tahun_akademik)) {
      pushToast('Format tahun akademik harus YYYY/YYYY', 'error')
      return
    }
    const payload = {
      mahasiswa_id: Number(id),
      mata_kuliah_id: Number(nilaiForm.mata_kuliah_id),
      cpmk_id: Number(nilaiForm.cpmk_id),
      jenis: nilaiForm.jenis,
      nilai: Number(nilaiForm.nilai),
      semester: nilaiForm.semester,
      tahun_akademik: nilaiForm.tahun_akademik,
    }

    try {
      if (selectedNilai) {
        await api.put(`/penilaian/${selectedNilai.id}`, payload)
        pushToast('Nilai berhasil diupdate')
      } else {
        await api.post('/penilaian', payload)
        pushToast('Nilai berhasil disimpan')
      }
      setOpenModal(false)
      await loadData()
    } catch {
      pushToast('Gagal menyimpan nilai', 'error')
    }
  }

  const deleteNilai = async () => {
    if (!selectedNilai) return
    try {
      await api.delete(`/penilaian/${selectedNilai.id}`)
      pushToast('Nilai berhasil dihapus')
      setOpenDelete(false)
      await loadData()
    } catch {
      pushToast('Gagal menghapus nilai', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} />
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <h2 className="text-xl font-semibold">{mahasiswa?.nama}</h2>
        <p className="text-sm text-slate-500">NIM: {mahasiswa?.nim}</p>
        <div className="mt-2"><EarlyWarningBadge isWarning={!!warning} /></div>
      </div>
      <CPLRadarChart data={cplData} />

      <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Input Nilai</h3>
          {canEdit && <button className="bg-primary text-white px-3 py-2 rounded" onClick={openInput}>+ Input Nilai Baru</button>}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th>Mata Kuliah</th><th>CPMK</th><th>Jenis</th><th>Nilai</th><th>Semester</th><th>Tahun</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {nilaiRows.map((n) => (
              <tr key={n.id} className="border-b">
                <td>{mkMap[n.mata_kuliah_id] || n.mata_kuliah_id}</td>
                <td>{cpmkMap[n.cpmk_id] || n.cpmk_id}</td>
                <td className="capitalize">{n.jenis}</td>
                <td>{n.nilai}</td>
                <td>{n.semester}</td>
                <td>{n.tahun_akademik}</td>
                <td>
                  <div className="flex gap-2">
                    {canEdit && <button className="text-amber-600" onClick={() => openEditNilai(n)}>Edit</button>}
                    {canDelete && <button className="text-red-600" onClick={() => { setSelectedNilai(n); setOpenDelete(true) }}>Hapus</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={openModal} title={selectedNilai ? 'Edit Nilai' : 'Input Nilai Baru'} onClose={() => setOpenModal(false)}>
        <form onSubmit={submitNilai} className="space-y-3">
          <select
            className="w-full border rounded px-3 py-2"
            value={nilaiForm.mata_kuliah_id}
            onChange={async (e) => {
              const mkId = e.target.value
              setNilaiForm((f) => ({ ...f, mata_kuliah_id: mkId, cpmk_id: '' }))
              if (mkId) await fetchCpmk(mkId)
            }}
            required
          >
            <option value="">Pilih Mata Kuliah</option>
            {mkOptions.map((mk) => <option key={mk.id} value={mk.id}>{mk.nama_mk}</option>)}
          </select>

          <select className="w-full border rounded px-3 py-2" value={nilaiForm.cpmk_id} onChange={(e) => setNilaiForm((f) => ({ ...f, cpmk_id: e.target.value }))} required>
            <option value="">Pilih CPMK</option>
            {cpmkOptions.map((c) => <option key={c.id} value={c.id}>{c.kode_cpmk}</option>)}
          </select>

          <select className="w-full border rounded px-3 py-2" value={nilaiForm.jenis} onChange={(e) => setNilaiForm((f) => ({ ...f, jenis: e.target.value }))}>
            <option value="tugas">Tugas</option>
            <option value="kuis">Kuis</option>
            <option value="uts">UTS</option>
            <option value="uas">UAS</option>
            <option value="proyek">Proyek</option>
          </select>

          <input type="number" min="0" max="100" step="0.1" className="w-full border rounded px-3 py-2" placeholder="Nilai" value={nilaiForm.nilai} onChange={(e) => setNilaiForm((f) => ({ ...f, nilai: e.target.value }))} required />

          <select className="w-full border rounded px-3 py-2" value={nilaiForm.semester} onChange={(e) => setNilaiForm((f) => ({ ...f, semester: e.target.value }))}>
            <option value="Ganjil">Ganjil</option>
            <option value="Genap">Genap</option>
          </select>

          <input className="w-full border rounded px-3 py-2" placeholder="2023/2024" value={nilaiForm.tahun_akademik} onChange={(e) => setNilaiForm((f) => ({ ...f, tahun_akademik: e.target.value }))} required />

          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-2 border rounded" onClick={() => setOpenModal(false)}>Batal</button>
            <button className="px-3 py-2 bg-primary text-white rounded">{selectedNilai ? 'Update' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={openDelete} title="Konfirmasi Hapus Nilai" onClose={() => setOpenDelete(false)} size="max-w-md">
        <p className="text-sm text-slate-600">Yakin ingin menghapus data nilai ini?</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-3 py-2 border rounded" onClick={() => setOpenDelete(false)}>Batal</button>
          <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={deleteNilai}>Ya, Hapus</button>
        </div>
      </Modal>
    </div>
  )
}
