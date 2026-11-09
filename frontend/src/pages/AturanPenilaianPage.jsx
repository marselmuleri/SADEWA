import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { ActionButton, Badge, PageHeader, SectionCard } from '../components/PageChrome'
import ToastContainer from '../components/ToastContainer'
import useAuth from '../hooks/useAuth'
import useToast from '../hooks/useToast'
import api, { fetchKurikulumVersions } from '../services/api'
import { getApiErrorMessage } from './superAdminHelpers'

const input =
  'w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none'
const label = 'text-xs font-semibold text-[#142B4A]'

const RUBRIK_CONTOH = [
  { nama: 'Pemula', batas_bawah: 0, batas_atas: 59.99 },
  { nama: 'Berkembang', batas_bawah: 60, batas_atas: 69.99 },
  { nama: 'Mahir', batas_bawah: 70, batas_atas: 79.99 },
  { nama: 'Teladan', batas_bawah: 80, batas_atas: 100 },
]

const SKALA_CONTOH = [
  { huruf: 'A', batas_min: 85 }, { huruf: 'AB', batas_min: 80 }, { huruf: 'B', batas_min: 75 },
  { huruf: 'BC', batas_min: 70 }, { huruf: 'C', batas_min: 60 }, { huruf: 'D', batas_min: 40 },
  { huruf: 'E', batas_min: 0 },
]

function labelKelompok(k) {
  const min = k.angkatan_min === '' || k.angkatan_min === null ? null : Number(k.angkatan_min)
  const max = k.angkatan_max === '' || k.angkatan_max === null ? null : Number(k.angkatan_max)
  if (min === null && max === null) return 'Semua angkatan (bawaan)'
  if (min === null) return `Angkatan ${max} dan sebelumnya`
  if (max === null) return `Angkatan ${min} dan sesudahnya`
  return min === max ? `Angkatan ${min}` : `Angkatan ${min}–${max}`
}

// --- Ambang, target & GPM ------------------------------------------------------

function AturanUmum({ pushToast, onSaved }) {
  const [form, setForm] = useState(null)
  const [info, setInfo] = useState(null)
  const [saving, setSaving] = useState(false)

  const muat = useCallback(async () => {
    try {
      const res = await api.get('/aturan-penilaian')
      setInfo(res.data)
      setForm({
        ambang: res.data.ambang,
        target_rerata_skala: res.data.target_rerata_skala,
        target_persen: res.data.target_persen,
        gpm_nama: res.data.gpm_nama || '',
        gpm_nip: res.data.gpm_nip || '',
      })
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal memuat aturan penilaian'), 'error')
    }
  }, [pushToast])

  useEffect(() => {
    muat()
  }, [muat])

  const simpan = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.put('/aturan-penilaian', {
        ...form,
        ambang: Number(form.ambang),
        target_rerata_skala: Number(form.target_rerata_skala),
        target_persen: Number(form.target_persen),
      })
      setInfo(res.data)
      pushToast('Aturan penilaian tersimpan. Jalankan ulang kalkulasi agar status nilai yang sudah ada ikut diperbarui.')
      onSaved?.()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan aturan'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!form) {
    return (
      <SectionCard title="Ambang & Target">
        <Loader2 className="h-4 w-4 animate-spin text-[#64748B]" />
      </SectionCard>
    )
  }
  const ubah = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <SectionCard
      title="Ambang & Target"
      description="Dipakai kalkulasi nilai (status tercapai/lulus), Analitik OBE, dan Portofolio (sheet Evaluasi & REMIDI)."
      action={info?.tersimpan ? <Badge tone="success">Sudah diatur</Badge> : <Badge tone="warning">Masih nilai bawaan</Badge>}
    >
      <form onSubmit={simpan} className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1">
          <span className={label}>Ambang tercapai / lulus (0–100)</span>
          <input type="number" step="0.01" min={0} max={100} required className={input} value={form.ambang} onChange={ubah('ambang')} />
          <span className="block text-xs text-[#64748B]">CPMK ≥ ambang dianggap tercapai; nilai akhir &lt; ambang = tidak lulus.</span>
        </label>
        <label className="space-y-1">
          <span className={label}>Target rerata skor rubrik (1–{info?.skala_maks || 4})</span>
          <input type="number" step="0.01" min={0.01} max={info?.skala_maks || 4} required className={input} value={form.target_rerata_skala} onChange={ubah('target_rerata_skala')} />
        </label>
        <label className="space-y-1">
          <span className={label}>Target % mahasiswa ≥ ambang</span>
          <input type="number" step="0.01" min={0} max={100} required className={input} value={form.target_persen} onChange={ubah('target_persen')} />
          <span className="block text-xs text-[#64748B]">CPMK "Memenuhi" bila kedua target tercapai.</span>
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className={label}>Nama Ketua GPM (untuk cover portofolio)</span>
          <input className={input} value={form.gpm_nama} onChange={ubah('gpm_nama')} maxLength={255} />
        </label>
        <label className="space-y-1">
          <span className={label}>NIP Ketua GPM</span>
          <input className={input} value={form.gpm_nip} onChange={ubah('gpm_nip')} maxLength={100} />
        </label>
        <div className="md:col-span-3">
          <ActionButton type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
          </ActionButton>
        </div>
      </form>
    </SectionCard>
  )
}

