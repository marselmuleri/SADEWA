import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export const useRole = () => {
  const { user, activeRole } = useContext(AuthContext)
  const role = activeRole || user?.role
  return {
    role,
    isAdmin: role === 'admin',
    isDosen: role === 'dosen',
    isKaprodi: role === 'kaprodi',
    isDekan: role === 'dekan',
    isSuperAdmin: role === 'super_admin',
    canEdit: ['admin', 'kaprodi', 'dosen'].includes(role),
    canDelete: ['admin', 'kaprodi'].includes(role),
    canManageUser: role === 'admin',
    canManageCPL: ['admin', 'kaprodi'].includes(role),
  }
}
