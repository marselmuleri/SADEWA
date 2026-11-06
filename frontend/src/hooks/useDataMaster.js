import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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

const sectionLoaders = {
  kurikulum: {
    versions: fetchKurikulumVersions,
    cpls: fetchCplList,
    mataKuliahs: fetchMataKuliahList,
  },
  cpl: {
    cpls: fetchCplList,
    iks: fetchIkList,
    versions: fetchKurikulumVersions,
  },
  ik: {
    iks: fetchIkList,
    cpls: fetchCplList,
    versions: fetchKurikulumVersions,
  },
  cpmk: {
    cpmks: fetchCpmkList,
    mataKuliahs: fetchMataKuliahList,
    versions: fetchKurikulumVersions,
  },
}

export default function useDataMaster(section = 'kurikulum') {
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
  const requestIdRef = useRef(0)

  const clearData = useCallback(() => {
    setVersions([])
    setCpls([])
    setIks([])
    setCpmks([])
    setMataKuliahs([])
    setProdis([])
  }, [])

  const loadAllData = useCallback(async () => {
    const requestId = ++requestIdRef.current

    // Only fetch if user is logged in and not super_admin
    if (!user || currentRole === 'super_admin') {
      clearData()
      setError(null)
      setLoading(false)
      return
    }

    if (currentRole === 'dekan' && !user.fakultas_id) {
      clearData()
      setError('Akun Dekan belum terhubung ke fakultas. Hubungi Super Admin untuk memperbarui cakupan akun.')
      setLoading(false)
      return
    }

    clearData()
    setLoading(true)
    setError(null)

    try {
      const loaders = Object.entries(sectionLoaders[section] || sectionLoaders.kurikulum)
      if (currentRole === 'dekan') {
        loaders.push(['prodis', () => fetchProdiList({ fakultas_id: user.fakultas_id })])
      }

      const responses = await Promise.all(loaders.map(([key, loader]) => {
        const isOptionalRelationship = loader === fetchKurikulumVersions
        if (!isOptionalRelationship) return loader().then((response) => [key, response?.data])

        return loader().then((response) => [key, response?.data]).catch((err) => {
          console.warn('Gagal memuat data master pendukung:', err)
          return [key, []]
        })
      }))

      if (requestId !== requestIdRef.current) return

      const dataByKey = Object.fromEntries(responses)
      setVersions(Array.isArray(dataByKey.versions) ? dataByKey.versions : [])
      setCpls(Array.isArray(dataByKey.cpls) ? dataByKey.cpls : [])
      setIks(Array.isArray(dataByKey.iks) ? dataByKey.iks : [])
      setCpmks(Array.isArray(dataByKey.cpmks) ? dataByKey.cpmks : [])
      setMataKuliahs(Array.isArray(dataByKey.mataKuliahs) ? dataByKey.mataKuliahs : [])
      setProdis(Array.isArray(dataByKey.prodis) ? dataByKey.prodis : [])
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      const msg = getApiErrorMessage(err, 'Gagal memuat data master akademik')
      setError(msg)
      pushToast(msg, 'error')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [user, currentRole, pushToast, section, clearData])

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

  useEffect(() => {
    const isSingleProdiRole = currentRole === 'admin_prodi' || currentRole === 'kaprodi'
    const allowedProdiIds = isSingleProdiRole
      ? new Set(user?.program_studi_id ? [Number(user.program_studi_id)] : [])
      : currentRole === 'dekan'
      ? new Set(prodis.map((prodi) => Number(prodi.id)))
      : null

    if (!allowedProdiIds || allowedProdiIds.size === 0) return

    const cplById = new Map(cpls.map((cpl) => [Number(cpl.id), cpl]))
    const mkById = new Map(mataKuliahs.map((mk) => [Number(mk.id), mk]))
    const outsideScope = {
      versions: versions.filter((item) => !allowedProdiIds.has(Number(item.program_studi_id))).map((item) => item.id),
      cpls: cpls.filter((item) => !allowedProdiIds.has(Number(item.program_studi_id))).map((item) => item.id),
      mataKuliahs: mataKuliahs.filter((item) => !allowedProdiIds.has(Number(item.program_studi_id))).map((item) => item.id),
      iks: iks.filter((item) => {
        const parentCpl = cplById.get(Number(item.cpl_id))
        return parentCpl && !allowedProdiIds.has(Number(parentCpl.program_studi_id))
      }).map((item) => item.id),
      cpmks: cpmks.filter((item) => {
        const mataKuliah = mkById.get(Number(item.mata_kuliah_id))
        return mataKuliah && !allowedProdiIds.has(Number(mataKuliah.program_studi_id))
      }).map((item) => item.id),
    }
    const totalOutsideScope = Object.values(outsideScope).reduce((total, ids) => total + ids.length, 0)

    if (totalOutsideScope > 0) {
      console.warn('[Data Master] Data di luar scope terdeteksi', {
        role: currentRole,
        programStudiId: user?.program_studi_id || null,
        fakultasId: user?.fakultas_id || null,
        allowedProdiIds: Array.from(allowedProdiIds),
        outsideScope,
      })
    }
  }, [currentRole, user?.program_studi_id, user?.fakultas_id, versions, cpls, iks, cpmks, mataKuliahs, prodis])

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
