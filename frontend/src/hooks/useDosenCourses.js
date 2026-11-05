import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../services/api'
import useAuth from './useAuth'

export default function useDosenCourses() {
  const { user, activeRole } = useAuth()
  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isDosen = currentRole === 'dosen'

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Cache pengampu per MK ID dalam session memory
  const pengampuCache = useRef(new Map())
  const pesertaCache = useRef(new Map())

  const fetchCourses = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Ambil seluruh mata kuliah
      const res = await api.get('/mata-kuliah')
      const allCourses = Array.isArray(res.data) ? res.data : []

      if (!isDosen || !user?.id) {
        // Jika bukan role dosen (mis. Admin Prodi / Kaprodi yang membuka halaman ini),
        // kembalikan daftar mata kuliah apa adanya
        setCourses(allCourses)
        return
      }

      // 2. Filter mata kuliah yang benar-benar diampu oleh dosen yang sedang login
      // Gunakan worker pool dengan batas konkurensi 5 request agar tidak membebani server
      const CONCURRENCY = 5
      const missingPengampuMkIds = allCourses
        .map((mk) => mk.id)
        .filter((id) => !pengampuCache.current.has(id))

      let index = 0
      const worker = async () => {
        while (index < missingPengampuMkIds.length) {
          const mkId = missingPengampuMkIds[index++]
          try {
            const pRes = await api.get('/pengampu-mata-kuliah', { params: { mata_kuliah_id: mkId } })
            pengampuCache.current.set(mkId, Array.isArray(pRes.data) ? pRes.data : [])
          } catch {
            pengampuCache.current.set(mkId, [])
          }
        }
      }

      const workers = Array.from(
        { length: Math.min(CONCURRENCY, missingPengampuMkIds.length || 1) },
        () => worker()
      )
      await Promise.all(workers)

      // 3. Saring secara ketat HANYA MK di mana user.id terdaftar sebagai pengampu
      const myTaughtCourses = []
      for (const mk of allCourses) {
        const pengampus = pengampuCache.current.get(mk.id) || []
        const myAssignment = pengampus.find((p) => Number(p.user_id) === Number(user.id))
        if (myAssignment) {
          myTaughtCourses.push({
            ...mk,
            isKetua: Boolean(myAssignment.is_koordinator),
            pengampuRole: myAssignment.is_koordinator ? 'Ketua' : 'Anggota',
            allPengampus: pengampus,
          })
        }
      }

      // 4. Muat jumlah peserta untuk setiap MK yang diampu
      const missingPesertaMkIds = myTaughtCourses
        .map((mk) => mk.id)
        .filter((id) => !pesertaCache.current.has(id))

      let pIndex = 0
      const pesertaWorker = async () => {
        while (pIndex < missingPesertaMkIds.length) {
          const mkId = missingPesertaMkIds[pIndex++]
          try {
            const pesertaRes = await api.get('/peserta-mata-kuliah', { params: { mata_kuliah_id: mkId } })
            pesertaCache.current.set(mkId, Array.isArray(pesertaRes.data) ? pesertaRes.data.length : 0)
          } catch {
            pesertaCache.current.set(mkId, 0)
          }
        }
      }

      const pWorkers = Array.from(
        { length: Math.min(CONCURRENCY, missingPesertaMkIds.length || 1) },
        () => pesertaWorker()
      )
      await Promise.all(pWorkers)

      // Gabungkan jumlah peserta ke dalam objek mata kuliah
      const finalCourses = myTaughtCourses.map((mk) => ({
        ...mk,
        jumlahPeserta: pesertaCache.current.get(mk.id) ?? 0,
      }))

      // TANPA DEMO FALLBACK: Jika kosong, kembalikan array kosong agar UI menampilkan empty state riil
      setCourses(finalCourses)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Gagal memuat daftar mata kuliah yang diampu')
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, isDosen])

  useEffect(() => {
    fetchCourses()
  }, [fetchCourses])

  return {
    courses,
    loading,
    error,
    reload: fetchCourses,
  }
}
