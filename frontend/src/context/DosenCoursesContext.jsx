import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import api from '../services/api'
import useAuth from '../hooks/useAuth'

export const DosenCoursesContext = createContext(null)

export function DosenCoursesProvider({ children }) {
  const { user, activeRole } = useAuth()
  const currentRole = activeRole || user?.role || ''
  const isDosen = Boolean(user?.id) && currentRole === 'dosen'

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Cache pengampu & peserta per MK ID terikat ke user.id
  const cachedUserIdRef = useRef(null)
  const hasFetchedRef = useRef(false)
  const pengampuCache = useRef(new Map())
  const pesertaCache = useRef(new Map())

  // Controller untuk membatalkan request yang sedang berjalan dan mencegah race condition
  const abortControllerRef = useRef(null)
  const fetchRequestIdRef = useRef(0)

  const clearStateAndCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    fetchRequestIdRef.current += 1
    cachedUserIdRef.current = null
    hasFetchedRef.current = false
    pengampuCache.current.clear()
    pesertaCache.current.clear()
    setCourses([])
    setLoading(false)
    setError(null)
  }, [])

  const fetchCourses = useCallback(
    async (targetUserId, force = false) => {
      if (!isDosen || !targetUserId) {
        clearStateAndCancel()
        return
      }

      if (!force && hasFetchedRef.current && cachedUserIdRef.current === targetUserId) {
        return
      }

      // Batalkan fetch sebelumnya yang mungkin masih berjalan
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller
      const currentRequestId = ++fetchRequestIdRef.current

      setLoading(true)
      setError(null)

      if (force) {
        pengampuCache.current.clear()
        pesertaCache.current.clear()
      }

      try {
        // 1. Ambil seluruh mata kuliah
        const res = await api.get('/mata-kuliah', { signal: controller.signal })
        const allCourses = Array.isArray(res.data) ? res.data : []

        if (controller.signal.aborted || currentRequestId !== fetchRequestIdRef.current) {
          return
        }

        // 2. Filter mata kuliah yang benar-benar diampu oleh dosen yang sedang login
        // Batasi konkurensi tepat 5 request konkuren agar efisien dan aman bagi server
        const CONCURRENCY = 5
        const missingPengampuMkIds = allCourses
          .map((mk) => mk.id)
          .filter((id) => !pengampuCache.current.has(id))

        let index = 0
        const worker = async () => {
          while (index < missingPengampuMkIds.length) {
            if (controller.signal.aborted || currentRequestId !== fetchRequestIdRef.current) return
            const mkId = missingPengampuMkIds[index++]
            try {
              const pRes = await api.get('/pengampu-mata-kuliah', {
                params: { mata_kuliah_id: mkId },
                signal: controller.signal,
              })
              if (controller.signal.aborted || currentRequestId !== fetchRequestIdRef.current) return
              pengampuCache.current.set(mkId, Array.isArray(pRes.data) ? pRes.data : [])
            } catch {
              if (controller.signal.aborted || currentRequestId !== fetchRequestIdRef.current) return
              pengampuCache.current.set(mkId, [])
            }
          }
        }

        const workers = Array.from(
          { length: Math.min(CONCURRENCY, missingPengampuMkIds.length || 1) },
          () => worker()
        )
        await Promise.all(workers)

        if (controller.signal.aborted || currentRequestId !== fetchRequestIdRef.current) {
          return
        }

        // 3. Saring secara ketat HANYA MK di mana targetUserId terdaftar sebagai pengampu
        const myTaughtCourses = []
        for (const mk of allCourses) {
          const pengampus = pengampuCache.current.get(mk.id) || []
          const myAssignment = pengampus.find((p) => Number(p.user_id) === Number(targetUserId))
          if (myAssignment) {
            myTaughtCourses.push({
              ...mk,
              isKetua: Boolean(myAssignment.is_koordinator),
              pengampuRole: myAssignment.is_koordinator ? 'Ketua' : 'Anggota',
              allPengampus: pengampus,
            })
          }
        }

        // 4. Muat jumlah peserta untuk setiap MK yang diampu dengan batasan concurrency 5
        const missingPesertaMkIds = myTaughtCourses
          .map((mk) => mk.id)
          .filter((id) => !pesertaCache.current.has(id))

        let pIndex = 0
        const pesertaWorker = async () => {
          while (pIndex < missingPesertaMkIds.length) {
            if (controller.signal.aborted || currentRequestId !== fetchRequestIdRef.current) return
            const mkId = missingPesertaMkIds[pIndex++]
            try {
              const pesertaRes = await api.get('/peserta-mata-kuliah', {
                params: { mata_kuliah_id: mkId },
                signal: controller.signal,
              })
              if (controller.signal.aborted || currentRequestId !== fetchRequestIdRef.current) return
              pesertaCache.current.set(mkId, Array.isArray(pesertaRes.data) ? pesertaRes.data.length : 0)
            } catch {
              if (controller.signal.aborted || currentRequestId !== fetchRequestIdRef.current) return
              pesertaCache.current.set(mkId, 0)
            }
          }
        }

        const pWorkers = Array.from(
          { length: Math.min(CONCURRENCY, missingPesertaMkIds.length || 1) },
          () => pesertaWorker()
        )
        await Promise.all(pWorkers)

        if (controller.signal.aborted || currentRequestId !== fetchRequestIdRef.current) {
          return
        }

        // Gabungkan jumlah peserta ke dalam objek mata kuliah
        const finalCourses = myTaughtCourses.map((mk) => ({
          ...mk,
          jumlahPeserta: pesertaCache.current.get(mk.id) ?? 0,
        }))

        setCourses(finalCourses)
        hasFetchedRef.current = true
        cachedUserIdRef.current = targetUserId
      } catch (err) {
        if (
          controller.signal.aborted ||
          currentRequestId !== fetchRequestIdRef.current ||
          err?.name === 'CanceledError' ||
          err?.name === 'AbortError' ||
          err?.code === 'ERR_CANCELED'
        ) {
          return
        }
        setError(err?.response?.data?.detail || err.message || 'Gagal memuat daftar mata kuliah yang diampu')
        setCourses([])
      } finally {
        if (!controller.signal.aborted && currentRequestId === fetchRequestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [isDosen, clearStateAndCancel]
  )

  // Effect: jalankan fetch HANYA jika isDosen && user?.id
  // Jika user berganti atau logout atau role berganti bukan 'dosen', batalkan dan bersihkan state
  useEffect(() => {
    if (!isDosen || !user?.id) {
      clearStateAndCancel()
      return
    }

    if (cachedUserIdRef.current !== user.id) {
      clearStateAndCancel()
      fetchCourses(user.id, false)
    } else if (!hasFetchedRef.current) {
      fetchCourses(user.id, false)
    }
  }, [isDosen, user?.id, clearStateAndCancel, fetchCourses])

  const reload = useCallback(() => {
    if (isDosen && user?.id) {
      return fetchCourses(user.id, true)
    }
    return Promise.resolve()
  }, [isDosen, user?.id, fetchCourses])

  return (
    <DosenCoursesContext.Provider
      value={{
        courses,
        loading,
        error,
        reload,
      }}
    >
      {children}
    </DosenCoursesContext.Provider>
  )
}

export function useDosenCoursesContext() {
  const context = useContext(DosenCoursesContext)
  if (!context) {
    throw new Error('useDosenCoursesContext must be used within DosenCoursesProvider')
  }
  return context
}
