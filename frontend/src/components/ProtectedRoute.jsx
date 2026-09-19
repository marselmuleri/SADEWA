import { Navigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-[#64748B]">Memuat SADEWA...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
