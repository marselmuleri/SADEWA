import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MahasiswaPage from './pages/MahasiswaPage'
import MahasiswaDetailPage from './pages/MahasiswaDetailPage'
import MataKuliahPage from './pages/MataKuliahPage'
import MataKuliahDetailPage from './pages/MataKuliahDetailPage'
import AnalisisPage from './pages/AnalisisPage'
import ChatbotPage from './pages/ChatbotPage'
import LaporanPage from './pages/LaporanPage'
import PengaturanPage from './pages/PengaturanPage'

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="p-6">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
        <Route path="/mahasiswa" element={<ProtectedRoute><AppLayout><MahasiswaPage /></AppLayout></ProtectedRoute>} />
        <Route path="/mahasiswa/:id" element={<ProtectedRoute><AppLayout><MahasiswaDetailPage /></AppLayout></ProtectedRoute>} />
        <Route path="/mata-kuliah" element={<ProtectedRoute><AppLayout><MataKuliahPage /></AppLayout></ProtectedRoute>} />
        <Route path="/mata-kuliah/:id" element={<ProtectedRoute><AppLayout><MataKuliahDetailPage /></AppLayout></ProtectedRoute>} />
        <Route path="/analisis" element={<ProtectedRoute><AppLayout><AnalisisPage /></AppLayout></ProtectedRoute>} />
        <Route path="/chatbot" element={<ProtectedRoute><AppLayout><ChatbotPage /></AppLayout></ProtectedRoute>} />
        <Route path="/laporan" element={<ProtectedRoute><AppLayout><LaporanPage /></AppLayout></ProtectedRoute>} />
        <Route path="/pengaturan" element={<ProtectedRoute><AppLayout><PengaturanPage /></AppLayout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
