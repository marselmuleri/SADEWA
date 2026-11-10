import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Search } from 'lucide-react'
import Modal from '../Modal'
import { Badge } from '../PageChrome'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import { getApiErrorMessage } from '../../pages/superAdminHelpers'
import { round2 } from './cpmkData'

/**
 * Atur CPL & IK sebuah CPMK: pilih IK (dikelompokkan per CPL) dan bagi bobotnya.
 * Aturan backend: total bobot IK harus sama persis dengan bobot CPMK. Bila berbeda,
 * pengguna yang berwenang bisa sekaligus menyesuaikan bobot CPMK ke total IK.
 */
export default function CpmkMappingModal({
  open,
  onClose,
  onSaved,
  cpmk,
  kurikulumVersionId = null,
  cplList = [],
  ikList = [],
  readOnly = false,
}) {
  const { pushToast } = useToast()
  const [weights, setWeights] = useState({}) // ik_id -> angka / ''
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [query, setQuery] = useState('')
  const [onlySelected, setOnlySelected] = useState(false)

  useEffect(() => {
    if (!open || !cpmk) return
    let cancelled = false
    setQuery('')
    setOnlySelected(false)
    setLoading(true)
    api
      .get(`/cpmk/${cpmk.id}/map-ik`)
      .then((res) => {
        if (cancelled) return
        const dict = {}
        for (const m of Array.isArray(res.data) ? res.data : []) dict[m.ik_id] = Number(m.bobot)
        setWeights(dict)
        setOnlySelected(readOnly && Object.keys(dict).length > 0)
      })
      .catch((err) => {
        if (cancelled) return
        pushToast(getApiErrorMessage(err, 'Gagal memuat pemetaan IK'), 'error')
        setWeights({})
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cpmk?.id])

  // Hanya CPL dari versi kurikulum mata kuliah ini (bila diketahui).
  const groups = useMemo(() => {
    const q = query.toLowerCase().trim()
    const cpls = kurikulumVersionId
      ? cplList.filter((c) => !c.kurikulum_version_id || c.kurikulum_version_id === kurikulumVersionId)
      : cplList
    const result = []
    for (const cpl of cpls) {
      const cplMatch = !q || `${cpl.kode} ${cpl.deskripsi || ''}`.toLowerCase().includes(q)
      const iks = ikList.filter((ik) => {
        if (ik.cpl_id !== cpl.id) return false
        if (onlySelected && !(Number(weights[ik.id]) > 0)) return false
        return cplMatch || `${ik.kode} ${ik.deskripsi || ''}`.toLowerCase().includes(q)
      })
      if (iks.length > 0) result.push({ cpl, iks })
    }
    return result
  }, [cplList, ikList, kurikulumVersionId, query, onlySelected, weights])

  const cpmkBobot = round2(cpmk?.bobot)
  const active = Object.entries(weights)
    .map(([ikId, val]) => ({ ik_id: Number(ikId), bobot: round2(val) }))
    .filter((m) => m.bobot > 0)
  const total = round2(active.reduce((acc, m) => acc + m.bobot, 0))
  const selectedCplCount = new Set(
    active.map((m) => ikList.find((ik) => ik.id === m.ik_id)?.cpl_id).filter(Boolean)
  ).size
  const matches = active.length === 0 || total === cpmkBobot
  const willChangeBobot = !matches

  const handleWeight = (ikId, value) => {
    setWeights((prev) => ({ ...prev, [ikId]: value === '' ? '' : Math.max(0, Number(value)) }))
  }

  const toggleIk = (ikId) => {
    setWeights((prev) => {
      if (Number(prev[ikId]) > 0) return { ...prev, [ikId]: '' }
      // Isi otomatis dengan sisa bobot CPMK agar total cepat pas.
      const sisa = round2(cpmkBobot - total)
      return { ...prev, [ikId]: sisa > 0 ? sisa : 0 }
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (readOnly || !cpmk) return
    setSubmitting(true)
    try {
      const body = { mappings: active }
      if (willChangeBobot) body.bobot_cpmk = total
      await api.put(`/cpmk/${cpmk.id}/map-ik`, body)
      pushToast(
        willChangeBobot
          ? `Pemetaan ${cpmk.kode} disimpan, bobot CPMK menjadi ${total}%`
          : `Pemetaan CPL & IK untuk ${cpmk.kode} berhasil disimpan`
      )
      onSaved?.()
      onClose()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan pemetaan IK'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!cpmk) return null

  return (
    <Modal
      open={open}
      title={`${readOnly ? 'CPL & IK' : 'Atur CPL & IK'} — ${cpmk.kode}`}
      onClose={submitting ? () => {} : onClose}
      size="max-w-3xl"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm">
          <span className="font-semibold text-[#142B4A]">Deskripsi CPMK:</span>
          <p className="mt-0.5 leading-relaxed text-[#475569]">{cpmk.deskripsi}</p>
        </div>

        {/* Ringkasan bobot */}
        <div
          data-testid="mapping-summary"
          className={`rounded-[6px] border p-3 text-sm ${
            matches ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold">
              {matches ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
              <span>
                Total bobot IK: {total}% dari bobot CPMK {cpmkBobot}%
              </span>
            </div>
            <span className="text-sm">
              {active.length} IK · {selectedCplCount} CPL
            </span>
          </div>
          {!matches && !readOnly ? (
            <p className="mt-1.5 text-sm">
              Total bobot IK harus sama dengan bobot CPMK. Jika disimpan sekarang, <strong>bobot CPMK akan diubah
              menjadi {total}%</strong>. Atau sesuaikan bobot IK agar totalnya {cpmkBobot}%.
            </p>
          ) : null}
        </div>

        {/* Pencarian */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kode atau deskripsi CPL / IK..."
              data-testid="mapping-search"
              className="w-full rounded-[6px] border border-[#CBD5E1] py-2 pl-9 pr-3 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[#142B4A]">
            <input
              type="checkbox"
              checked={onlySelected}
              onChange={(e) => setOnlySelected(e.target.checked)}
              className="h-4 w-4 rounded border-[#CBD5E1]"
            />
            Tampilkan yang dipilih saja
          </label>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-[#64748B]">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#1A3A6B]" />
            Memuat data pemetaan...
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-[6px] border border-dashed border-[#CBD5E1] py-8 text-center text-sm text-[#64748B]">
            {query || onlySelected
              ? 'Tidak ada CPL / IK yang cocok.'
              : 'Belum ada CPL dan IK pada kurikulum mata kuliah ini. Hubungi Admin Prodi.'}
          </div>
        ) : (
          <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">
            {groups.map(({ cpl, iks }) => (
              <div key={cpl.id} className="overflow-hidden rounded-[6px] border border-[#E2E8F0]">
                <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                  <div className="min-w-0">
                    <span className="font-mono text-sm font-bold text-[#1A3A6B]">{cpl.kode}</span>
                    <p className="text-sm text-[#475569]">{cpl.deskripsi}</p>
                  </div>
                  {cpl.threshold_capaian != null ? <Badge tone="default">Ambang {cpl.threshold_capaian}%</Badge> : null}
                </div>
                <div className="divide-y divide-[#E2E8F0]">
                  {iks.map((ik) => {
                    const val = weights[ik.id] ?? ''
                    const checked = Number(val) > 0
                    return (
                      <div
                        key={ik.id}
                        className={`flex items-start justify-between gap-4 p-3 transition-colors ${checked ? 'bg-[#EEF3FA]' : ''}`}
                      >
                        <label className={`flex min-w-0 items-start gap-3 ${readOnly ? '' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={readOnly}
                            onChange={() => toggleIk(ik.id)}
                            data-testid={`check-ik-${ik.id}`}
                            className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#CBD5E1]"
                          />
                          <span className="min-w-0">
                            <span className="block font-mono text-sm font-bold text-[#142B4A]">{ik.kode}</span>
                            <span className="block text-sm leading-relaxed text-[#475569]">{ik.deskripsi}</span>
                          </span>
                        </label>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={val}
                            disabled={readOnly}
                            onChange={(e) => handleWeight(ik.id, e.target.value)}
                            aria-label={`Bobot ${ik.kode}`}
                            data-testid={`input-weight-ik-${ik.id}`}
                            className="w-20 rounded-[4px] border border-[#CBD5E1] px-2 py-1.5 text-right font-mono text-sm font-bold focus:border-[#1A3A6B] focus:outline-none disabled:bg-transparent disabled:border-transparent"
                          />
                          <span className="text-sm font-semibold text-[#64748B]">%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-3">
          <span className="text-sm text-[#64748B]">
            {readOnly
              ? 'Mode lihat: pemetaan hanya dapat diubah oleh dosen pengampu atau Admin Prodi.'
              : 'Centang IK yang diukur CPMK ini. CPL ikut terpilih dari IK-nya.'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-[6px] border border-[#CBD5E1] px-4 py-2 text-sm font-semibold text-[#142B4A] hover:border-[#1A3A6B]"
            >
              {readOnly ? 'Tutup' : 'Batal'}
            </button>
            {!readOnly ? (
              <button
                type="submit"
                disabled={submitting || loading}
                data-testid="submit-mapping-button"
                className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#142B4A] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{willChangeBobot ? `Simpan & ubah bobot ke ${total}%` : 'Simpan Pemetaan'}</span>
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </Modal>
  )
}