// --- Rubrik skala capaian (Range Nilai CPL) -------------------------------------

function RubrikSkala({ prodiId, pushToast }) {
  const [rows, setRows] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!prodiId) return
    api
      .get(`/prodi/${prodiId}/range-nilai-cpl`)
      .then((res) => {
        const data = (res.data || []).map((r) => ({ nama: r.nama, batas_bawah: r.batas_bawah, batas_atas: r.batas_atas }))
        setRows(data.sort((a, b) => a.batas_bawah - b.batas_bawah))
      })
      .catch((err) => pushToast(getApiErrorMessage(err, 'Gagal memuat rubrik'), 'error'))
  }, [prodiId, pushToast])

  const ubah = (i, key, value) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: value } : r)))

  const simpan = async () => {
    setSaving(true)
    try {
      const res = await api.post(`/prodi/${prodiId}/range-nilai-cpl`, {
        ranges: rows.map((r) => ({ ...r, nama: r.nama.trim(), batas_bawah: Number(r.batas_bawah), batas_atas: Number(r.batas_atas) })),
      })
      setRows((res.data || []).map((r) => ({ nama: r.nama, batas_bawah: r.batas_bawah, batas_atas: r.batas_atas })).sort((a, b) => a.batas_bawah - b.batas_bawah))
      pushToast('Rubrik skala tersimpan')
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan rubrik'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      title="Rubrik Skala Capaian"
      description="Mengubah nilai 0–100 menjadi skor 1, 2, 3, … (urut dari batas terendah). Dipakai rerata skor di Evaluasi CPMK dan grafik portofolio."
      action={
        <div className="flex gap-2">
          {rows && rows.length === 0 ? (
            <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setRows(RUBRIK_CONTOH)}>
              Pakai contoh OBELISK
            </ActionButton>
          ) : null}
          <ActionButton className="px-3 py-1.5 text-xs" onClick={simpan} disabled={saving || !rows?.length}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan
          </ActionButton>
        </div>
      }
    >
      {!rows ? (
        <Loader2 className="h-4 w-4 animate-spin text-[#64748B]" />
      ) : (
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-[#64748B]">
              Belum diatur. Sistem memakai rubrik bawaan: Pemula (&lt;60), Berkembang (60–70), Mahir (70–80), Teladan (≥80).
            </p>
          ) : (
            <table className="w-full max-w-2xl text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">
                  <th className="w-14 py-2">Skor</th>
                  <th className="py-2 pr-2">Tingkat</th>
                  <th className="w-32 py-2 pr-2">Batas bawah</th>
                  <th className="w-32 py-2 pr-2">Batas atas</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1 font-semibold">{i + 1}</td>
                    <td className="py-1 pr-2"><input className={input} value={r.nama} onChange={(e) => ubah(i, 'nama', e.target.value)} aria-label="Nama tingkat" /></td>
                    <td className="py-1 pr-2"><input type="number" step="0.01" className={input} value={r.batas_bawah} onChange={(e) => ubah(i, 'batas_bawah', e.target.value)} aria-label="Batas bawah" /></td>
                    <td className="py-1 pr-2"><input type="number" step="0.01" className={input} value={r.batas_atas} onChange={(e) => ubah(i, 'batas_atas', e.target.value)} aria-label="Batas atas" /></td>
                    <td className="py-1">
                      <button type="button" onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))} className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Hapus tingkat">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ActionButton variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setRows((prev) => [...(prev || []), { nama: '', batas_bawah: '', batas_atas: '' }])}>
            <Plus className="h-3.5 w-3.5" /> Tambah tingkat
          </ActionButton>
        </div>
      )}
    </SectionCard>
  )
}

