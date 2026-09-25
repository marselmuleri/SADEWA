import { createContext, useEffect, useState } from 'react'
import api from '../services/api'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [activeRole, setActiveRole] = useState(() => localStorage.getItem('sadewa.activeRole') || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      setLoading(false)
      return
    }

    api.get('/auth/me')
      .then((res) => {
        setUser(res.data)
        setActiveRole(res.data.role)
        localStorage.setItem('sadewa.activeRole', res.data.role)
      })
      .catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('sadewa.activeRole')
        setUser(null)
        setActiveRole('')
      })
      .finally(() => setLoading(false))
  }, [])

  // Inactivity auto logout (30 minutes)
  useEffect(() => {
    if (!user) return undefined
    let timer
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(logout, 30 * 60 * 1000)
    }
    window.addEventListener('pointerdown', reset)
    window.addEventListener('keydown', reset)
    reset()
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointerdown', reset)
      window.removeEventListener('keydown', reset)
    }
  }, [user])

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', data.access_token)

      const me = await api.get('/auth/me')
      setUser(me.data)
      setActiveRole(me.data.role)
      localStorage.setItem('sadewa.activeRole', me.data.role)
      return { success: true, user: me.data, isDemo: false }
    } catch (apiError) {
      const errorDetail = apiError?.response?.data?.detail || 'Email atau password tidak valid'
      throw new Error(errorDetail)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('sadewa.activeRole')
    setUser(null)
    setActiveRole('')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, activeRole }}>
      {children}
    </AuthContext.Provider>
  )
}
