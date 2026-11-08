import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import PageErrorBoundary from './components/PageErrorBoundary'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PesertaMataKuliahPage from './pages/PesertaMataKuliahPage'
import MahasiswaPage from './pages/MahasiswaPage'
import NilaiPage from './pages/NilaiPage'
import AnalisisPage from './pages/AnalisisPage'
import PengaturanPage from './pages/PengaturanPage'
import KurikulumPage from './pages/KurikulumPage'
import DokumenPage from './pages/DokumenPage'
import FakultasPage from './pages/FakultasPage'
import ProdiPage from './pages/ProdiPage'
import UserManagementSAPage from './pages/UserManagementSAPage'

// Phase A OBE Kurikulum Pages
import CplListPage from './pages/cpl/CplListPage'
import CplIndikatorPage from './pages/cpl/CplIndikatorPage'
import PemetaanIkPage from './pages/cpl/PemetaanIkPage'
import CpmkMkListPage from './pages/cpmk/CpmkMkListPage'
import CpmkDetailPage from './pages/cpmk/CpmkDetailPage'
import MataKuliahListPage from './pages/mk/MataKuliahListPage'
import JenisEvaluasiPage from './pages/evaluasi/JenisEvaluasiPage'
import BentukPenilaianPage from './pages/evaluasi/BentukPenilaianPage'
import PenilaianPage from './pages/dosen/PenilaianPage'
import DataMasterLayout from './pages/datamaster/DataMasterLayout'
import DataMasterKurikulumPage from './pages/datamaster/DataMasterKurikulumPage'
import DataMasterCplPage from './pages/datamaster/DataMasterCplPage'
import DataMasterIkPage from './pages/datamaster/DataMasterIkPage'
import DataMasterCpmkPage from './pages/datamaster/DataMasterCpmkPage'
import DataMasterArsipPage from './pages/datamaster/DataMasterArsipPage'

import useAuth from './hooks/useAuth'

function AppLayout({ children }) {
  const location = useLocation()
  return (
    <Navbar>
      <PageErrorBoundary key={location.pathname}>
        {children}
      </PageErrorBoundary>
    </Navbar>
  )
}

function RoleBasedHomeRedirect() {
  const { user, activeRole } = useAuth()
  const currentRole = activeRole || user?.role || 'admin_prodi'

  if (currentRole === 'super_admin') {
    return <Navigate to="/super-admin/prodi" replace />
  }
  return <Navigate to="/dashboard" replace />
}

const ACADEMIC_ROLES = ['admin_prodi', 'dosen', 'kaprodi', 'dekan']
// Analitik OBE adalah wewenang Dosen, Kaprodi, dan Dekan (bukan Admin Prodi).
const ANALYTICS_ROLES = ['dosen', 'kaprodi', 'dekan']

function DataMasterIndexRedirect() {
  const { search } = useLocation()
  const legacyTab = new URLSearchParams(search).get('tab')
  const section = ['kurikulum', 'cpl', 'ik', 'cpmk'].includes(legacyTab) ? legacyTab : 'kurikulum'

  return <Navigate to={`/data-master/${section}`} replace />
}

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
          path="/peserta"
          element={
            <ProtectedRoute allowedRoles={ACADEMIC_ROLES}>
              <AppLayout>
                <PesertaMataKuliahPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/penilaian"
          element={
            <ProtectedRoute allowedRoles={ACADEMIC_ROLES}>
              <AppLayout>
                <PenilaianPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/penilaian/:mkId/nilai"
          element={
            <ProtectedRoute allowedRoles={ACADEMIC_ROLES}>
              <AppLayout>
                <PenilaianPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/penilaian/:mkId/hasil"
          element={
            <ProtectedRoute allowedRoles={ACADEMIC_ROLES}>
              <AppLayout>
                <PenilaianPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/nilai"
          element={<Navigate to="/penilaian" replace />}
        />
        <Route
          path="/analisis"
          element={
            <ProtectedRoute allowedRoles={ANALYTICS_ROLES}>
              <AppLayout>
                <AnalisisPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* View-Only Academic Master Data */}
        <Route
          path="/data-master"
          element={
            <ProtectedRoute allowedRoles={ACADEMIC_ROLES}>
              <AppLayout>
                <DataMasterLayout />
              </AppLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<DataMasterIndexRedirect />} />
          <Route path="kurikulum" element={<DataMasterKurikulumPage />} />
          <Route path="cpl" element={<DataMasterCplPage />} />
          <Route path="ik" element={<DataMasterIkPage />} />
          <Route path="cpmk" element={<DataMasterCpmkPage />} />
          <Route path="arsip" element={<DataMasterArsipPage />} />
        </Route>

        {/* Consolidated Kurikulum OBE for Dosen, Kaprodi, Dekan (Mode Lihat) */}
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

        {/* Admin Prodi Specific Kurikulum OBE Sub-routes (PRD Feature 2 & SIMAK-NG Flow) */}
        <Route
          path="/kurikulum/cpl"
          element={
            <ProtectedRoute allowedRoles={['admin_prodi']}>
              <AppLayout>
                <CplListPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/kurikulum/cpl/:cplId/indikator"
          element={
            <ProtectedRoute allowedRoles={['admin_prodi']}>
              <AppLayout>
                <CplIndikatorPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/kurikulum/pemetaan"
          element={
            <ProtectedRoute allowedRoles={['admin_prodi']}>
              <AppLayout>
                <PemetaanIkPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/kurikulum/mata-kuliah"
          element={
            <ProtectedRoute allowedRoles={['admin_prodi']}>
              <AppLayout>
                <MataKuliahListPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/kurikulum/cpmk"
          element={
            <ProtectedRoute allowedRoles={['admin_prodi']}>
              <AppLayout>
                <CpmkMkListPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/kurikulum/cpmk/mk/:mkId"
          element={
            <ProtectedRoute allowedRoles={['admin_prodi']}>
              <AppLayout>
                <CpmkDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/kurikulum/jenis-evaluasi"
          element={
            <ProtectedRoute allowedRoles={['admin_prodi']}>
              <AppLayout>
                <JenisEvaluasiPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/kurikulum/bentuk-penilaian"
          element={
            <ProtectedRoute allowedRoles={['admin_prodi']}>
              <AppLayout>
                <BentukPenilaianPage />
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
          path="/mahasiswa"
          element={
            <ProtectedRoute allowedRoles={['admin_prodi']}>
              <AppLayout>
                <MahasiswaPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
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

        {/* Super Admin Panel Routes: Exclusively for Super Admin (PRD Feature 12, PRD Section 3.2) */}
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Navigate to="/super-admin/prodi" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/prodi"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AppLayout>
                <ProdiPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/fakultas"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AppLayout>
                <FakultasPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/users"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AppLayout>
                <UserManagementSAPage />
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
