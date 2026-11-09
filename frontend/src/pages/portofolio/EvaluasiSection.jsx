import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Sparkles } from 'lucide-react'
import { ActionButton, Badge, SectionCard } from '../../components/PageChrome'
import api from '../../services/api'
import { getApiErrorMessage } from '../superAdminHelpers'
import { formatNilai, formatTanggal } from './portofolioShared'

const area =
  'w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 py-2 text-xs leading-relaxed text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none'

function StatusMemenuhi({ value }) {
  if (value === null || value === undefined) return <Badge>Belum dinilai</Badge>
  return value ? <Badge tone="success">Memenuhi</Badge> : <Badge tone="danger">Belum memenuhi</Badge>
}

export default function EvaluasiSection({ mkId, canWrite, pushToast }) {
  const [data, setData] = useState(null)
  const [teks, setTeks] = useState({})
  const [dariAi, setDariAi] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [meminta, setMeminta] = useState(false)
  const [dirty, setDirty] = useState(false)

  const terapkan = (res) => {
    setData(res)
    const awal = {}
    for (const it of res.items || []) {
      awal[it.cpmk_id] = { analisis: it.analisis || '', rencana_perbaikan: it.rencana_perbaikan || '' }
    }
    setTeks(awal)
    setDariAi(new Set())
    setDirty(false)
  }

  const muat = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/portofolio/${mkId}/evaluasi`)
      terapkan(res.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat evaluasi CPMK'))
    } finally {
      setLoading(false)
    }
  }, [mkId])

  useEffect(() => {
    muat()
  }, [muat])

  const ubah = (cpmkId, key, value) => {
    setTeks((prev) => ({ ...prev, [cpmkId]: { ...prev[cpmkId], [key]: value } }))
    setDirty(true)
  }

  const mintaSaran = async () => {
    const adaIsi = Object.values(teks).some((t) => t.analisis.trim() || t.rencana_perbaikan.trim())
    if (adaIsi && !window.confirm('Teks yang sudah ada akan diganti dengan saran AI (belum tersimpan sampai Anda menekan Simpan). Lanjutkan?')) {
      return
    }
    setMeminta(true)
    try {
      const res = await api.post(`/portofolio/${mkId}/evaluasi/saran`)
      const baru = { ...teks }
      const ai = new Set()
      for (const s of res.data?.items || []) {
        if (!s.analisis && !s.rencana_perbaikan) continue
        baru[s.cpmk_id] = { analisis: s.analisis || '', rencana_perbaikan: s.rencana_perbaikan || '' }
        ai.add(s.cpmk_id)
      }
      setTeks(baru)
      setDariAi(ai)
      setDirty(true)
      pushToast(
        ai.size
          ? `Saran AI terisi untuk ${ai.size} CPMK. Tinjau dan edit, lalu tekan Simpan.`
          : 'AI tidak mengembalikan saran. Coba lagi.',
        ai.size ? 'success' : 'error',
      )
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal meminta saran AI'), 'error')
    } finally {
      setMeminta(false)
    }
  }

  const simpan = async () => {
    setSaving(true)
    try {
      const res = await api.put(`/portofolio/${mkId}/evaluasi`, {
        items: Object.entries(teks).map(([cpmkId, t]) => ({ cpmk_id: Number(cpmkId), ...t })),
      })
      terapkan(res.data)
      pushToast('Evaluasi CPMK tersimpan')
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan evaluasi'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <SectionCard><p className="text-sm text-red-600">{error}</p></SectionCard>
  if (loading || !data) {
    return (
      <SectionCard>
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat evaluasi CPMK...
        </div>
      </SectionCard>
    )
  }

  const items = data.items || []
  const adaNilai = items.some((i) => i.jumlah_dinilai > 0)

  return (
    <SectionCard
      title="Evaluasi Pemenuhan CPMK"
      description={`CPMK memenuhi bila rerata skor ≥ ${formatNilai(data.target_rerata_skala)} (skala 1–${data.skala_maks}) dan ≥ ${formatNilai(data.target_persen)}% mahasiswa mencapai nilai ${formatNilai(data.ambang_cpmk)}. Teks di bawah masuk ke sheet EVALUASI saat export Excel.`}
      action={
        canWrite ? (
          <div className="flex flex-wrap gap-2">
            <ActionButton
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              onClick={mintaSaran}
              disabled={meminta || !adaNilai}
              title={adaNilai ? undefined : 'Belum ada nilai CPMK'}
            >
              {meminta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {meminta ? 'AI sedang menyusun...' : 'Minta saran AI'}
            </ActionButton>
            <ActionButton className="px-3 py-1.5 text-xs" onClick={simpan} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Simpan
            </ActionButton>
          </div>
        ) : null
      }
    >
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#64748B]">Mata kuliah ini belum memiliki CPMK.</p>
      ) : (
        <div className="space-y-4">
          {!adaNilai ? (
            <p className="rounded-[6px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Belum ada nilai CPMK. Saran AI dapat diminta setelah nilai diinput dan kalkulasi dijalankan.
            </p>
          ) : null}
          {dirty ? <p className="text-xs font-medium text-amber-700">Ada perubahan yang belum disimpan.</p> : null}
          {items.map((it) => {
            const t = teks[it.cpmk_id] || { analisis: '', rencana_perbaikan: '' }
            return (
              <article key={it.cpmk_id} className="rounded-[6px] border border-[#E2E8F0] p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#142B4A]">{it.kode}</span>
                      <StatusMemenuhi value={it.memenuhi} />
                      {dariAi.has(it.cpmk_id) ? <Badge tone="warning">Saran AI — belum disimpan</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-[#64748B]">{it.deskripsi}</p>
                  </div>
                  <dl className="grid shrink-0 grid-cols-3 gap-4 text-xs">
                    <div>
                      <dt className="text-[#64748B]">Rerata nilai</dt>
                      <dd className="font-semibold tabular-nums">{formatNilai(it.rata_rata)}</dd>
                    </div>
                    <div>
                      <dt className="text-[#64748B]">Rerata skor</dt>
                      <dd className="font-semibold tabular-nums">{formatNilai(it.rerata_skala)}</dd>
                    </div>
                    <div>
                      <dt className="text-[#64748B]">Tercapai</dt>
                      <dd className="font-semibold tabular-nums">
                        {it.jumlah_dinilai ? `${it.jumlah_tercapai}/${it.jumlah_dinilai} (${formatNilai(it.persen_tercapai)}%)` : '-'}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="space-y-1 text-xs">
                    <span className="font-semibold text-[#142B4A]">Analisis Pelaksanaan Pembelajaran</span>
                    {canWrite ? (
                      <textarea rows={5} className={area} value={t.analisis} onChange={(e) => ubah(it.cpmk_id, 'analisis', e.target.value)} aria-label={`Analisis ${it.kode}`} />
                    ) : (
                      <p className="whitespace-pre-line text-[#142B4A]">{t.analisis || <span className="text-[#94A3B8]">Belum diisi</span>}</p>
                    )}
                  </div>
                  <div className="space-y-1 text-xs">
                    <span className="font-semibold text-[#142B4A]">Rencana Perbaikan Semester Depan</span>
                    {canWrite ? (
                      <textarea rows={5} className={area} value={t.rencana_perbaikan} onChange={(e) => ubah(it.cpmk_id, 'rencana_perbaikan', e.target.value)} aria-label={`Rencana perbaikan ${it.kode}`} />
                    ) : (
                      <p className="whitespace-pre-line text-[#142B4A]">{t.rencana_perbaikan || <span className="text-[#94A3B8]">Belum diisi</span>}</p>
                    )}
                  </div>
                </div>
                {it.updated_at ? <p className="mt-2 text-[11px] text-[#94A3B8]">Terakhir disimpan {formatTanggal(it.updated_at)}</p> : null}
              </article>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}
