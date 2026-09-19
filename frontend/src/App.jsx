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

function AppLayout({ children }) {
  return <Navbar>{children}</Navbar>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
        <Route path="/mata-kuliah" element={<ProtectedRoute><AppLayout><MataKuliahPage /></AppLayout></ProtectedRoute>} />
        <Route path="/mata-kuliah/:id" element={<ProtectedRoute><AppLayout><MataKuliahDetailPage /></AppLayout></ProtectedRoute>} />
        <Route path="/analisis" element={<ProtectedRoute><AppLayout><AnalisisPage /></AppLayout></ProtectedRoute>} />
        <Route path="/pengaturan" element={<ProtectedRoute><AppLayout><PengaturanPage /></AppLayout></ProtectedRoute>} />
        <Route path="/kurikulum" element={<ProtectedRoute><AppLayout><KurikulumPage /></AppLayout></ProtectedRoute>} />
        <Route path="/dokumen" element={<ProtectedRoute><AppLayout><DokumenPage /></AppLayout></ProtectedRoute>} />
        <Route path="/super-admin" element={<ProtectedRoute><AppLayout><SuperAdminPage /></AppLayout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
