import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import api from '../services/api'
import Modal from '../components/Modal'
import ToastContainer from '../components/ToastContainer'
import useToast from '../hooks/useToast'
import { useRole } from '../hooks/useRole'

const cplInit = { kode_cpl: '', deskripsi: '', program_studi_id: '' }
const prodiInit = { kode: '', nama: '', jenjang: 'S1' }
const userInit = { nama: '', email: '', password: '', role: 'dosen', is_active: true }

export default function PengaturanPage() {
  const { canManageCPL, canManageUser, isAdmin, isKaprodi } = useRole()
  const { toasts, pushToast } = useToast()

  const [tab, setTab] = useState('cpl')
  const [prodiRows, setProdiRows] = useState([])
  const [cplRows, setCplRows] = useState([])
  const [userRows, setUserRows] = useState([])

  const [openCpl, setOpenCpl] = useState(false)
  const [openProdi, setOpenProdi] = useState(false)
  const [openUser, setOpenUser] = useState(false)

  const [selectedCpl, setSelectedCpl] = useState(null)
  const [selectedProdi, setSelectedProdi] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)

  const [cplForm, setCplForm] = useState(cplInit)
  const [prodiForm, setProdiForm] = useState(prodiInit)
  const [userForm, setUserForm] = useState(userInit)

  const isForbidden = !isAdmin && !isKaprodi

  const loadData = async () => {
    const [prodiRes, cplRes] = await Promise.all([
      api.get('/prodi'),
      api.get('/cpl'),
    ])
    setProdiRows(prodiRes.data)
    setCplRows(cplRes.data)

    if (canManageUser) {
      const usersRes = await api.get('/users')
      setUserRows(usersRes.data)
    }
  }

  useEffect(() => {
    if (!isForbidden) {
      loadData().catch(() => pushToast('Gagal memuat data pengaturan', 'error'))
    }
  }, [isForbidden, canManageUser])

  const prodiMap = useMemo(() => prodiRows.reduce((acc, p) => ({ ...acc, [p.id]: p.nama }), {}), [prodiRows])

  if (isForbidden) return <Navigate to="/dashboard" replace />

  const saveCpl = async (e) => {
    e.preventDefault()
    try {
      if (selectedCpl) {
        await api.put(`/cpl/${selectedCpl.id}`, { ...cplForm, program_studi_id: Number(cplForm.program_studi_id) })
        pushToast('CPL diupdate')
      } else {
        await api.post('/cpl', { ...cplForm, program_studi_id: Number(cplForm.program_studi_id) })
        pushToast('CPL ditambahkan')
      }
      setOpenCpl(false)
      await loadData()
    } catch {
      pushToast('Operasi CPL gagal', 'error')
    }
  }

  const saveProdi = async (e) => {
    e.preventDefault()
    try {
      if (selectedProdi) {
        await api.put(`/prodi/${selectedProdi.id}`, prodiForm)
        pushToast('Prodi diupdate')
      } else {
        await api.post('/prodi', prodiForm)
        pushToast('Prodi ditambahkan')
      }
      setOpenProdi(false)
      await loadData()
    } catch {
      pushToast('Operasi prodi gagal', 'error')
    }
  }

  const saveUser = async (e) => {
    e.preventDefault()
    try {
      if (selectedUser) {
        await api.put(`/users/${selectedUser.id}`, {
          nama: userForm.nama,
          email: userForm.email,
          role: userForm.role,
          is_active: userForm.is_active,
        })
        pushToast('Akun diupdate')
      } else {
        await api.post('/auth/register', {
          nama: userForm.nama,
          email: userForm.email,
          password: userForm.password,
          role: userForm.role,
        })
        pushToast('Akun ditambahkan')
      }
      setOpenUser(false)
      await loadData()
    } catch {
      pushToast('Operasi user gagal', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} />

      <div className="flex gap-2 border-b pb-2">
        <button className={`px-3 py-2 rounded ${tab === 'cpl' ? 'bg-primary text-white' : 'bg-slate-100'}`} onClick={() => setTab('cpl')}>Kelola CPL</button>
        <button className={`px-3 py-2 rounded ${tab === 'prodi' ? 'bg-primary text-white' : 'bg-slate-100'}`} onClick={() => setTab('prodi')}>Kelola Program Studi</button>
        {canManageUser && <button className={`px-3 py-2 rounded ${tab === 'users' ? 'bg-primary text-white' : 'bg-slate-100'}`} onClick={() => setTab('users')}>Kelola Akun</button>}
      </div>

      {tab === 'cpl' && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-end mb-3">{canManageCPL && <button className="bg-primary text-white px-3 py-2 rounded" onClick={() => { setSelectedCpl(null); setCplForm(cplInit); setOpenCpl(true) }}>+ Tambah CPL</button>}</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th>Kode CPL</th><th>Deskripsi</th><th>Program Studi</th><th>Aksi</th></tr></thead>
            <tbody>
              {cplRows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td>{row.kode_cpl}</td><td>{row.deskripsi}</td><td>{prodiMap[row.program_studi_id] || row.program_studi_id}</td>
                  <td>
                    {canManageCPL && (
                      <div className="flex gap-2">
                        <button className="text-amber-600" onClick={() => { setSelectedCpl(row); setCplForm({ kode_cpl: row.kode_cpl, deskripsi: row.deskripsi, program_studi_id: row.program_studi_id }); setOpenCpl(true) }}>Edit</button>
                        <button className="text-red-600" onClick={async () => { await api.delete(`/cpl/${row.id}`); pushToast('CPL dihapus'); await loadData() }}>Hapus</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'prodi' && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-end mb-3">{canManageCPL && <button className="bg-primary text-white px-3 py-2 rounded" onClick={() => { setSelectedProdi(null); setProdiForm(prodiInit); setOpenProdi(true) }}>+ Tambah Prodi</button>}</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th>Kode</th><th>Nama</th><th>Jenjang</th><th>Aksi</th></tr></thead>
            <tbody>
              {prodiRows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td>{row.kode}</td><td>{row.nama}</td><td>{row.jenjang}</td>
                  <td>
                    {canManageCPL && (
                      <div className="flex gap-2">
                        <button className="text-amber-600" onClick={() => { setSelectedProdi(row); setProdiForm({ kode: row.kode, nama: row.nama, jenjang: row.jenjang }); setOpenProdi(true) }}>Edit</button>
                        {isAdmin && <button className="text-red-600" onClick={async () => { await api.delete(`/prodi/${row.id}`); pushToast('Prodi dihapus'); await loadData() }}>Hapus</button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'users' && canManageUser && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-end mb-3"><button className="bg-primary text-white px-3 py-2 rounded" onClick={() => { setSelectedUser(null); setUserForm(userInit); setOpenUser(true) }}>+ Tambah Akun</button></div>
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th>Nama</th><th>Email</th><th>Role</th><th>Status Aktif</th><th>Aksi</th></tr></thead>
            <tbody>
              {userRows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td>{row.nama}</td><td>{row.email}</td><td>{row.role}</td><td>{row.is_active ? 'Aktif' : 'Nonaktif'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="text-amber-600" onClick={() => { setSelectedUser(row); setUserForm({ nama: row.nama, email: row.email, role: row.role, password: '', is_active: row.is_active }); setOpenUser(true) }}>Edit</button>
                      <button className="text-red-600" onClick={async () => { await api.delete(`/users/${row.id}`); pushToast('User dinonaktifkan'); await loadData() }}>Nonaktifkan</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={openCpl} title={selectedCpl ? 'Edit CPL' : 'Tambah CPL'} onClose={() => setOpenCpl(false)}>
        <form onSubmit={saveCpl} className="space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="Kode CPL" value={cplForm.kode_cpl} onChange={(e) => setCplForm((f) => ({ ...f, kode_cpl: e.target.value }))} required />
          <textarea className="w-full border rounded px-3 py-2" placeholder="Deskripsi lengkap CPL" value={cplForm.deskripsi} onChange={(e) => setCplForm((f) => ({ ...f, deskripsi: e.target.value }))} required />
          <select className="w-full border rounded px-3 py-2" value={cplForm.program_studi_id} onChange={(e) => setCplForm((f) => ({ ...f, program_studi_id: e.target.value }))} required>
            <option value="">Pilih Program Studi</option>
            {prodiRows.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-2 border rounded" onClick={() => setOpenCpl(false)}>Batal</button>
            <button className="px-3 py-2 bg-primary text-white rounded">Simpan</button>
          </div>
        </form>
      </Modal>

      <Modal open={openProdi} title={selectedProdi ? 'Edit Program Studi' : 'Tambah Program Studi'} onClose={() => setOpenProdi(false)}>
        <form onSubmit={saveProdi} className="space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="Kode Prodi" value={prodiForm.kode} onChange={(e) => setProdiForm((f) => ({ ...f, kode: e.target.value }))} required />
          <input className="w-full border rounded px-3 py-2" placeholder="Nama Program Studi" value={prodiForm.nama} onChange={(e) => setProdiForm((f) => ({ ...f, nama: e.target.value }))} required />
          <select className="w-full border rounded px-3 py-2" value={prodiForm.jenjang} onChange={(e) => setProdiForm((f) => ({ ...f, jenjang: e.target.value }))}>
            <option value="S1">S1</option>
            <option value="S2">S2</option>
            <option value="D3">D3</option>
            <option value="D4">D4</option>
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-2 border rounded" onClick={() => setOpenProdi(false)}>Batal</button>
            <button className="px-3 py-2 bg-primary text-white rounded">Simpan</button>
          </div>
        </form>
      </Modal>

      <Modal open={openUser} title={selectedUser ? 'Edit Akun' : 'Tambah Akun'} onClose={() => setOpenUser(false)}>
        <form onSubmit={saveUser} className="space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="Nama Lengkap" value={userForm.nama} onChange={(e) => setUserForm((f) => ({ ...f, nama: e.target.value }))} required />
          <input type="email" className="w-full border rounded px-3 py-2" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} required />
          {!selectedUser && <input type="password" className="w-full border rounded px-3 py-2" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} required />}
          <select className="w-full border rounded px-3 py-2" value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="admin">admin</option>
            <option value="dosen">dosen</option>
            <option value="kaprodi">kaprodi</option>
          </select>
          {selectedUser && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={userForm.is_active} onChange={(e) => setUserForm((f) => ({ ...f, is_active: e.target.checked }))} /> Aktif
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-2 border rounded" onClick={() => setOpenUser(false)}>Batal</button>
            <button className="px-3 py-2 bg-primary text-white rounded">Simpan</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
