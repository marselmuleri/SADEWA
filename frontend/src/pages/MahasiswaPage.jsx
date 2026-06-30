import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import EarlyWarningBadge from '../components/EarlyWarningBadge'
import Modal from '../components/Modal'
import ToastContainer from '../components/ToastContainer'
import useToast from '../hooks/useToast'
import { useRole } from '../hooks/useRole'

const initialForm = { nim: '', nama: '', angkatan: '', program_studi_id: '' }

export default function MahasiswaPage() {
  const { isAdmin, isKaprodi, canDelete } = useRole()
  const { toasts, pushToast } = useToast()

  const [list, setList] = useState([])
  const [warnings, setWarnings] = useState([])
  const [prodiOptions, setProdiOptions] = useState([])
  const [q, setQ] = useState('')
  const [angkatan, setAngkatan] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)

  const canManage = isAdmin || isKaprodi

  const loadData = async () => {
    const params = {}
    if (q) params.search = q
    if (angkatan) params.angkatan = Number(angkatan)

    const [mhsRes, warningRes, prodiRes] = await Promise.all([
      api.get('/mahasiswa', { params }),
      api.get('/analisis/early-warning'),
      api.get('/prodi'),
    ])
    setList(mhsRes.data)
    setWarnings(warningRes.data)
    setProdiOptions(prodiRes.data)
  }

  useEffect(() => {
    loadData().catch(() => pushToast('Gagal memuat data mahasiswa', 'error'))
  }, [])

  const filtered = useMemo(() => {
    return list.filter((m) =>
      (m.nama.toLowerCase().includes(q.toLowerCase()) || m.nim.includes(q)) &&
      (!angkatan || String(m.angkatan) === angkatan)
    )
  }, [list, q, angkatan])

  const openTambah = () => {
    setSelected(null)
    setForm(initialForm)
    setOpenForm(true)
  }

  const openEdit = (item) => {
    setSelected(item)
    setForm({
      nim: item.nim,
      nama: item.nama,
      angkatan: item.angkatan,
      program_studi_id: item.program_studi_id,
    })
    setOpenForm(true)
  }

  const submitForm = async (e) => {
    e.preventDefault()
    const nimStr = String(form.nim || '')
    const year = new Date().getFullYear()
    if (!/^\d{7,10}$/.test(nimStr)) {
      pushToast('NIM harus angka 7-10 digit', 'error')
      return
    }
    if (!form.nama?.trim()) {
      pushToast('Nama wajib diisi', 'error')
      return
    }
    if (Number(form.angkatan) < 2000 || Number(form.angkatan) > year) {
      pushToast(`Angkatan harus antara 2000-${year}`, 'error')
      return
    }
    if (!form.program_studi_id) {
      pushToast('Program Studi wajib dipilih', 'error')
      return
    }

    try {
      setLoading(true)
      const payload = {
        nim: nimStr,
        nama: form.nama,
        angkatan: Number(form.angkatan),
        program_studi_id: Number(form.program_studi_id),
      }
      if (selected) {
        await api.put(`/mahasiswa/${selected.id}`, payload)
        pushToast('Mahasiswa berhasil diupdate')
      } else {
        await api.post('/mahasiswa', payload)
        pushToast('Mahasiswa berhasil ditambahkan')
      }
      setOpenForm(false)
      await loadData()
    } catch {
      pushToast('Operasi mahasiswa gagal', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    try {
      setLoading(true)
      await api.delete(`/mahasiswa/${selected.id}`)
      pushToast('Mahasiswa berhasil dihapus')
      setOpenDelete(false)
      await loadData()
    } catch {
      pushToast('Gagal menghapus mahasiswa', 'error')
    } finally {
      setLoading(false)
    }
  }

  const isWarning = (mahasiswaId) => warnings.some((w) => Number(w.mahasiswa_id) === Number(mahasiswaId))

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <ToastContainer toasts={toasts} />

      <div className="flex flex-wrap gap-2 mb-4 justify-between items-center">
        <div className="flex gap-2">
          <input className="border rounded px-3 py-2" placeholder="Search nama/NIM" value={q} onChange={(e) => setQ(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Filter angkatan" value={angkatan} onChange={(e) => setAngkatan(e.target.value)} />
          <button className="px-3 py-2 border rounded" onClick={() => loadData()}>Terapkan</button>
        </div>
        {canManage && (
          <button onClick={openTambah} className="bg-primary text-white px-3 py-2 rounded">+ Tambah Mahasiswa</button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th>NIM</th>
            <th>Nama</th>
            <th>Angkatan</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((m) => (
            <tr key={m.id} className="border-b">
              <td>{m.nim}</td>
              <td>{m.nama}</td>
              <td>{m.angkatan}</td>
              <td><EarlyWarningBadge isWarning={isWarning(m.id)} /></td>
              <td className="py-2">
                <div className="flex gap-2">
                  <Link className="text-primary" to={`/mahasiswa/${m.id}`}>Detail</Link>
                  {canManage && <button className="text-amber-600" onClick={() => openEdit(m)}>Edit</button>}
                  {canDelete && <button className="text-red-600" onClick={() => { setSelected(m); setOpenDelete(true) }}>Hapus</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal open={openForm} title={selected ? 'Edit Mahasiswa' : 'Tambah Mahasiswa'} onClose={() => setOpenForm(false)}>
        <form onSubmit={submitForm} className="space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="NIM" value={form.nim} onChange={(e) => setForm((f) => ({ ...f, nim: e.target.value }))} required />
          <input className="w-full border rounded px-3 py-2" placeholder="Nama Lengkap" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} required />
          <input type="number" className="w-full border rounded px-3 py-2" placeholder="Angkatan" value={form.angkatan} onChange={(e) => setForm((f) => ({ ...f, angkatan: e.target.value }))} required />
          <select className="w-full border rounded px-3 py-2" value={form.program_studi_id} onChange={(e) => setForm((f) => ({ ...f, program_studi_id: e.target.value }))} required>
            <option value="">Pilih Program Studi</option>
            {prodiOptions.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-2 border rounded" onClick={() => setOpenForm(false)}>Batal</button>
            <button disabled={loading} className="px-3 py-2 bg-primary text-white rounded">{selected ? 'Update' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={openDelete} title="Konfirmasi Hapus" onClose={() => setOpenDelete(false)} size="max-w-md">
        <p className="text-sm text-slate-600">Yakin ingin menghapus mahasiswa <b>{selected?.nama}</b>? Tindakan ini tidak dapat dibatalkan.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-3 py-2 border rounded" onClick={() => setOpenDelete(false)}>Batal</button>
          <button disabled={loading} className="px-3 py-2 bg-red-600 text-white rounded" onClick={handleDelete}>Ya, Hapus</button>
        </div>
      </Modal>
    </div>
  )
}