// --- Skala nilai huruf per angkatan ---------------------------------------------

function SkalaHuruf({ pushToast }) {
  const [versi, setVersi] = useState([])
  const [versiId, setVersiId] = useState('')
  const [kelompok, setKelompok] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchKurikulumVersions()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : []
        setVersi(list)
        if (list.length) setVersiId(String(list[list.length - 1].id))
      })
      .catch((err) => pushToast(getApiErrorMessage(err, 'Gagal memuat kurikulum'), 'error'))
  }, [pushToast])

  useEffect(() => {
    if (!versiId) return
    setKelompok(null)
    api
      .get(`/kurikulum/versions/${versiId}/skala-nilai`)
      .then((res) =>
        setKelompok(
          (res.data?.kelompok || []).map((k) => ({
            angkatan_min: k.angkatan_min ?? '',
            angkatan_max: k.angkatan_max ?? '',
            skala: k.skala.map((s) => ({ huruf: s.huruf, batas_min: Number(s.batas_min) })),
          })),
        ),
      )
      .catch((err) => pushToast(getApiErrorMessage(err, 'Gagal memuat skala nilai'), 'error'))
  }, [versiId, pushToast])

  const ubahKelompok = (i, patch) => setKelompok((prev) => prev.map((k, j) => (j === i ? { ...k, ...patch } : k)))
  const ubahSkala = (i, s, key, value) =>
    ubahKelompok(i, { skala: kelompok[i].skala.map((row, j) => (j === s ? { ...row, [key]: value } : row)) })

  const simpan = async () => {
    setSaving(true)
    try {
      const res = await api.post(`/kurikulum/versions/${versiId}/skala-nilai`, {
        kelompok: kelompok.map((k) => ({
          angkatan_min: k.angkatan_min === '' ? null : Number(k.angkatan_min),
          angkatan_max: k.angkatan_max === '' ? null : Number(k.angkatan_max),
          skala: k.skala.map((s) => ({ huruf: String(s.huruf).trim(), batas_min: Number(s.batas_min) })),
        })),
      })
      setKelompok(
        (res.data?.kelompok || []).map((k) => ({
          angkatan_min: k.angkatan_min ?? '',
          angkatan_max: k.angkatan_max ?? '',
          skala: k.skala.map((s) => ({ huruf: s.huruf, batas_min: Number(s.batas_min) })),
        })),
      )
      pushToast('Skala nilai huruf tersimpan. Nilai yang sudah final tidak berubah; jalankan ulang kalkulasi untuk nilai lain.')
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan skala'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      title="Skala Nilai Huruf"
      description="Konversi nilai akhir ke huruf per versi kurikulum. Buat beberapa kelompok bila skala berbeda menurut angkatan; kelompok tanpa angkatan menjadi skala bawaan."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <select value={versiId} onChange={(e) => setVersiId(e.target.value)} aria-label="Versi kurikulum" className="h-9 rounded-[6px] border border-[#CBD5E1] bg-white px-2 text-xs">
            {versi.map((v) => (
              <option key={v.id} value={v.id}>{v.version_label}</option>
            ))}
          </select>
          <ActionButton className="px-3 py-1.5 text-xs" onClick={simpan} disabled={saving || !kelompok?.length}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan
          </ActionButton>
        </div>
      }
    >
      {!versiId ? (
        <p className="text-sm text-[#64748B]">Belum ada versi kurikulum.</p>
      ) : !kelompok ? (
        <Loader2 className="h-4 w-4 animate-spin text-[#64748B]" />
      ) : (
        <div className="space-y-4">
          {kelompok.length === 0 ? <p className="text-sm text-amber-700">Skala huruf kurikulum ini belum diatur, sehingga nilai huruf tidak bisa dihitung.</p> : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {kelompok.map((k, i) => (
              <div key={i} className="rounded-[6px] border border-[#E2E8F0] p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-[#142B4A]">{labelKelompok(k)}</span>
                  <button type="button" onClick={() => setKelompok((prev) => prev.filter((_, j) => j !== i))} className="rounded p-1 text-red-600 hover:bg-red-50" aria-label="Hapus kelompok">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] text-[#64748B]">Dari angkatan (kosong = semua sebelumnya)</span>
                    <input type="number" className={input} value={k.angkatan_min} onChange={(e) => ubahKelompok(i, { angkatan_min: e.target.value })} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-[#64748B]">Sampai angkatan (kosong = semua sesudahnya)</span>
                    <input type="number" className={input} value={k.angkatan_max} onChange={(e) => ubahKelompok(i, { angkatan_max: e.target.value })} />
                  </label>
                </div>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">
                      <th className="py-1 pr-2">Huruf</th>
                      <th className="py-1 pr-2">Batas minimal</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {k.skala.map((s, j) => (
                      <tr key={j}>
                        <td className="py-1 pr-2"><input className={input} value={s.huruf} maxLength={10} onChange={(e) => ubahSkala(i, j, 'huruf', e.target.value)} aria-label="Huruf" /></td>
                        <td className="py-1 pr-2"><input type="number" step="0.01" className={input} value={s.batas_min} onChange={(e) => ubahSkala(i, j, 'batas_min', e.target.value)} aria-label="Batas minimal" /></td>
                        <td className="py-1">
                          <button type="button" onClick={() => ubahKelompok(i, { skala: k.skala.filter((_, x) => x !== j) })} className="rounded p-1 text-red-600 hover:bg-red-50" aria-label="Hapus huruf">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={() => ubahKelompok(i, { skala: [...k.skala, { huruf: '', batas_min: '' }] })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1A3A6B] hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Tambah huruf
                </button>
              </div>
            ))}
          </div>
          <ActionButton
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            onClick={() => setKelompok((prev) => [...prev, { angkatan_min: '', angkatan_max: '', skala: SKALA_CONTOH.map((s) => ({ ...s })) }])}
          >
            <Plus className="h-3.5 w-3.5" /> Tambah kelompok angkatan
          </ActionButton>
        </div>
      )}
    </SectionCard>
  )
}

export default function AturanPenilaianPage() {
  const { user } = useAuth()
  const { toasts, pushToast } = useToast()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pengaturan Prodi"
        title="Aturan Penilaian"
        description="Ambang ketercapaian, target evaluasi CPMK, rubrik skala capaian, dan konversi nilai huruf yang dipakai seluruh perhitungan OBE di prodi ini."
      />
      <AturanUmum pushToast={pushToast} />
      <RubrikSkala prodiId={user?.program_studi_id} pushToast={pushToast} />
      <SkalaHuruf pushToast={pushToast} />
      <ToastContainer toasts={toasts} />
    </div>
  )
}
