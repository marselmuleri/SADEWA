// Membaca JSON yang belum selesai ditulis (mis. potongan keluaran LLM yang sedang di-stream).
// Contoh: '{"pertemuan": [{"minggu": 1, "materi": "Pengan'  ->  { pertemuan: [{ minggu: 1, materi: 'Pengan' }] }
//
// Caranya: telusuri teks sambil mencatat kurung yang masih terbuka dan posisi "aman" terakhir
// (setelah satu nilai lengkap). Coba tutup teks apa adanya; bila gagal, potong ke posisi aman
// terakhir lalu tutup. Mengembalikan null bila belum ada objek yang bisa dibaca.

const PENUTUP = { '{': '}', '[': ']' }

function tutup(teks, stack) {
  let akhir = teks.replace(/[\s,]+$/, '')
  if (/:\s*$/.test(akhir)) akhir += 'null'
  for (let i = stack.length - 1; i >= 0; i -= 1) akhir += PENUTUP[stack[i]]
  return akhir
}

function coba(teks) {
  try {
    return JSON.parse(teks)
  } catch {
    return undefined
  }
}

export function parsePartialJson(teks) {
  if (!teks) return null
  const mulai = teks.indexOf('{')
  if (mulai === -1) return null
  const s = teks.slice(mulai)

  const stack = []
  let dalamString = false
  let escape = false
  let aman = null // { idx, stack }

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    if (dalamString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') dalamString = false
      continue
    }
    if (ch === '"') dalamString = true
    else if (ch === '{' || ch === '[') {
      stack.push(ch)
      aman = { idx: i + 1, stack: stack.slice() }
    } else if (ch === '}' || ch === ']') {
      stack.pop()
      if (!stack.length) {
        const utuh = coba(s.slice(0, i + 1))
        if (utuh !== undefined) return utuh
      }
      aman = { idx: i + 1, stack: stack.slice() }
    } else if (ch === ',') {
      aman = { idx: i, stack: stack.slice() }
    }
  }

  // 1) Tutup apa adanya (string yang terpotong ikut ditutup, sehingga teks setengah jadi tetap tampil).
  let kandidat = s
  if (dalamString) kandidat += escape ? '\\"' : '"'
  const hasil = coba(tutup(kandidat, stack))
  if (hasil !== undefined) return hasil

  // 2) Potong ke nilai lengkap terakhir.
  if (aman) {
    const cadangan = coba(tutup(s.slice(0, aman.idx), aman.stack))
    if (cadangan !== undefined) return cadangan
  }
  return null
}
