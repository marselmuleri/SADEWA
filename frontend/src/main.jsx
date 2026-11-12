import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { DekanScopeProvider } from './context/DekanScopeContext'
import { DosenCoursesProvider } from './context/DosenCoursesContext'
import { AiJobProvider } from './context/AiJobContext'

// Halaman dimuat per rute (lazy). Setelah rilis baru, file chunk lama bisa sudah tidak ada;
// muat ulang sekali agar browser mengambil versi terbaru, bukan menampilkan galat.
window.addEventListener('vite:preloadError', (event) => {
  const kunci = 'sadewa-reload-chunk'
  if (sessionStorage.getItem(kunci)) return
  sessionStorage.setItem(kunci, '1')
  event.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => sessionStorage.removeItem('sadewa-reload-chunk'))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <DekanScopeProvider>
        <DosenCoursesProvider>
          <AiJobProvider>
            <App />
          </AiJobProvider>
        </DosenCoursesProvider>
      </DekanScopeProvider>
    </AuthProvider>
  </React.StrictMode>,
)
