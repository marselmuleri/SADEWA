import api from '../services/api'

/**
 * Mengambil seluruh data mahasiswa program studi dengan melakukan penarikan
 * paginasi berulang (limit 500 per halaman sesuai batas backend le=500)
 * sehingga tidak ada mahasiswa yang terlewat dalam validasi NIM.
 */
export async function fetchAllMahasiswa() {
  const PAGE_LIMIT = 500
  let page = 1
  let allMahasiswa = []
  let hasMore = true

  while (hasMore) {
    const res = await api.get('/mahasiswa', {
      params: { page, limit: PAGE_LIMIT },
    })

    const batch = Array.isArray(res.data) ? res.data : []
    allMahasiswa = allMahasiswa.concat(batch)

    if (batch.length < PAGE_LIMIT) {
      hasMore = false
    } else {
      page++
    }
  }

  return allMahasiswa
}
