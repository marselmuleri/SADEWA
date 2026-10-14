import { createContext, useContext, useEffect, useState } from 'react'
import useAuth from '../hooks/useAuth'
import api from '../services/api'

export const DekanScopeContext = createContext(null)

export function DekanScopeProvider({ children }) {
  const { user, activeRole } = useAuth()
  const currentRole = activeRole || user?.role || ''
  const isDekan = currentRole === 'dekan'

  const [prodiList, setProdiList] = useState([])
  const [selectedProdiId, setSelectedProdiIdState] = useState('')
  const [loadingProdi, setLoadingProdi] = useState(false)
  const [prodiError, setProdiError] = useState(null)

  const storageKey = user?.id ? `sadewa.dekanSelectedProdiId.${user.id}` : null

  // Fetch list prodi di fakultas Dekan
  useEffect(() => {
    if (!isDekan || !user?.fakultas_id) {
      setProdiList([])
      setSelectedProdiIdState('')
      return
    }

    let isMounted = true
    setLoadingProdi(true)
    setProdiError(null)

    api.get('/prodi', { params: { fakultas_id: user.fakultas_id } })
      .then((res) => {
        if (!isMounted) return
        const list = Array.isArray(res.data) ? res.data : []
        setProdiList(list)

        // Validasi nilai tersimpan terhadap list hasil fetch
        let initialId = ''
        if (storageKey) {
          const saved = localStorage.getItem(storageKey)
          if (saved && list.some((p) => String(p.id) === String(saved))) {
            initialId = saved
          } else if (saved) {
            localStorage.removeItem(storageKey)
          }
        }

        // Jika belum ada pilihan dan prodi tersedia, pilih prodi pertama sebagai default
        if (!initialId && list.length > 0) {
          initialId = String(list[0].id)
          if (storageKey) {
            localStorage.setItem(storageKey, initialId)
          }
        }

        setSelectedProdiIdState(initialId)
      })
      .catch((err) => {
        if (!isMounted) return
        console.error('Gagal mengambil prodi fakultas Dekan:', err)
        setProdiError('Gagal memuat daftar program studi di fakultas Anda')
        setProdiList([])
        setSelectedProdiIdState('')
      })
      .finally(() => {
        if (isMounted) setLoadingProdi(false)
      })

    return () => {
      isMounted = false
    }
  }, [isDekan, user?.id, user?.fakultas_id, storageKey])

  const setSelectedProdiId = (id) => {
    const strId = id ? String(id) : ''
    setSelectedProdiIdState(strId)
    if (storageKey) {
      if (strId) {
        localStorage.setItem(storageKey, strId)
      } else {
        localStorage.removeItem(storageKey)
      }
    }
  }

  const selectedProdi = prodiList.find((p) => String(p.id) === String(selectedProdiId)) || null

  return (
    <DekanScopeContext.Provider
      value={{
        isDekan,
        prodiList,
        selectedProdiId,
        selectedProdi,
        setSelectedProdiId,
        loadingProdi,
        prodiError,
      }}
    >
      {children}
    </DekanScopeContext.Provider>
  )
}

export function useDekanScope() {
  const context = useContext(DekanScopeContext)
  if (!context) {
    return {
      isDekan: false,
      prodiList: [],
      selectedProdiId: '',
      selectedProdi: null,
      setSelectedProdiId: () => {},
      loadingProdi: false,
      prodiError: null,
    }
  }
  return context
}
