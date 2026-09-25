import { createContext, useEffect, useState } from 'react'
import api from '../services/api'
import { demoProfiles } from '../data/demoUi'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [activeRole, setActiveRole] = useState(() => localStorage.getItem('sadewa.activeRole') || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedDemoUser = localStorage.getItem('sadewa.demoUser')

    if (!token) {
      if (savedDemoUser) {
        try {
          const parsed = JSON.parse(savedDemoUser)
          setUser(parsed)
          if (!activeRole) {
            setActiveRole(parsed.role)
            localStorage.setItem('sadewa.activeRole', parsed.role)
          }
        } catch {
          localStorage.removeItem('sadewa.demoUser')
        }
      }
      setLoading(false)
      return
    }

    // Token exists, check backend
    api.get('/auth/me')
      .then((res) => {
        setUser(res.data)
        if (!activeRole) {
          setActiveRole(res.data.role)
          localStorage.setItem('sadewa.activeRole', res.data.role)
        }
      })
      .catch(() => {
        // If real backend call fails, check if we have saved demo session
        if (savedDemoUser) {
          try {
            const parsed = JSON.parse(savedDemoUser)
            setUser(parsed)
            if (!activeRole) {
              setActiveRole(parsed.role)
            }
          } catch {
            localStorage.removeItem('token')
            localStorage.removeItem('sadewa.demoUser')
            setUser(null)
          }
        } else {
          localStorage.removeItem('token')
          setUser(null)
        }
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
      const role = user.role || 'admin_prodi'
      setActiveRole(role)
      localStorage.setItem('sadewa.activeRole', role)
    }
  }, [user])

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
      // 1. Coba login ke API backend
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', data.access_token)
      localStorage.removeItem('sadewa.demoUser')

      const me = await api.get('/auth/me')
      setUser(me.data)
      setActiveRole(me.data.role)
      localStorage.setItem('sadewa.activeRole', me.data.role)
      return { success: true, user: me.data, isDemo: false }
    } catch (apiError) {
      // 2. Fallback graceful: jika backend offline/gagal, periksa kredensial demo
      // Sesuai DESIGN.md Section 6: "Jika API gagal, shell, navigasi, dan data demo tetap tampil."
      const matchedProfile = Object.values(demoProfiles).find(
        (p) => p.email.toLowerCase() === email.toLowerCase().trim()
      )

      if (matchedProfile) {
        const demoUserData = {
          id: matchedProfile.role === 'super_admin' ? 1 : matchedProfile.role === 'admin_prodi' ? 6 : 2,
          nama: matchedProfile.name,
          email: matchedProfile.email,
          nip: matchedProfile.nip,
          role: matchedProfile.role,
          is_active: true,
          program_studi_id: matchedProfile.program_studi_id,
          program_studi_nama: matchedProfile.program_studi_nama,
          fakultas_id: matchedProfile.fakultas_id,
          fakultas_nama: matchedProfile.fakultas_nama,
        }

        localStorage.setItem('sadewa.demoUser', JSON.stringify(demoUserData))
        localStorage.setItem('token', `demo-token-${demoUserData.role}`)
        setUser(demoUserData)
        setActiveRole(demoUserData.role)
        localStorage.setItem('sadewa.activeRole', demoUserData.role)
        return { success: true, user: demoUserData, isDemo: true }
      }

      // Jika bukan akun demo dan request ke backend gagal dengan error message
      const errorDetail = apiError?.response?.data?.detail || 'Email atau password tidak valid'
      throw new Error(errorDetail)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('sadewa.activeRole')
    localStorage.removeItem('sadewa.demoUser')
    setUser(null)
    setActiveRole('')
  }

  const switchRole = (role) => {
    setActiveRole(role)
    localStorage.setItem('sadewa.activeRole', role)

    // Perbarui profil sementara agar badge prodi / nama sesuai role yang diswitch untuk demo visual
    const profile = demoProfiles[role]
    if (profile) {
      setUser((prev) => ({
        ...(prev || {}),
        nama: profile.name,
        email: profile.email,
        nip: profile.nip,
        role: profile.role,
        program_studi_id: profile.program_studi_id,
        program_studi_nama: profile.program_studi_nama,
        fakultas_id: profile.fakultas_id,
        fakultas_nama: profile.fakultas_nama,
      }))
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, activeRole, switchRole }}>
      {children}
    </AuthContext.Provider>
  )
}
