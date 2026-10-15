import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react'
import { ActionButton, Badge, SectionCard } from './PageChrome'
import api from '../services/api'

// Konten RPS dari backend bisa berupa objek, string JSON, atau kosong.
function parseKonten(konten) {
  if (!konten) return null
  if (typeof konten === 'object') return konten
  if (typeof konten === 'string') {
    try {
      return JSON.parse(konten)
    } catch {
      return null
    }
  }
  return null
}

function formatTanggal(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function RpsDetail({ rps }) {
  const data = parseKonten(rps.konten)

  if (!data) {
    return (
      <p className="text-sm text-[#64748B]">
        Konten RPS kosong atau formatnya tidak dikenali.
      </p>
    )
  }

  const cpl = Array.isArray(data.cpl) ? data.cpl : []
  const cpmk = Array.isArray(data.cpmk) ? data.cpmk : []
  const pertemuan = Array.isArray(data.pertemuan) ? data.pertemuan : []
  const sumber = Array.isArray(rps.sumber_dokumen_rag) ? rps.sumber_dokumen_rag : []
  const totalBobot = pertemuan.reduce((sum, p) => sum + (Number(p.bobot) || 0), 0)

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
            Kode Mata Kuliah
          </p>
          <p className="mt-1 text-sm font-semibold text-[#142B4A]">{data.kode_mk || '-'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
            Total Bobot
          </p>
          <p
            className={`mt-1 text-sm font-semibold ${
              totalBobot === 100 ? 'text-[#10B981]' : 'text-[#EF4444]'
            }`}
          >
            {totalBobot}
            {totalBobot !== 100 ? ' (seharusnya 100)' : ''}
          </p>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
          Deskripsi Mata Kuliah
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[#142B4A]">{data.deskripsi_mk || '-'}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
            CPL ({cpl.length})
          </p>
          <ul className="mt-2 space-y-2">
            {cpl.map((c, i) => (
              <li key={`${c.kode}-${i}`} className="text-sm text-[#142B4A]">
                <span className="font-semibold">{c.kode}</span> — {c.deskripsi}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
            CPMK ({cpmk.length})
          </p>
          <ul className="mt-2 space-y-2">
            {cpmk.map((c, i) => (
              <li key={`${c.kode}-${i}`} className="text-sm text-[#142B4A]">
                <span className="font-semibold">{c.kode}</span> — {c.deskripsi}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
          Rencana Pembelajaran ({pertemuan.length} pertemuan)
        </p>
        <div className="mt-2 overflow-x-auto rounded-md border border-[#E2E8F0]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] text-xs uppercase text-[#64748B]">
              <tr>
                <th className="px-3 py-2 font-semibold">Mg</th>
                <th className="px-3 py-2 font-semibold">CPMK</th>
                <th className="px-3 py-2 font-semibold">Sub-CPMK</th>
                <th className="px-3 py-2 font-semibold">Materi</th>
                <th className="px-3 py-2 font-semibold">Metode</th>
                <th className="px-3 py-2 text-right font-semibold">Bobot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {pertemuan.map((p, i) => (
                <tr key={`${p.minggu}-${i}`} className="align-top text-[#142B4A]">
                  <td className="px-3 py-2 font-semibold">{p.minggu}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.cpmk ?? '-'}</td>
                  <td className="px-3 py-2">{p.sub_cpmk ?? '-'}</td>
                  <td className="px-3 py-2">{p.materi ?? '-'}</td>
                  <td className="px-3 py-2">{p.metode ?? '-'}</td>
                  <td className="px-3 py-2 text-right">{p.bobot ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sumber.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
            Sumber Dokumen Referensi (RAG)
          </p>
          <ul className="mt-2 space-y-1">
            {sumber.map((s, i) => (
              <li key={i} className="text-xs text-[#64748B]">
                {s.file}
                {s.page != null ? `, hal. ${s.page}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function RpsList({ mataKuliahId, refreshKey = 0 }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)

  const load = async () => {
    if (!mataKuliahId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/rps/${mataKuliahId}`)
      const list = Array.isArray(res.data) ? res.data : []
      setItems(list)
      // Buka otomatis draf terbaru (urutan dari backend: id terbesar dulu).
      setOpenId(list.length > 0 ? list[0].id : null)
    } catch (err) {
      console.warn('Gagal memuat daftar RPS:', err)
      setError('Gagal memuat daftar draf RPS.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mataKuliahId, refreshKey])

  return (
    <SectionCard
      title="Draf RPS (Hasil AI Assist)"
      description="Draf Rencana Pembelajaran Semester yang dibangkitkan AI untuk mata kuliah terpilih."
      action={
        <ActionButton variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Muat ulang
        </ActionButton>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat draf RPS...
        </div>
      ) : error ? (
        <p className="text-sm text-[#EF4444]">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#64748B]">
          Belum ada draf RPS. Klik “AI Assist (RPS / Narasi)” untuk membuatnya.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((rps, index) => {
            const isOpen = openId === rps.id
            return (
              <div key={rps.id} className="rounded-md border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : rps.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[#142B4A]">
                      Versi {items.length - index} · {rps.tahun_ajaran} · {rps.semester}
                    </span>
                    <Badge tone="default">{rps.status}</Badge>
                    <span className="text-xs text-[#64748B]">{formatTanggal(rps.created_at)}</span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-[#64748B]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#64748B]" />
                  )}
                </button>
                {isOpen && (
                  <div className="border-t border-[#E2E8F0] px-4 py-4">
                    <RpsDetail rps={rps} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}