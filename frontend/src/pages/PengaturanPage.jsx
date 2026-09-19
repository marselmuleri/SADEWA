import { Navigate } from 'react-router-dom'
import { ActionButton, Badge, PageHeader, SectionCard } from '../components/PageChrome'
import useAuth from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'

const demoUsers = [
  { name: 'Budi Santoso', nip: '198805122010011004', email: 'budi@sadewa.ac.id', role: 'Admin Prodi', active: true },
  { name: 'Andi Pratama', nip: '198909102011011002', email: 'andi@sadewa.ac.id', role: 'Dosen', active: true },
  { name: 'Siti Rahma', nip: '197812222006042001', email: 'siti@sadewa.ac.id', role: 'Kaprodi', active: false },
]

export default function PengaturanPage() {
  const { user, activeRole } = useAuth()
  const { role } = useRole()
  const currentRole = activeRole || role || user?.role || 'admin'

  if (currentRole !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administrasi"
        title="Manajemen Pengguna"
        description="Kelola pengguna dalam satu program studi. Provisioning prodi tetap menjadi kewenangan Super Admin."
        badge="Admin Prodi"
      />

      <SectionCard title="Daftar pengguna" description="Tabel hanya menampilkan akun di dalam scope program studi aktif.">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-left text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
              <th className="pb-3">Nama</th>
              <th className="pb-3">NIP</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {demoUsers.map((item) => (
              <tr key={item.email} className="border-b border-[#EEF2F7] last:border-0">
                <td className="py-4 font-semibold text-[#142B4A]">{item.name}</td>
                <td className="py-4 text-[#64748B]">{item.nip}</td>
                <td className="py-4 text-[#64748B]">{item.email}</td>
                <td className="py-4 text-[#142B4A]">{item.role}</td>
                <td className="py-4"><Badge tone={item.active ? 'success' : 'warning'}>{item.active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                <td className="py-4">
                  <ActionButton variant="secondary">{item.active ? 'Nonaktifkan' : 'Aktifkan'}</ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  )
}
