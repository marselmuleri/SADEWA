import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../services/api'
import useAuth from '../hooks/useAuth'

export default function PengaturanPage() {
  const { user } = useAuth(); const [users, setUsers] = useState([]); const [notice, setNotice] = useState('')
  const allowed = ['admin', 'kaprodi'].includes(user?.role)
  const load = () => api.get('/users').then(r => setUsers(r.data))
  useEffect(() => { if (allowed) load().catch(() => setNotice('Gagal memuat akun.')) }, [allowed])
  if (!allowed) return <Navigate to="/dashboard" replace />
  const setActive = async (row, is_active) => { try { await api.put(`/users/${row.id}`, { is_active }); setNotice('Status akun diperbarui.'); load() } catch { setNotice('Anda tidak dapat mengubah akun ini.') } }
  return <div className="space-y-5"><header><h1 className="text-2xl font-bold text-primary">Manajemen Akun Prodi</h1><p className="text-sm text-slate-500">Hanya akun dalam program studi Anda yang tampil di sini. Provisioning prodi dilakukan oleh Super Admin.</p></header>{notice && <p className="rounded bg-amber-50 p-3 text-sm">{notice}</p>}<section className="rounded-xl border bg-white p-5"><table className="w-full text-sm"><thead className="border-b text-left"><tr><th>Nama</th><th>NIP</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead><tbody>{users.map(row => <tr key={row.id} className="border-b"><td className="py-3">{row.nama}</td><td>{row.nip || '—'}</td><td>{row.email}</td><td>{row.role}</td><td>{row.is_active ? 'Aktif' : 'Nonaktif'}</td><td>{user.role === 'admin' && <button onClick={() => setActive(row, !row.is_active)} className="text-primary">{row.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>}</td></tr>)}</tbody></table></section></div>
}
