import { Link } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

const menus = {
  admin: ['dashboard', 'mahasiswa', 'mata-kuliah', 'analisis', 'chatbot', 'laporan', 'pengaturan'],
  dosen: ['dashboard', 'mahasiswa', 'mata-kuliah', 'analisis', 'chatbot'],
  kaprodi: ['dashboard', 'mahasiswa', 'mata-kuliah', 'analisis', 'chatbot', 'laporan', 'pengaturan'],
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const roleMenus = user?.role ? menus[user.role] : []

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <div className="font-semibold text-primary">SADEWA</div>
      <div className="flex items-center gap-4 text-sm">
        {roleMenus?.map((menu) => (
          <Link key={menu} to={`/${menu}`} className="hover:text-primary capitalize">
            {menu.replace('-', ' ')}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs px-2 py-1 rounded bg-slate-100">{user?.role}</span>
        <button onClick={logout} className="text-sm bg-warning text-white px-3 py-1 rounded">Logout</button>
      </div>
    </nav>
  )
}
