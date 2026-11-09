import { createContext, useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import api from '../services/api'
import { streamSse } from '../utils/sseFetch'
import { isDibatalkan, pesanErrorAi } from '../utils/aiError'
import useAuth from '../hooks/useAuth'

// Proses AI (Generate RPS / Narasi) yang hidup di level aplikasi, bukan di halaman.
// Karena itu proses tetap berjalan saat dosen menutup jendela ("Jalankan di latar belakang")
// atau pindah halaman; kemajuannya tampil di AiJobDock dan hasilnya bisa dibuka kembali.
//
// Satu job per jenis ('rps' | 'narasi'). Bentuk job:
//   { jenis, status: 'running'|'success'|'error', mode: 'stream'|'estimasi', mk, mulaiPada, selesaiPada,
//     info, tahap: { [id]: {status, detail} }, tahapAktif, percobaan, pelanggaran, sumber, teks,
//     hasil, error, latar, permintaan }

export const AiJobContext = createContext(null)

const PESAN_GAGAL = {
  rps: 'Gagal menyusun draf RPS. Coba lagi nanti.',
  narasi: 'Gagal menyusun narasi. Anda tetap bisa menulis isi laporan secara manual.',
}

function reducer(state, aksi) {
  const job = state[aksi.jenis]
  switch (aksi.type) {
    case 'mulai':
      return {
        ...state,
        [aksi.jenis]: {
          jenis: aksi.jenis,
          status: 'running',
          mode: 'stream',
          mk: aksi.mk,
          mulaiPada: Date.now(),
          selesaiPada: null,
          info: null,
          tahap: {},
          tahapAktif: null,
          percobaan: 1,
          pelanggaran: [],
          sumber: [],
          teks: '',
          hasil: null,
          error: '',
          latar: Boolean(aksi.latar),
          permintaan: aksi.permintaan,
        },
      }
    case 'event': {
      if (!job || job.status !== 'running') return state
      const { nama, data } = aksi
      if (nama === 'mulai') return { ...state, [aksi.jenis]: { ...job, info: data } }
      if (nama === 'sumber') return { ...state, [aksi.jenis]: { ...job, sumber: data?.sumber || [] } }
      if (nama === 'ulang') {
        return {
          ...state,
          [aksi.jenis]: { ...job, teks: '', percobaan: data?.percobaan || job.percobaan + 1, pelanggaran: data?.pelanggaran || [] },
        }
      }
      if (nama === 'tahap') {
        const lama = job.tahap[data.id] || {}
        return {
          ...state,
          [aksi.jenis]: {
            ...job,
            tahap: { ...job.tahap, [data.id]: { status: data.status, detail: data.detail ?? lama.detail } },
            tahapAktif: data.status === 'mulai' ? data.id : job.tahapAktif,
            percobaan: data.percobaan || job.percobaan,
          },
        }
      }
      return state
    }
    case 'teks':
      if (!job || job.status !== 'running') return state
      return { ...state, [aksi.jenis]: { ...job, teks: job.teks + aksi.teks } }
    case 'estimasi':
      if (!job) return state
      return { ...state, [aksi.jenis]: { ...job, mode: 'estimasi' } }
    case 'sukses':
      if (!job) return state
      return { ...state, [aksi.jenis]: { ...job, status: 'success', hasil: aksi.hasil, selesaiPada: Date.now() } }
    case 'gagal':
      if (!job) return state
      return { ...state, [aksi.jenis]: { ...job, status: 'error', error: aksi.pesan, selesaiPada: Date.now() } }
    case 'latar':
      if (!job) return state
      return { ...state, [aksi.jenis]: { ...job, latar: aksi.nilai } }
    case 'hapus': {
      const sisa = { ...state }
      delete sisa[aksi.jenis]
      return sisa
    }
    default:
      return state
  }
}

export function AiJobProvider({ children }) {
  const [jobs, dispatch] = useReducer(reducer, {})
  const kontrolRef = useRef({}) // AbortController per jenis
  const bufferRef = useRef({}) // potongan teks yang belum digabung ke state

  // Potongan token datang sangat sering; gabungkan ke state paling cepat tiap 120 ms
  // supaya render tidak berlebihan.
  const flush = useCallback((jenis) => {
    const teks = bufferRef.current[jenis]
    if (teks) {
      bufferRef.current[jenis] = ''
      dispatch({ type: 'teks', jenis, teks })
    }
  }, [])

  const adaYangJalan = Object.values(jobs).some((j) => j.status === 'running')
  useEffect(() => {
    if (!adaYangJalan) return undefined
    const id = setInterval(() => {
      Object.keys(bufferRef.current).forEach(flush)
    }, 120)
    return () => clearInterval(id)
  }, [adaYangJalan, flush])

  const jalankan = useCallback(
    async (jenis, { mk, streamPath, fallbackPath, body }, { latar = false } = {}) => {
      kontrolRef.current[jenis]?.abort()
      const controller = new AbortController()
      kontrolRef.current[jenis] = controller
      bufferRef.current[jenis] = ''
      dispatch({ type: 'mulai', jenis, mk, latar, permintaan: { mk, streamPath, fallbackPath, body } })

      let adaEvent = false
      let selesai = false
      try {
        await streamSse(streamPath, body, {
          signal: controller.signal,
          onEvent: (nama, data) => {
            adaEvent = true
            if (nama === 'token') {
              bufferRef.current[jenis] = (bufferRef.current[jenis] || '') + (data?.teks || '')
              return
            }
            flush(jenis)
            if (nama === 'selesai') {
              selesai = true
              dispatch({ type: 'sukses', jenis, hasil: data })
            } else if (nama === 'error') {
              selesai = true
              const err = { response: { status: data?.status || 502, data: { detail: data?.pesan } } }
              dispatch({ type: 'gagal', jenis, pesan: pesanErrorAi(err, PESAN_GAGAL[jenis]) })
            } else {
              dispatch({ type: 'event', jenis, nama, data })
            }
          },
        })
        flush(jenis)
        if (!selesai) {
          dispatch({ type: 'gagal', jenis, pesan: 'Koneksi ke server terputus sebelum proses selesai. Coba lagi.' })
        }
      } catch (err) {
        if (isDibatalkan(err)) {
          dispatch({ type: 'hapus', jenis })
          return
        }
        const status = err?.response?.status
        // Backend/AI service versi lama belum punya endpoint streaming: pakai endpoint biasa
        // dan perkirakan tahapnya dari waktu berjalan.
        if (!adaEvent && (status === 404 || status === 405)) {
          dispatch({ type: 'estimasi', jenis })
          try {
            const res = await api.post(fallbackPath, body, { timeout: 120000, signal: controller.signal })
            dispatch({ type: 'sukses', jenis, hasil: res.data })
          } catch (err2) {
            if (isDibatalkan(err2)) dispatch({ type: 'hapus', jenis })
            else dispatch({ type: 'gagal', jenis, pesan: pesanErrorAi(err2, PESAN_GAGAL[jenis]) })
          }
          return
        }
        dispatch({ type: 'gagal', jenis, pesan: pesanErrorAi(err, PESAN_GAGAL[jenis]) })
      } finally {
        if (kontrolRef.current[jenis] === controller) delete kontrolRef.current[jenis]
      }
    },
    [flush],
  )

  const mulaiRps = useCallback(
    (mk, body) =>
      jalankan('rps', {
        mk,
        body,
        streamPath: `/rps/${mk.id}/generate/stream`,
        fallbackPath: `/rps/${mk.id}/generate`,
      }),
    [jalankan],
  )

  const mulaiNarasi = useCallback(
    (mk, body = { tipe: 'rekomendasi_umum' }) =>
      jalankan('narasi', {
        mk,
        body,
        streamPath: `/narasi/generate/${mk.id}/stream`,
        fallbackPath: `/narasi/generate/${mk.id}`,
      }),
    [jalankan],
  )

  const ulangi = useCallback(
    (jenis) => {
      const job = jobs[jenis]
      if (job?.permintaan) jalankan(jenis, job.permintaan, { latar: job.latar })
    },
    [jobs, jalankan],
  )

  const batal = useCallback((jenis) => kontrolRef.current[jenis]?.abort(), [])
  const keLatar = useCallback((jenis) => dispatch({ type: 'latar', jenis, nilai: true }), [])
  const kembalikan = useCallback((jenis) => dispatch({ type: 'latar', jenis, nilai: false }), [])
  const hapus = useCallback((jenis) => dispatch({ type: 'hapus', jenis }), [])

  // Keluar akun: hentikan dan buang semua proses milik sesi sebelumnya.
  const { user } = useAuth()
  const userId = user?.id ?? null
  useEffect(() => {
    if (userId) return
    Object.values(kontrolRef.current).forEach((c) => c.abort())
    ;['rps', 'narasi'].forEach((jenis) => dispatch({ type: 'hapus', jenis }))
  }, [userId])

  const nilai = useMemo(
    () => ({ jobs, mulaiRps, mulaiNarasi, ulangi, batal, keLatar, kembalikan, hapus }),
    [jobs, mulaiRps, mulaiNarasi, ulangi, batal, keLatar, kembalikan, hapus],
  )

  return <AiJobContext.Provider value={nilai}>{children}</AiJobContext.Provider>
}
