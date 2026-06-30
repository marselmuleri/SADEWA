import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import Modal from '../components/Modal'
import ToastContainer from '../components/ToastContainer'
import useToast from '../hooks/useToast'
import { useRole } from '../hooks/useRole'

const mkInit = {
  kode_mk: '',
  nama_mk: '',
  sks: 3,
  semester: 1,
  program_studi_id: '',
  dosen_id: '',
}

export default function MataKuliahPage() {
  const { isAdmin, isKaprodi, canDelete } = useRole()
  const { toasts, pushToast } = useToast()
  const [list, setList] = useState([])
  const [prodiOptions, setProdiOptions] = useState([])
  const [dosenOptions, setDosenOptions] = useState([])
  const [openForm, setOpenForm] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(mkInit)

  const canManage = isAdmin || isKaprodi

  const loadData = async () => {
    const [mkRes, prodiRes, dosenRes] = await Promise.all([
      api.get('/mata-kuliah'),
      api.get('/prodi'),
      api.get('/users', { params: { role: 'dosen' } }),
    ])
    setList(mkRes.data)
    setProdiOptions(prodiRes.data)
    setDosenOptions(dosenRes.data)
  }

  useEffect(() => {
    loadData().catch(() => pushToast('Gagal memuat mata kuliah', 'error'))
  }, [])

  const dosenMap = dosenOptions.reduce((acc, d) => ({ ...acc, [d.id]: d.nama }), {})

  const openTambah = () => {
    setSelected(null)
    setForm(mkInit)
    setOpenForm(true)
  }

  const openEdit = (row) => {
    setSelected(row)
    setForm({ ...row, dosen_id: row.dosen_id || '' })
    setOpenForm(true)
  }

  const submitForm = async (e) => {
    e.preventDefault()
    const payload = {
      kode_mk: form.kode_mk,
      nama_mk: form.nama_mk,
      sks: Number(form.sks),
      semester: Number(form.semester),
      program_studi_id: Number(form.program_studi_id),
      dosen_id: form.dosen_id ? Number(form.dosen_id) : null,
    }
    try {
      if (selected) {
        await api.put(`/mata-kuliah/${selected.id}`, payload)
        pushToast('Mata kuliah berhasil diupdate')
      } else {
        await api.post('/mata-kuliah', payload)
        pushToast('Mata kuliah berhasil ditambahkan')
      }
      setOpenForm(false)
      await loadData()
    } catch {
      pushToast('Operasi mata kuliah gagal', 'error')
    }
  }

  const deleteData = async () => {
    if (!selected) return
    try {
      await api.delete(`/mata-kuliah/${selected.id}`)
      pushToast('Mata kuliah berhasil dihapus')
      setOpenDelete(false)
      await loadData()
    } catch {
      pushToast('Gagal menghapus mata kuliah', 'error')
    }
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <ToastContainer toasts={toasts} />
      <div className="flex justify-end mb-3">
        {canManage && <button className="bg-primary text-white px-3 py-2 rounded" onClick={openTambah}>+ Tambah Mata Kuliah</button>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left border-b"><th>Kode MK</th><th>Nama MK</th><th>SKS</th><th>Semester</th><th>Dosen Pengampu</th><th>Aksi</th></tr></thead>
        <tbody>
          {list.map((mk) => (
            <tr key={mk.id} className="border-b">
              <td>{mk.kode_mk}</td><td>{mk.nama_mk}</td><td>{mk.sks}</td><td>{mk.semester}</td><td>{dosenMap[mk.dosen_id] || '-'}</td>
              <td>
                <div className="flex gap-2 py-2">
                  <Link className="text-primary" to={`/mata-kuliah/${mk.id}`}>Detail</Link>
                  {canManage && <button className="text-amber-600" onClick={() => openEdit(mk)}>Edit</button>}
                  {canDelete && <button className="text-red-600" onClick={() => { setSelected(mk); setOpenDelete(true) }}>Hapus</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal open={openForm} title={selected ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah'} onClose={() => setOpenForm(false)}>
        <form onSubmit={submitForm} className="space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="Kode MK (contoh IF301)" value={form.kode_mk} onChange={(e) => setForm((f) => ({ ...f, kode_mk: e.target.value }))} required />
          <input className="w-full border rounded px-3 py-2" placeholder="Nama Mata Kuliah" value={form.nama_mk} onChange={(e) => setForm((f) => ({ ...f, nama_mk: e.target.value }))} required />
          <input type="number" min="1" max="6" className="w-full border rounded px-3 py-2" placeholder="SKS" value={form.sks} onChange={(e) => setForm((f) => ({ ...f, sks: e.target.value }))} required />
          <input type="number" min="1" max="8" className="w-full border rounded px-3 py-2" placeholder="Semester" value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))} required />
          <select className="w-full border rounded px-3 py-2" value={form.program_studi_id} onChange={(e) => setForm((f) => ({ ...f, program_studi_id: e.target.value }))} required>
            <option value="">Pilih Program Studi</option>
            {prodiOptions.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
          <select className="w-full border rounded px-3 py-2" value={form.dosen_id} onChange={(e) => setForm((f) => ({ ...f, dosen_id: e.target.value }))}>
            <option value="">Pilih Dosen Pengampu</option>
            {dosenOptions.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-2 border rounded" onClick={() => setOpenForm(false)}>Batal</button>
            <button className="px-3 py-2 bg-primary text-white rounded">{selected ? 'Update' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={openDelete} title="Konfirmasi Hapus Mata Kuliah" onClose={() => setOpenDelete(false)} size="max-w-md">
        <p className="text-sm text-slate-600">Yakin ingin menghapus mata kuliah <b>{selected?.nama_mk}</b>?</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-3 py-2 border rounded" onClick={() => setOpenDelete(false)}>Batal</button>
          <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={deleteData}>Ya, Hapus</button>
        </div>
      </Modal>
    </div>
  )
}
