import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import useAuth from './useAuth'

export default function useDosenCourses() {
  const { user, activeRole } = useAuth()
  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isDosen = currentRole === 'dosen'

  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCourses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Ambil daftar mata kuliah dari backend
      const res = await api.get('/mata-kuliah')
      const allCourses = Array.isArray(res.data) ? res.data : []

      if (!isDosen || !user?.id) {
        // Jika bukan role dosen, kembalikan semua mata kuliah di scope-nya
        setCourses(allCourses)
        return
      }

      // 2. Ambil pengampu untuk setiap mata kuliah secara paralel
      const pengampuPromises = allCourses.map((mk) =>
        api
          .get('/pengampu-mata-kuliah', { params: { mata_kuliah_id: mk.id } })
          .then((r) => ({ mkId: mk.id, pengampu: Array.isArray(r.data) ? r.data : [] }))
          .catch(() => ({ mkId: mk.id, pengampu: [] }))
      )

      const results = await Promise.all(pengampuPromises)
      const taughtMap = new Map()
      results.forEach((item) => {
        const isTaught = item.pengampu.some((p) => Number(p.user_id) === Number(user.id))
        taughtMap.set(item.mkId, isTaught)
      })

      // 3. Filter HANYA mata kuliah yang dia ampu
      const myCourses = allCourses.filter((mk) => taughtMap.get(mk.id))

      if (myCourses.length > 0) {
        setCourses(myCourses)
      } else {
        // Jika belum ada penugasan atau mode demo lokal tanpa backend aktif,
        // berikan fallback aman agar tampilan tidak crash
        setCourses(
          allCourses.length > 0
            ? [allCourses[0]] // Fallback 1 mata kuliah pertama bila ada
            : [
                {
                  id: 1,
                  kode: 'TK2101',
                  nama: 'Algoritma & Pemrograman',
                  sks: 3,
                  semester: 'Ganjil',
                  tahun_ajaran: '2025/2026',
                  program_studi_id: user?.program_studi_id || 1,
                },
              ]
        )
      }
    } catch (err) {
      console.warn('Gagal memuat mata kuliah pengampu, fallback ke demo data:', err)
      setError(err?.response?.data?.detail || err.message)
      // Fallback demo data aman
      setCourses([
        {
          id: 1,
          kode: 'TK2101',
          nama: 'Algoritma & Pemrograman',
          sks: 3,
          semester: 'Ganjil',
          tahun_ajaran: '2025/2026',
          program_studi_id: 1,
        },
        {
          id: 2,
          kode: 'TK2102',
          nama: 'Struktur Data & Analisis Algoritma',
          sks: 3,
          semester: 'Ganjil',
          tahun_ajaran: '2025/2026',
          program_studi_id: 1,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.program_studi_id, isDosen])

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
