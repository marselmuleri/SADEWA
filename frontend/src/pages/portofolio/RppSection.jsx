import { useCallback, useEffect, useState } from 'react'
import { FileDown, ListPlus, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { ActionButton, SectionCard } from '../../components/PageChrome'
import api from '../../services/api'
import { parseRpsKonten } from '../../utils/rpsExport'
import { getApiErrorMessage } from '../superAdminHelpers'
import { formatTanggal } from './portofolioShared'

const JUMLAH_PERTEMUAN_STANDAR = 16
const cell =
  'w-full rounded-[4px] border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none'

const barisKosong = (n) => ({
  pertemuan_ke: n, tanggal: '', cpmk: '', materi: '', metode: '', waktu: '',
  pengalaman_belajar: '', indikator_kriteria: '', realisasi: '', catatan: '',
})

function normalisasi(p) {
  return {
    pertemuan_ke: Number(p.pertemuan_ke),
    tanggal: p.tanggal || '',
    cpmk: p.cpmk || '',
    materi: p.materi || '',
    metode: p.metode || '',
    waktu: p.waktu || '',
    pengalaman_belajar: p.pengalaman_belajar || '',
    indikator_kriteria: p.indikator_kriteria || '',
    realisasi: p.realisasi || '',
    catatan: p.catatan || '',
  }
}

export default function RppSection({ mkId, canWrite, pushToast, onChanged }) {
  const [rows, setRows] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)
  const [cpmkList, setCpmkList] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState(null)

  const muat = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rpp, cpmk] = await Promise.all([
        api.get(`/portofolio/${mkId}/rpp`),
        api.get('/cpmk', { params: { mata_kuliah_id: mkId } }).catch(() => ({ data: [] })),
      ])
      setRows((rpp.data?.pertemuan || []).map(normalisasi))
      setUpdatedAt(rpp.data?.updated_at || null)
      setCpmkList(Array.isArray(cpmk.data) ? cpmk.data : [])
      setDirty(false)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat RPP'))
    } finally {
      setLoading(false)
    }
  }, [mkId])

  useEffect(() => {
    muat()
  }, [muat])

  const ubah = (idx, key, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)))
    setDirty(true)
  }

  const tambah = () => {
    const next = rows.reduce((m, r) => Math.max(m, Number(r.pertemuan_ke) || 0), 0) + 1
    setRows((prev) => [...prev, barisKosong(next)])
    setDirty(true)
  }

  const hapus = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const isiStandar = () => {
    const ada = new Set(rows.map((r) => Number(r.pertemuan_ke)))
    const baru = []
    for (let n = 1; n <= JUMLAH_PERTEMUAN_STANDAR; n += 1) {
      if (!ada.has(n)) baru.push(barisKosong(n))
    }
    setRows((prev) => [...prev, ...baru].sort((a, b) => a.pertemuan_ke - b.pertemuan_ke))
    setDirty(true)
  }

  const ambilDariRps = async () => {
    try {
      const res = await api.get(`/rps/${mkId}`)
      const terbaru = Array.isArray(res.data) ? res.data[0] : null
      const pertemuan = parseRpsKonten(terbaru?.konten)?.pertemuan
      if (!Array.isArray(pertemuan) || pertemuan.length === 0) {
        pushToast('Belum ada draf RPS (hasil generate AI) untuk mata kuliah ini', 'error')
        return
      }
      if (rows.length > 0 && !window.confirm('Isi RPP saat ini akan diganti dengan rencana dari draf RPS. Lanjutkan?')) return
      setRows(
        pertemuan.map((p, i) => ({
          ...barisKosong(Number(p.minggu) || i + 1),
          cpmk: p.cpmk || '',
          materi: [p.sub_cpmk, p.materi].filter(Boolean).join(' — '),
          metode: p.metode || '',
        })),
      )
      setDirty(true)
      pushToast('Rencana pertemuan diambil dari draf RPS. Periksa lalu simpan.')
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal mengambil draf RPS'), 'error')
    }
  }

  const simpan = async () => {
    const nomor = rows.map((r) => Number(r.pertemuan_ke))
    if (nomor.some((n) => !Number.isInteger(n) || n < 1 || n > 32)) {
      pushToast('Nomor pertemuan harus antara 1 dan 32', 'error')
      return
    }
    if (new Set(nomor).size !== nomor.length) {
      pushToast('Nomor pertemuan tidak boleh ganda', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await api.put(`/portofolio/${mkId}/rpp`, {
        pertemuan: rows.map((r) => ({ ...r, pertemuan_ke: Number(r.pertemuan_ke), tanggal: r.tanggal || null })),
      })
      setRows((res.data?.pertemuan || []).map(normalisasi))
      setUpdatedAt(res.data?.updated_at || null)
      setDirty(false)
      pushToast('RPP berhasil disimpan')
      onChanged?.()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan RPP'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const terisi = rows.filter((r) => r.realisasi.trim()).length

  return (
    <SectionCard
      title="Rencana Pelaksanaan Pembelajaran (RPP)"
      description={
        rows.length
          ? `${rows.length} pertemuan · ${terisi} sudah ada realisasi · diperbarui ${formatTanggal(updatedAt)}`
          : 'Rencana dan realisasi materi setiap pertemuan.'
      }
      action={
        canWrite ? (
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" onClick={ambilDariRps} disabled={loading}>
              <FileDown className="h-3.5 w-3.5" /> Ambil dari draf RPS
            </ActionButton>
            <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" onClick={isiStandar} disabled={loading}>
              <ListPlus className="h-3.5 w-3.5" /> Isi {JUMLAH_PERTEMUAN_STANDAR} pertemuan
            </ActionButton>
            <ActionButton className="px-3 py-1.5 text-xs" onClick={simpan} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Simpan
            </ActionButton>
          </div>
        ) : null
      }
    >
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat RPP...
        </div>
      ) : rows.length === 0 && !canWrite ? (
        <p className="py-6 text-center text-sm text-[#64748B]">Dosen pengampu belum mengisi RPP.</p>
      ) : (
        <div className="space-y-3">
          {dirty ? <p className="text-xs font-medium text-amber-700">Ada perubahan yang belum disimpan.</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">
                  <th className="w-16 py-2 pr-2">Ke</th>
                  <th className="w-36 py-2 pr-2">Tanggal</th>
                  <th className="w-28 py-2 pr-2">CPMK</th>
                  <th className="py-2 pr-2">Materi / Sub-CPMK</th>
                  <th className="w-44 py-2 pr-2">Metode</th>
                  <th className="w-28 py-2 pr-2">Waktu</th>
                  <th className="w-48 py-2 pr-2">Pengalaman Belajar</th>
                  <th className="w-48 py-2 pr-2">Indikator &amp; Kriteria</th>
                  <th className="py-2 pr-2">Realisasi</th>
                  <th className="w-40 py-2 pr-2">Catatan</th>
                  {canWrite ? <th className="w-8 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) =>
                  canWrite ? (
                    <tr key={idx} className="border-b border-[#EEF2F6] align-top">
                      <td className="py-1.5 pr-2">
                        <input type="number" min={1} max={32} className={cell} value={r.pertemuan_ke} onChange={(e) => ubah(idx, 'pertemuan_ke', e.target.value)} aria-label="Pertemuan ke" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input type="date" className={cell} value={r.tanggal} onChange={(e) => ubah(idx, 'tanggal', e.target.value)} aria-label="Tanggal" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <select className={cell} value={r.cpmk} onChange={(e) => ubah(idx, 'cpmk', e.target.value)} aria-label="CPMK">
                          <option value="">-</option>
                          {r.cpmk && !cpmkList.some((c) => c.kode === r.cpmk) ? <option value={r.cpmk}>{r.cpmk}</option> : null}
                          {cpmkList.map((c) => (
                            <option key={c.id} value={c.kode}>{c.kode}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 pr-2">
                        <textarea rows={2} className={cell} value={r.materi} onChange={(e) => ubah(idx, 'materi', e.target.value)} aria-label="Materi" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <textarea rows={2} className={cell} value={r.metode} onChange={(e) => ubah(idx, 'metode', e.target.value)} aria-label="Metode" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input className={cell} value={r.waktu} maxLength={100} placeholder="2 x 50 menit" onChange={(e) => ubah(idx, 'waktu', e.target.value)} aria-label="Waktu" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <textarea rows={2} className={cell} value={r.pengalaman_belajar} onChange={(e) => ubah(idx, 'pengalaman_belajar', e.target.value)} aria-label="Pengalaman belajar" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <textarea rows={2} className={cell} value={r.indikator_kriteria} onChange={(e) => ubah(idx, 'indikator_kriteria', e.target.value)} aria-label="Indikator dan kriteria" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <textarea rows={2} className={cell} value={r.realisasi} onChange={(e) => ubah(idx, 'realisasi', e.target.value)} placeholder="Yang benar-benar terlaksana" aria-label="Realisasi" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <textarea rows={2} className={cell} value={r.catatan} onChange={(e) => ubah(idx, 'catatan', e.target.value)} aria-label="Catatan" />
                      </td>
                      <td className="py-1.5">
                        <button type="button" onClick={() => hapus(idx)} aria-label={`Hapus pertemuan ${r.pertemuan_ke}`} className="rounded p-1.5 text-red-600 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={idx} className="border-b border-[#EEF2F6] align-top">
                      <td className="py-2 pr-2 font-semibold">{r.pertemuan_ke}</td>
                      <td className="py-2 pr-2">{r.tanggal ? new Date(r.tanggal).toLocaleDateString('id-ID') : '-'}</td>
                      <td className="py-2 pr-2">{r.cpmk || '-'}</td>
                      <td className="whitespace-pre-line py-2 pr-2">{r.materi || '-'}</td>
                      <td className="whitespace-pre-line py-2 pr-2">{r.metode || '-'}</td>
                      <td className="py-2 pr-2">{r.waktu || '-'}</td>
                      <td className="whitespace-pre-line py-2 pr-2">{r.pengalaman_belajar || '-'}</td>
                      <td className="whitespace-pre-line py-2 pr-2">{r.indikator_kriteria || '-'}</td>
                      <td className="whitespace-pre-line py-2 pr-2">{r.realisasi || <span className="text-[#94A3B8]">Belum diisi</span>}</td>
                      <td className="whitespace-pre-line py-2 pr-2">{r.catatan || '-'}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          {canWrite ? (
            <ActionButton variant="ghost" className="px-3 py-1.5 text-xs" onClick={tambah}>
              <Plus className="h-3.5 w-3.5" /> Tambah pertemuan
            </ActionButton>
          ) : null}
        </div>
      )}
    </SectionCard>
  )
}
