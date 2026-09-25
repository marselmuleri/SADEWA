import { Navigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, activeRole, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-[#64748B]">
        <div className="flex items-center gap-2 text-xs">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1A3A6B] border-t-transparent" />
          <span>Memuat SADEWA...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const role = activeRole || user.role || 'admin_prodi'

  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === 'super_admin') {
      return <Navigate to="/super-admin" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return children
}
