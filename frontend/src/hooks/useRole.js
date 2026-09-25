import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export const useRole = () => {
  const { user, activeRole } = useContext(AuthContext)
  const role = activeRole || user?.role || 'admin_prodi'

  return {
    role,
    isSuperAdmin: role === 'super_admin',
    isAdminProdi: role === 'admin_prodi',
    isDosen: role === 'dosen',
    isKaprodi: role === 'kaprodi',
    isDekan: role === 'dekan',
    // Academic permissions
    canEditCurriculum: role === 'admin_prodi',
    canValidateReports: ['kaprodi', 'dekan'].includes(role),
    canSubmitReports: role === 'dosen',
    canViewAcademic: role !== 'super_admin',
    // User management permissions
    canManageProdiUsers: role === 'admin_prodi',
    canManageAllUsers: role === 'super_admin',
    // Legacy support
    isAdmin: role === 'admin_prodi',
    canEdit: ['admin_prodi', 'kaprodi', 'dosen'].includes(role),
    canDelete: ['admin_prodi', 'kaprodi'].includes(role),
  }
}

export default useRole
