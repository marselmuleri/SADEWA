import { useState, useEffect, useCallback, useMemo } from 'react'
import useAuth from './useAuth'
import useToast from './useToast'
import {
  fetchKurikulumVersions,
  fetchCplList,
  fetchIkList,
  fetchCpmkList,
  fetchMataKuliahList,
  fetchProdiList,
} from '../services/api'
import { getApiErrorMessage } from '../pages/superAdminHelpers'

export default function useDataMaster() {
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()
  const currentRole = activeRole || user?.role || ''

  const [versions, setVersions] = useState([])
  const [cpls, setCpls] = useState([])
  const [iks, setIks] = useState([])
  const [cpmks, setCpmks] = useState([])
  const [mataKuliahs, setMataKuliahs] = useState([])
  const [prodis, setProdis] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadAllData = useCallback(async () => {
    // Only fetch if user is logged in and not super_admin
    if (!user || currentRole === 'super_admin') {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [verRes, cplRes, ikRes, cpmkRes, mkRes, prodiRes] = await Promise.all([
        fetchKurikulumVersions().catch((err) => {
          console.warn('Gagal memuat versi kurikulum:', err)
          return { data: [] }
        }),
        fetchCplList(),
        fetchIkList(),
        fetchCpmkList(),
        fetchMataKuliahList(),
        fetchProdiList().catch((err) => {
          console.warn('Gagal memuat prodi:', err)
          return { data: [] }
        }),
      ])

      setVersions(Array.isArray(verRes.data) ? verRes.data : [])
      setCpls(Array.isArray(cplRes.data) ? cplRes.data : [])
      setIks(Array.isArray(ikRes.data) ? ikRes.data : [])
      setCpmks(Array.isArray(cpmkRes.data) ? cpmkRes.data : [])
      setMataKuliahs(Array.isArray(mkRes.data) ? mkRes.data : [])
      setProdis(Array.isArray(prodiRes.data) ? prodiRes.data : [])
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal memuat data master akademik')
      setError(msg)
      pushToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [user, currentRole, pushToast])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Map Program Studi: id -> Prodi
  const prodiMap = useMemo(() => {
    const map = new Map()
    prodis.forEach((p) => map.set(Number(p.id), p))
    return map
  }, [prodis])

  // Map Kurikulum: id -> Version
  const kurikulumMap = useMemo(() => {
    const map = new Map()
    versions.forEach((v) => map.set(Number(v.id), v))
    return map
  }, [versions])

  // Map Mata Kuliah: id -> MK
  const mataKuliahMap = useMemo(() => {
    const map = new Map()
    mataKuliahs.forEach((m) => map.set(Number(m.id), m))
    return map
  }, [mataKuliahs])

  // Map CPL: id -> CPL
  const cplMap = useMemo(() => {
    const map = new Map()
    cpls.forEach((c) => map.set(Number(c.id), c))
    return map
  }, [cpls])

  // Map IK: id -> IK
  const ikMap = useMemo(() => {
    const map = new Map()
    iks.forEach((i) => map.set(Number(i.id), i))
    return map
  }, [iks])

  // Map IK grouped by cpl_id
  const iksByCplId = useMemo(() => {
    const map = new Map()
    iks.forEach((ik) => {
      const cplId = Number(ik.cpl_id)
      if (!map.has(cplId)) map.set(cplId, [])
      map.get(cplId).push(ik)
    })
    return map
  }, [iks])

  // Map CPMK grouped by mata_kuliah_id
  const cpmksByMkId = useMemo(() => {
    const map = new Map()
    cpmks.forEach((cpmk) => {
      const mkId = Number(cpmk.mata_kuliah_id)
      if (!map.has(mkId)) map.set(mkId, [])
      map.get(mkId).push(cpmk)
    })
    return map
  }, [cpmks])

  // Total bobot per Mata Kuliah (akumulasi bobot CPMK)
  const totalBobotPerMk = useMemo(() => {
    const map = new Map()
    cpmks.forEach((cpmk) => {
      const mkId = Number(cpmk.mata_kuliah_id)
      const current = map.get(mkId) || 0
      map.set(mkId, current + Number(cpmk.bobot || 0))
    })
    // Bulatkan 2 digit desimal
    map.forEach((total, mkId) => {
      map.set(mkId, Math.round(total * 100) / 100)
    })
    return map
  }, [cpmks])

  return {
    versions,
    cpls,
    iks,
    cpmks,
    mataKuliahs,
    prodis,
    loading,
    error,
    reload: loadAllData,
    prodiMap,
    kurikulumMap,
    mataKuliahMap,
    cplMap,
    ikMap,
    iksByCplId,
    cpmksByMkId,
    totalBobotPerMk,
  }
}
