import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MataKuliahPage from './pages/MataKuliahPage'
import MataKuliahDetailPage from './pages/MataKuliahDetailPage'
import AnalisisPage from './pages/AnalisisPage'
import PengaturanPage from './pages/PengaturanPage'
import KurikulumPage from './pages/KurikulumPage'
import DokumenPage from './pages/DokumenPage'
import SuperAdminPage from './pages/SuperAdminPage'
import useAuth from './hooks/useAuth'

function AppLayout({ children }) {
  return <Navbar>{children}</Navbar>
}

function RoleBasedHomeRedirect() {
  const { user, activeRole } = useAuth()
  const currentRole = activeRole || user?.role || 'admin_prodi'

  if (currentRole === 'super_admin') {
    return <Navigate to="/super-admin" replace />
  }
  return <Navigate to="/dashboard" replace />
}

const ACADEMIC_ROLES = ['admin_prodi', 'dosen', 'kaprodi', 'dekan']

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Academic Workspace Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={ACADEMIC_ROLES}>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mata-kuliah"
          element={
            <ProtectedRoute allowedRoles={ACADEMIC_ROLES}>
              <AppLayout>
                <MataKuliahPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mata-kuliah/:id"
          element={
            <ProtectedRoute allowedRoles={ACADEMIC_ROLES}>
              <AppLayout>
                <MataKuliahDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analisis"
          element={
            <ProtectedRoute allowedRoles={ACADEMIC_ROLES}>
              <AppLayout>
                <AnalisisPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/kurikulum"
          element={
            <ProtectedRoute allowedRoles={ACADEMIC_ROLES}>
              <AppLayout>
                <KurikulumPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dokumen"
          element={
            <ProtectedRoute allowedRoles={ACADEMIC_ROLES}>
              <AppLayout>
                <DokumenPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Administration Route: Exclusively for Admin Prodi (PRD Feature 3) */}
        <Route
          path="/pengaturan"
          element={
            <ProtectedRoute allowedRoles={['admin_prodi']}>
              <AppLayout>
                <PengaturanPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Super Admin Panel Route: Exclusively for Super Admin (PRD Feature 12, PRD Section 3.2) */}
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AppLayout>
                <SuperAdminPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Catch-all smart redirect based on role */}
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <RoleBasedHomeRedirect />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
