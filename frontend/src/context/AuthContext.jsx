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
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) {
      setActiveRole('')
      localStorage.removeItem('sadewa.activeRole')
      return
    }

    if (!activeRole) {
      setActiveRole(user.role)
      localStorage.setItem('sadewa.activeRole', user.role)
    }
  }, [user])

  useEffect(() => {
    if (!user) return undefined
    let timer
    const reset = () => { clearTimeout(timer); timer = setTimeout(logout, 30 * 60 * 1000) }
    window.addEventListener('pointerdown', reset); window.addEventListener('keydown', reset); reset()
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', reset); window.removeEventListener('keydown', reset) }
  }, [user])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.access_token)
    const me = await api.get('/auth/me')
    setUser(me.data)
    setActiveRole(me.data.role)
    localStorage.setItem('sadewa.activeRole', me.data.role)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('sadewa.activeRole')
    setUser(null)
  }

  const switchRole = (role) => {
    setActiveRole(role)
    localStorage.setItem('sadewa.activeRole', role)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, activeRole, switchRole }}>
      {children}
    </AuthContext.Provider>
  )
}
