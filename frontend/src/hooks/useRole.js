import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export const useRole = () => {
  const { user } = useContext(AuthContext)
  return {
    isAdmin: user?.role === 'admin',
    isDosen: user?.role === 'dosen',
    isKaprodi: user?.role === 'kaprodi',
    canEdit: ['admin', 'kaprodi', 'dosen'].includes(user?.role),
    canDelete: ['admin', 'kaprodi'].includes(user?.role),
    canManageUser: user?.role === 'admin',
    canManageCPL: ['admin', 'kaprodi'].includes(user?.role),
  }
}
