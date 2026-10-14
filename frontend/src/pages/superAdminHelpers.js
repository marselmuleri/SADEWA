export function getApiErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (detail) {
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((d) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join(', ')
    }
    if (typeof detail === 'object') {
      return detail.message || JSON.stringify(detail)
    }
  }
  return error?.response?.data?.message || error?.message || fallback
}

export function toId(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? value : parsed
}
