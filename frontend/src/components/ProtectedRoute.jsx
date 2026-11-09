import { Navigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { SplashScreen } from './brand/SadewaLogo'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, activeRole, loading } = useAuth()

  if (loading) {
    return <SplashScreen pesan="Memeriksa sesi..." />
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
