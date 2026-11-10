import { useEffect, useState } from 'react'
import { Info, Loader2 } from 'lucide-react'
import Modal from '../Modal'
import SearchableSelect from '../SearchableSelect'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import { getApiErrorMessage } from '../../pages/superAdminHelpers'
import { TAXONOMY_OPTIONS } from './cpmkData'

const inputClass =
  'w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]'
const labelClass = 'mb-1 block text-sm font-semibold text-[#142B4A]'

/**
 * Form tambah / edit CPMK.
 * - cpmk: CPMK yang diedit (null = tambah baru)
 * - mataKuliahId: MK tujuan bila sudah pasti; bila kosong, pengguna memilih dari mkOptions
 * - mappingTotal: total bobot IK yang sudah dipetakan; bila ada, bobot dikunci karena
 *   backend mewajibkan bobot CPMK = total bobot IK (diatur lewat "Atur CPL & IK").
 */
export default function CpmkFormModal({
  open,
  onClose,
  onSaved,
  cpmk = null,
  mataKuliahId = null,
  mkOptions = [],
  suggestedKode = 'CPMK-01',
  mappingTotal = 0,
}) {
  const { pushToast } = useToast()
  const [mkId, setMkId] = useState('')
  const [kode, setKode] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [level, setLevel] = useState('C3')
  const [bobot, setBobot] = useState(20)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (cpmk) {
      setMkId(String(cpmk.mata_kuliah_id))
      setKode(cpmk.kode || '')
      setDeskripsi(cpmk.deskripsi || '')
      setLevel(cpmk.level_taksonomi || 'C3')
      setBobot(Number(cpmk.bobot) || 0)
    } else {
      setMkId(mataKuliahId ? String(mataKuliahId) : '')
      setKode(suggestedKode)
      setDeskripsi('')
      setLevel('C3')
      setBobot(20)
    }
  }, [open, cpmk, mataKuliahId, suggestedKode])

  const bobotLocked = Boolean(cpmk) && mappingTotal > 0
  const needsMkChoice = !cpmk && !mataKuliahId

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (needsMkChoice && !mkId) {
      setError('Pilih mata kuliah terlebih dahulu')
      return
    }
    const bobotNum = Number(bobot)
    if (!bobotLocked && (Number.isNaN(bobotNum) || bobotNum <= 0 || bobotNum > 100)) {
      setError('Bobot harus antara 0,1 sampai 100')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        kode: kode.trim(),
        deskripsi: deskripsi.trim(),
        level_taksonomi: level,
      }
      if (!bobotLocked) payload.bobot = bobotNum

      if (cpmk) {
        await api.put(`/cpmk/${cpmk.id}`, payload)
        pushToast(`CPMK ${payload.kode} berhasil diperbarui`)
      } else {
        await api.post('/cpmk', { ...payload, mata_kuliah_id: Number(mkId) })
        pushToast(`CPMK ${payload.kode} berhasil ditambahkan`)
      }
      onSaved?.()
      onClose()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal menyimpan CPMK')
      setError(msg)
      pushToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title={cpmk ? `Edit CPMK — ${cpmk.kode}` : 'Tambah Capaian Pembelajaran Mata Kuliah'}
      onClose={submitting ? () => {} : onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div role="alert" className="rounded-[6px] border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {needsMkChoice ? (
          <div>
            <label className={labelClass}>
              Mata Kuliah <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              value={mkId}
              onChange={(val) => setMkId(String(val))}
              placeholder="Pilih mata kuliah yang diampu"
              searchPlaceholder="Cari kode atau nama mata kuliah..."
              data-testid="select-cpmk-mk"
              aria-label="Mata kuliah"
              options={mkOptions.map((mk) => ({
                value: mk.id,
                label: `${mk.kode} - ${mk.nama}`,
                searchText: mk.nama,
              }))}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>
              Kode CPMK <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: CPMK-01"
              value={kode}
              onChange={(e) => setKode(e.target.value)}
              data-testid="input-cpmk-kode"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Bobot Penilaian (%) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              required={!bobotLocked}
              disabled={bobotLocked}
              value={bobot}
              onChange={(e) => setBobot(e.target.value)}
              data-testid="input-cpmk-bobot"
              className={`${inputClass} disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#64748B]`}
            />
          </div>
        </div>

        {bobotLocked ? (
          <p className="flex items-start gap-2 rounded-[6px] border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              CPMK ini sudah dipetakan ke IK dengan total bobot {mappingTotal}%. Bobot CPMK harus sama dengan total
              bobot IK, jadi ubah bobotnya lewat tombol <strong>Atur CPL &amp; IK</strong>.
            </span>
          </p>
        ) : null}

        <div>
          <label className={labelClass}>
            Level Taksonomi Bloom <span className="text-red-500">*</span>
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            data-testid="select-cpmk-level"
            className={inputClass}
          >
            {TAXONOMY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>
            Deskripsi CPMK <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={4}
            placeholder="Deskripsikan kemampuan akhir yang diharapkan dicapai mahasiswa pada mata kuliah ini..."
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            data-testid="input-cpmk-deskripsi"
            className={inputClass}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-[6px] border border-[#CBD5E1] px-4 py-2 text-sm font-semibold text-[#142B4A] hover:border-[#1A3A6B]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            data-testid="submit-cpmk-button"
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Simpan CPMK</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
