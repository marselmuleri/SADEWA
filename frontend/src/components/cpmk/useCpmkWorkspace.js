import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import { getApiErrorMessage } from '../../pages/superAdminHelpers'
import { fetchCplAndIk, fetchCpmkMappings, indexById } from './cpmkData'

/**
 * Data kerja CPL/CPMK untuk mata kuliah yang diampu pengguna (/mata-kuliah/saya):
 * daftar MK, CPMK-nya, CPL & IK prodi, serta pemetaan CPMK→IK.
 */
export default function useCpmkWorkspace() {
  const [mkList, setMkList] = useState([])
  const [cpmkList, setCpmkList] = useState([])
  const [cplList, setCplList] = useState([])
  const [ikList, setIkList] = useState([])
  const [mappings, setMappings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mkRes, cpmkRes, cplIk] = await Promise.all([
        api.get('/mata-kuliah/saya'),
        api.get('/cpmk'),
        fetchCplAndIk(),
      ])
      const mks = Array.isArray(mkRes.data) ? mkRes.data : []
      const mkIds = new Set(mks.map((mk) => mk.id))
      const cpmks = (Array.isArray(cpmkRes.data) ? cpmkRes.data : []).filter((c) => mkIds.has(c.mata_kuliah_id))
      setMkList(mks)
      setCpmkList(cpmks)
      setCplList(cplIk.cplList)
      setIkList(cplIk.ikList)
      setMappings(await fetchCpmkMappings(cpmks))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat data mata kuliah dan CPMK'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const mkById = useMemo(() => indexById(mkList), [mkList])
  const ikById = useMemo(() => indexById(ikList), [ikList])
  const cplById = useMemo(() => indexById(cplList), [cplList])

  return { mkList, cpmkList, cplList, ikList, mappings, mkById, ikById, cplById, loading, error, reload }
}
