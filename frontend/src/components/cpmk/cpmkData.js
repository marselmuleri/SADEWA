import api from '../../services/api'

export const TAXONOMY_OPTIONS = [
  { value: 'C1', label: 'C1 - Mengingat (Remember)' },
  { value: 'C2', label: 'C2 - Memahami (Understand)' },
  { value: 'C3', label: 'C3 - Menerapkan (Apply)' },
  { value: 'C4', label: 'C4 - Menganalisis (Analyze)' },
  { value: 'C5', label: 'C5 - Mengevaluasi (Evaluate)' },
  { value: 'C6', label: 'C6 - Menciptakan (Create)' },
]

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

/** Ambil pemetaan IK untuk setiap CPMK. Hasil: { [cpmkId]: [{ ik_id, ik_kode, bobot }] } */
export async function fetchCpmkMappings(cpmkList) {
  const result = {}
  await Promise.all(
    cpmkList.map(async (cpmk) => {
      try {
        const res = await api.get(`/cpmk/${cpmk.id}/map-ik`)
        result[cpmk.id] = Array.isArray(res.data) ? res.data : []
      } catch {
        result[cpmk.id] = []
      }
    })
  )
  return result
}

/** Ambil semua CPL & IK prodi yang bisa dipetakan. */
export async function fetchCplAndIk() {
  const [cplRes, ikRes] = await Promise.all([api.get('/cpl'), api.get('/ik')])
  return {
    cplList: Array.isArray(cplRes.data) ? cplRes.data : [],
    ikList: Array.isArray(ikRes.data) ? ikRes.data : [],
  }
}

/** Kode CPL (unik, berurutan) yang terhubung ke sebuah CPMK lewat IK yang dipetakan. */
export function deriveCplCodes(mappings, ikById, cplById) {
  const codes = new Set()
  for (const m of mappings || []) {
    const ik = ikById.get(m.ik_id)
    const cpl = ik ? cplById.get(ik.cpl_id) : null
    if (cpl) codes.add(cpl.kode)
  }
  return Array.from(codes).sort()
}

export function indexById(list) {
  const map = new Map()
  for (const item of list || []) map.set(item.id, item)
  return map
}
