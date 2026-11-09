import { apiBaseUrl } from '../services/api'

// POST yang membaca balasan Server-Sent Events (text/event-stream) secara bertahap.
// EventSource bawaan browser hanya mendukung GET tanpa header, jadi dipakai fetch + ReadableStream.
//
// Kegagalan dilempar dengan bentuk mirip error axios ({ response: { status, data } }) supaya
// pesanErrorAi() / getApiErrorMessage() bisa dipakai ulang tanpa perubahan.

function buatError(status, data, message) {
  const err = new Error(message || `HTTP ${status}`)
  err.response = { status, data }
  return err
}

/**
 * @param {string} path      path di bawah /api/v1, mis. `/rps/12/generate/stream`
 * @param {object} body      badan JSON
 * @param {object} opsi
 * @param {AbortSignal} [opsi.signal]
 * @param {(jenis: string, data: any) => void} opsi.onEvent  dipanggil untuk setiap event
 */
export async function streamSse(path, body, { signal, onEvent }) {
  const token = localStorage.getItem('token')
  const resp = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    let data = null
    try {
      data = await resp.json()
    } catch {
      data = null
    }
    throw buatError(resp.status, data)
  }
  if (!resp.body) throw buatError(resp.status, null, 'Browser tidak mendukung pembacaan respons bertahap')

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let sisa = ''

  const proses = (blok) => {
    let jenis = 'message'
    const data = []
    for (const baris of blok.split('\n')) {
      if (baris.startsWith('event:')) jenis = baris.slice(6).trim()
      else if (baris.startsWith('data:')) data.push(baris.slice(5).replace(/^ /, ''))
    }
    if (!data.length) return
    let isi
    try {
      isi = JSON.parse(data.join('\n'))
    } catch {
      isi = data.join('\n')
    }
    onEvent(jenis, isi)
  }

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    sisa += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let batas = sisa.indexOf('\n\n')
    while (batas !== -1) {
      proses(sisa.slice(0, batas))
      sisa = sisa.slice(batas + 2)
      batas = sisa.indexOf('\n\n')
    }
  }
  if (sisa.trim()) proses(sisa)
}
