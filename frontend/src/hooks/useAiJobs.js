import { useContext, useEffect, useState } from 'react'
import { AiJobContext } from '../context/AiJobContext'

export default function useAiJobs() {
  const ctx = useContext(AiJobContext)
  if (!ctx) throw new Error('useAiJobs harus dipakai di dalam AiJobProvider')
  return ctx
}

/** Detik berjalan sejak `mulaiPada` (ms). Berhenti di `selesaiPada` bila ada. Tahan remount. */
export function useDetikSejak(mulaiPada, selesaiPada) {
  const [sekarang, setSekarang] = useState(() => Date.now())
  useEffect(() => {
    if (!mulaiPada || selesaiPada) return undefined
    setSekarang(Date.now())
    const id = setInterval(() => setSekarang(Date.now()), 1000)
    return () => clearInterval(id)
  }, [mulaiPada, selesaiPada])
  if (!mulaiPada) return 0
  return Math.max(0, Math.floor(((selesaiPada || sekarang) - mulaiPada) / 1000))
}
