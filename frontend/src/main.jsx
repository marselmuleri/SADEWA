import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { DekanScopeProvider } from './context/DekanScopeContext'
import { DosenCoursesProvider } from './context/DosenCoursesContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <DekanScopeProvider>
        <DosenCoursesProvider>
          <App />
        </DosenCoursesProvider>
      </DekanScopeProvider>
    </AuthProvider>
  </React.StrictMode>,
)
