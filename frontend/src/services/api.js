import axios from 'axios'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const api = axios.create({
  baseURL: `${apiBaseUrl}/api/v1`,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Data Master API Helpers
export const fetchKurikulumVersions = (params) => api.get('/kurikulum/versions', { params })
export const fetchCplList = (params) => api.get('/cpl', { params })
export const fetchIkList = (params) => api.get('/ik', { params })
export const fetchCpmkList = (params) => api.get('/cpmk', { params })
export const fetchMataKuliahList = (params) => api.get('/mata-kuliah', { params })
export const fetchProdiList = (params) => api.get('/prodi', { params })

export default api
