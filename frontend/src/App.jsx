import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import PageErrorBoundary from './components/PageErrorBoundary'
import AiJobDock from './components/AiJobDock'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
// Halaman login dimuat langsung (halaman pertama); halaman lain dipecah per rute (code splitting)
// sehingga kode & library berat (mis. recharts) hanya diunduh saat halamannya dibuka.
import LoginPage from './pages/LoginPage'
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const PesertaMataKuliahPage = lazy(() => import('./pages/PesertaMataKuliahPage'))
const MahasiswaPage = lazy(() => import('./pages/MahasiswaPage'))
const NilaiPage = lazy(() => import('./pages/NilaiPage'))
const AnalisisPage = lazy(() => import('./pages/AnalisisPage'))
const PengaturanPage = lazy(() => import('./pages/PengaturanPage'))
const KurikulumPage = lazy(() => import('./pages/KurikulumPage'))
const DokumenPage = lazy(() => import('./pages/DokumenPage'))
const FakultasPage = lazy(() => import('./pages/FakultasPage'))
const ProdiPage = lazy(() => import('./pages/ProdiPage'))
const UserManagementSAPage = lazy(() => import('./pages/UserManagementSAPage'))

// Phase A OBE Kurikulum Pages
const CplListPage = lazy(() => import('./pages/cpl/CplListPage'))
const CplIndikatorPage = lazy(() => import('./pages/cpl/CplIndikatorPage'))
const PemetaanIkPage = lazy(() => import('./pages/cpl/PemetaanIkPage'))
const CpmkMkListPage = lazy(() => import('./pages/cpmk/CpmkMkListPage'))
const CpmkDetailPage = lazy(() => import('./pages/cpmk/CpmkDetailPage'))
const MataKuliahListPage = lazy(() => import('./pages/mk/MataKuliahListPage'))
const JenisEvaluasiPage = lazy(() => import('./pages/evaluasi/JenisEvaluasiPage'))
const BentukPenilaianPage = lazy(() => import('./pages/evaluasi/BentukPenilaianPage'))
const PenilaianPage = lazy(() => import('./pages/dosen/PenilaianPage'))
const MataKuliahSayaPage = lazy(() => import('./pages/dosen/MataKuliahSayaPage'))
const CpmkSayaPage = lazy(() => import('./pages/dosen/CpmkSayaPage'))
const DataMasterLayout = lazy(() => import('./pages/datamaster/DataMasterLayout'))
const DataMasterKurikulumPage = lazy(() => import('./pages/datamaster/DataMasterKurikulumPage'))
const DataMasterCplPage = lazy(() => import('./pages/datamaster/DataMasterCplPage'))
const DataMasterIkPage = lazy(() => import('./pages/datamaster/DataMasterIkPage'))
const DataMasterCpmkPage = lazy(() => import('./pages/datamaster/DataMasterCpmkPage'))
const DataMasterArsipPage = lazy(() => import('./pages/datamaster/DataMasterArsipPage'))
const PortofolioPage = lazy(() => import('./pages/portofolio/PortofolioPage'))
const PortofolioDetailPage = lazy(() => import('./pages/portofolio/PortofolioDetailPage'))
const AturanPenilaianPage = lazy(() => import('./pages/AturanPenilaianPage'))

import useAuth from './hooks/useAuth'

function MemuatHalaman() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#CBD5E1] border-t-[#1A3A6B]" aria-hidden="true" />
      <span className="sr-only">Memuat halaman...</span>
    </div>
  )
}

function AppLayout({ children }) {
  const location = useLocation()
  return (
    <Navbar>
      <PageErrorBoundary key={location.pathname}>
        <Suspense fallback={<MemuatHalaman />}>{children}</Suspense>
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
      <Suspense fallback={<MemuatHalaman />}>
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

        {/* Portofolio mata kuliah: Dosen (kelola), Kaprodi & Dekan (lihat) */}
        <Route
          path="/portofolio"
          element={
            <ProtectedRoute allowedRoles={ANALYTICS_ROLES}>
              <AppLayout>
                <PortofolioPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/portofolio/:mkId/:section"
          element={
            <ProtectedRoute allowedRoles={ANALYTICS_ROLES}>
              <AppLayout>
                <PortofolioDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/portofolio/:mkId" element={<Navigate to="rps" replace />} />

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
            <ProtectedRoute allowedRoles={['admin_prodi', 'dosen']}>
              <AppLayout>
                <CpmkDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Ruang kerja dosen: kelola CPL, IK & CPMK pada mata kuliah yang diampu */}
        <Route
          path="/mata-kuliah-saya"
          element={
            <ProtectedRoute allowedRoles={['dosen']}>
              <AppLayout>
                <MataKuliahSayaPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cpmk-saya"
          element={
            <ProtectedRoute allowedRoles={['dosen']}>
              <AppLayout>
                <CpmkSayaPage />
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
          path="/aturan-penilaian"
          element={
            <ProtectedRoute allowedRoles={['admin_prodi']}>
              <AppLayout>
                <AturanPenilaianPage />
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
      </Suspense>
      {/* Proses AI (Generate RPS / Narasi) yang berjalan di latar belakang */}
      <AiJobDock />
    </BrowserRouter>
  )
}
