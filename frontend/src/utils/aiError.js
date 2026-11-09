import { getApiErrorMessage } from '../pages/superAdminHelpers'

// Pesan error untuk proses AI (Generate RPS / Narasi) yang memakai axios + AbortController.

/** True bila request dibatalkan pengguna lewat AbortController. */
export function isDibatalkan(err) {
  return err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError'
}

export function pesanErrorAi(err, fallback) {
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
    return 'Proses melewati batas 2 menit dan dihentikan. Coba lagi; bila terus terjadi, layanan AI mungkin sedang sibuk.'
  }
  const status = err?.response?.status
  if (status === 503) {
    return 'Layanan AI belum siap (basis pengetahuan belum dimuat atau layanan sedang dimulai). Coba lagi beberapa saat lagi atau hubungi admin.'
  }
  if (status === 504) {
    return 'Layanan AI tidak merespons tepat waktu (504). Coba lagi beberapa saat lagi.'
  }
  if (!err?.response) {
    return 'Tidak dapat terhubung ke server. Pastikan backend dan layanan AI berjalan, lalu coba lagi.'
  }
  return getApiErrorMessage(err, fallback)
}
