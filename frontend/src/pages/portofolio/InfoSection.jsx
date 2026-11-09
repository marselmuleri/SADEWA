import { useCallback, useEffect, useState } from 'react'
import { History, Loader2, Save } from 'lucide-react'
import { ActionButton, SectionCard } from '../../components/PageChrome'
import api from '../../services/api'
import { getApiErrorMessage } from '../superAdminHelpers'
import { formatTanggal } from './portofolioShared'

const KOSONG = {
  no_dokumen: '', revisi: '', tanggal_terbit: '', prasyarat: '',
  manfaat: '', deskripsi: '', strategi: '', tata_tertib: '', waktu_tempat: '', referensi: '',
}

const FIELD_DOKUMEN = [
  { key: 'no_dokumen', label: 'No. Dokumen', placeholder: 'mis. PFM/S1.KOM-FT-UNDIP/6243' },
  { key: 'revisi', label: 'Revisi ke-', placeholder: 'mis. 02' },
  { key: 'tanggal_terbit', label: 'Tanggal Terbit', type: 'date' },
  { key: 'prasyarat', label: 'Mata Kuliah Prasyarat', placeholder: 'Kosongkan bila tidak ada' },
]

const FIELD_KONTRAK = [
  { key: 'manfaat', label: '1. Manfaat Perkuliahan' },
  { key: 'deskripsi', label: '2. Deskripsi Perkuliahan', hint: 'Kosong = memakai deskripsi dari draf RPS (AI).' },
  { key: 'strategi', label: '3. Strategi Perkuliahan', placeholder: 'mis. ceramah, diskusi kelompok, studi kasus, kuis, self learning' },
  { key: 'tata_tertib', label: '4. Tata Tertib' },
  { key: 'waktu_tempat', label: 'Waktu & Tempat Kuliah' },
  { key: 'referensi', label: 'Bahan Bacaan / Referensi' },
]

const input =
  'w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 py-2 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none'

function isiForm(data) {
  const hasil = { ...KOSONG }
  for (const k of Object.keys(KOSONG)) hasil[k] = data?.[k] ?? ''
  return hasil
}

export default function InfoSection({ mkId, canWrite, pushToast }) {
  const [res, setRes] = useState(null)
  const [form, setForm] = useState(KOSONG)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const terapkan = (data) => {
    setRes(data)
    setForm(isiForm(data.data))
    setDirty(false)
  }

  const muat = useCallback(async () => {
    setError(null)
    try {
      const r = await api.get(`/portofolio/${mkId}/info`)
      terapkan(r.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat data portofolio'))
    }
  }, [mkId])

  useEffect(() => {
    muat()
  }, [muat])

  const ubah = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setDirty(true)
  }

  const pakaiSaran = () => {
    setForm((f) => ({ ...isiForm(res.saran), no_dokumen: f.no_dokumen, revisi: f.revisi, tanggal_terbit: f.tanggal_terbit }))
    setDirty(true)
  }

  const simpan = async () => {
    setSaving(true)
    try {
      const r = await api.put(`/portofolio/${mkId}/info`, { ...form, tanggal_terbit: form.tanggal_terbit || null })
      terapkan(r.data)
      pushToast('Data portofolio tersimpan')
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan data portofolio'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <SectionCard><p className="text-sm text-red-600">{error}</p></SectionCard>
  if (!res) {
    return (
      <SectionCard>
        <div className="flex items-center gap-2 text-sm text-[#64748B]"><Loader2 className="h-4 w-4 animate-spin" /> Memuat...</div>
      </SectionCard>
    )
  }

  const tampil = (key) => form[key] || <span className="text-[#94A3B8]">Belum diisi</span>

  return (
    <div className="space-y-6">
      {canWrite && res.saran && !res.data ? (
        <div className="flex flex-col gap-3 rounded-[6px] border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Ada isian dari <b>{res.saran_sumber}</b>. Gunakan sebagai awal, lalu sesuaikan (nomor dokumen tidak ikut disalin).
          </span>
          <ActionButton variant="secondary" className="shrink-0 px-3 py-1.5 text-xs" onClick={pakaiSaran}>
            <History className="h-3.5 w-3.5" /> Gunakan isian semester lalu
          </ActionButton>
        </div>
      ) : null}

      <SectionCard
        title="Identitas Dokumen (Cover)"
        description={`Ketua GPM: ${res.gpm_nama || 'belum diatur'}${res.gpm_nip ? ` (NIP ${res.gpm_nip})` : ''} — diatur Admin Prodi di menu Aturan Penilaian.`}
        action={
          canWrite ? (
            <ActionButton className="px-3 py-1.5 text-xs" onClick={simpan} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan
            </ActionButton>
          ) : null
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {FIELD_DOKUMEN.map((f) => (
            <label key={f.key} className="space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">{f.label}</span>
              {canWrite ? (
                <input type={f.type || 'text'} className={input} value={form[f.key]} placeholder={f.placeholder} onChange={ubah(f.key)} />
              ) : (
                <p className="text-sm">{tampil(f.key)}</p>
              )}
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Kontrak Perkuliahan"
        description={res.updated_at ? `Terakhir disimpan ${formatTanggal(res.updated_at)}. Masuk ke sheet KONTRAK saat export Excel.` : 'Masuk ke sheet KONTRAK saat export Excel.'}
      >
        <div className="space-y-4">
          {dirty && canWrite ? <p className="text-xs font-medium text-amber-700">Ada perubahan yang belum disimpan.</p> : null}
          {FIELD_KONTRAK.map((f) => (
            <label key={f.key} className="block space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">{f.label}</span>
              {canWrite ? (
                <textarea rows={3} className={input} value={form[f.key]} placeholder={f.placeholder} onChange={ubah(f.key)} />
              ) : (
                <p className="whitespace-pre-line text-sm">{tampil(f.key)}</p>
              )}
              {f.hint ? <span className="block text-xs text-[#64748B]">{f.hint}</span> : null}
            </label>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
