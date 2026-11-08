import { useEffect, useState, useRef } from 'react'
import { getApiErrorMessage } from '../pages/superAdminHelpers'
import { ChevronDown, ChevronUp, Download, Loader2, Pencil, Plus, Printer, RefreshCw, Trash2, X } from 'lucide-react'
import { ActionButton, Badge, SectionCard } from './PageChrome'
import ConfirmDialog from './ConfirmDialog'
import useToast from '../hooks/useToast'
import api from '../services/api'
import { downloadRpsWord, parseRpsKonten, printRps } from '../utils/rpsExport'

function formatTanggal(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

const label = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]'
const input =
  'w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2 py-1.5 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none'

function RpsDetail({ rps }) {
  const data = parseRpsKonten(rps.konten)

  if (!data) {
    return <p className="text-sm text-[#64748B]">Konten RPS kosong atau formatnya tidak dikenali.</p>
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
          <p className={label}>Kode Mata Kuliah</p>
          <p className="mt-1 text-sm font-semibold text-[#142B4A]">{data.kode_mk || '-'}</p>
        </div>
        <div>
          <p className={label}>Total Bobot</p>
          <p className={`mt-1 text-sm font-semibold ${totalBobot === 100 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {totalBobot}
            {totalBobot !== 100 ? ' (seharusnya 100)' : ''}
          </p>
        </div>
      </div>

      <div>
        <p className={label}>Deskripsi Mata Kuliah</p>
        <p className="mt-1 text-sm leading-relaxed text-[#142B4A]">{data.deskripsi_mk || '-'}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {[['CPL', cpl], ['CPMK', cpmk]].map(([judul, list]) => (
          <div key={judul}>
            <p className={label}>{judul} ({list.length})</p>
            <ul className="mt-2 space-y-2">
              {list.map((c, i) => (
                <li key={`${c.kode}-${i}`} className="text-sm text-[#142B4A]">
                  <span className="font-semibold">{c.kode}</span> — {c.deskripsi}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div>
        <p className={label}>Rencana Pembelajaran ({pertemuan.length} pertemuan)</p>
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
                  <td className="whitespace-nowrap px-3 py-2">{p.cpmk ?? '-'}</td>
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
          <p className={label}>Sumber Dokumen Referensi (RAG)</p>
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

// Editor draf RPS: semua isi hasil AI bisa diubah sebelum disimpan.
function RpsEditor({ rps, onCancel, onSaved }) {
  const { pushToast } = useToast()
  const awal = parseRpsKonten(rps.konten) || {}
  const [meta, setMeta] = useState({ tahun_ajaran: rps.tahun_ajaran || '', semester: rps.semester || 'Ganjil' })
  const [konten, setKonten] = useState({
    kode_mk: awal.kode_mk || '',
    deskripsi_mk: awal.deskripsi_mk || '',
    cpl: Array.isArray(awal.cpl) ? awal.cpl.map((c) => ({ ...c })) : [],
    cpmk: Array.isArray(awal.cpmk) ? awal.cpmk.map((c) => ({ ...c })) : [],
    pertemuan: Array.isArray(awal.pertemuan) ? awal.pertemuan.map((p) => ({ ...p })) : [],
  })
  const [saving, setSaving] = useState(false)

  const ubahItem = (key, index, field, value) =>
    setKonten((k) => ({ ...k, [key]: k[key].map((item, i) => (i === index ? { ...item, [field]: value } : item)) }))
  const hapusItem = (key, index) => setKonten((k) => ({ ...k, [key]: k[key].filter((_, i) => i !== index) }))
  const tambahItem = (key, item) => setKonten((k) => ({ ...k, [key]: [...k[key], item] }))

  const totalBobot = konten.pertemuan.reduce((s, p) => s + (Number(p.bobot) || 0), 0)

  const simpan = async () => {
    setSaving(true)
    try {
      const payload = {
        ...awal,
        ...konten,
        pertemuan: konten.pertemuan.map((p) => ({ ...p, minggu: Number(p.minggu) || 0, bobot: Number(p.bobot) || 0 })),
      }
      const res = await api.put(`/rps/${rps.id}`, { konten: payload, ...meta })
      pushToast('Perubahan RPS berhasil disimpan')
      onSaved(res.data)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan RPS'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const DaftarCapaian = ({ judul, keyName }) => (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className={label}>{judul}</p>
        <button
          type="button"
          onClick={() => tambahItem(keyName, { kode: '', deskripsi: '' })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A3A6B] hover:text-[#F4A300]"
        >
          <Plus className="h-3.5 w-3.5" /> Tambah
        </button>
      </div>
      <div className="space-y-2">
        {konten[keyName].map((c, i) => (
          <div key={i} className="flex gap-2">
            <input aria-label={`Kode ${judul}`} className={`${input} w-28 shrink-0`} value={c.kode} onChange={(e) => ubahItem(keyName, i, 'kode', e.target.value)} />
            <input aria-label={`Deskripsi ${judul}`} className={input} value={c.deskripsi} onChange={(e) => ubahItem(keyName, i, 'deskripsi', e.target.value)} />
            <button type="button" aria-label={`Hapus ${judul}`} onClick={() => hapusItem(keyName, i)} className="text-[#94A3B8] hover:text-[#EF4444]">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-5" data-testid={`rps-editor-${rps.id}`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={label}>Kode Mata Kuliah</span>
          <input className={`${input} mt-1`} value={konten.kode_mk} onChange={(e) => setKonten({ ...konten, kode_mk: e.target.value })} />
        </label>
        <label className="block">
          <span className={label}>Tahun Ajaran</span>
          <input className={`${input} mt-1`} value={meta.tahun_ajaran} onChange={(e) => setMeta({ ...meta, tahun_ajaran: e.target.value })} />
        </label>
        <label className="block">
          <span className={label}>Semester</span>
          <select className={`${input} mt-1`} value={meta.semester} onChange={(e) => setMeta({ ...meta, semester: e.target.value })}>
            <option value="Ganjil">Ganjil</option>
            <option value="Genap">Genap</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className={label}>Deskripsi Mata Kuliah</span>
        <textarea rows={3} className={`${input} mt-1`} value={konten.deskripsi_mk} onChange={(e) => setKonten({ ...konten, deskripsi_mk: e.target.value })} />
      </label>

      <div className="grid gap-5 lg:grid-cols-2">
        {DaftarCapaian({ judul: 'CPL', keyName: 'cpl' })}
        {DaftarCapaian({ judul: 'CPMK', keyName: 'cpmk' })}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className={label}>
            Rencana Pembelajaran · Total bobot{' '}
            <span className={totalBobot === 100 ? 'text-[#10B981]' : 'text-[#EF4444]'}>{totalBobot}</span>
            {totalBobot !== 100 ? ' (seharusnya 100)' : ''}
          </p>
          <button
            type="button"
            onClick={() =>
              tambahItem('pertemuan', {
                minggu: (Math.max(0, ...konten.pertemuan.map((p) => Number(p.minggu) || 0)) + 1),
                cpmk: '', sub_cpmk: '', materi: '', metode: '', bobot: 0,
              })
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A3A6B] hover:text-[#F4A300]"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah pertemuan
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-[#E2E8F0]">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] uppercase text-[#64748B]">
              <tr>
                <th className="px-2 py-2 font-semibold">Mg</th>
                <th className="px-2 py-2 font-semibold">CPMK</th>
                <th className="px-2 py-2 font-semibold">Sub-CPMK</th>
                <th className="px-2 py-2 font-semibold">Materi</th>
                <th className="px-2 py-2 font-semibold">Metode</th>
                <th className="px-2 py-2 font-semibold">Bobot</th>
                <th className="px-2 py-2" aria-label="Aksi" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {konten.pertemuan.map((p, i) => (
                <tr key={i} className="align-top">
                  <td className="px-2 py-1.5"><input aria-label="Minggu" type="number" className={`${input} w-14`} value={p.minggu} onChange={(e) => ubahItem('pertemuan', i, 'minggu', e.target.value)} /></td>
                  <td className="px-2 py-1.5"><input aria-label="CPMK" className={`${input} w-24`} value={p.cpmk} onChange={(e) => ubahItem('pertemuan', i, 'cpmk', e.target.value)} /></td>
                  <td className="px-2 py-1.5"><textarea aria-label="Sub-CPMK" rows={2} className={`${input} min-w-[160px]`} value={p.sub_cpmk} onChange={(e) => ubahItem('pertemuan', i, 'sub_cpmk', e.target.value)} /></td>
                  <td className="px-2 py-1.5"><textarea aria-label="Materi" rows={2} className={`${input} min-w-[160px]`} value={p.materi} onChange={(e) => ubahItem('pertemuan', i, 'materi', e.target.value)} /></td>
                  <td className="px-2 py-1.5"><textarea aria-label="Metode" rows={2} className={`${input} min-w-[120px]`} value={p.metode} onChange={(e) => ubahItem('pertemuan', i, 'metode', e.target.value)} /></td>
                  <td className="px-2 py-1.5"><input aria-label="Bobot" type="number" className={`${input} w-16`} value={p.bobot} onChange={(e) => ubahItem('pertemuan', i, 'bobot', e.target.value)} /></td>
                  <td className="px-2 py-1.5">
                    <button type="button" aria-label="Hapus pertemuan" onClick={() => hapusItem('pertemuan', i)} className="text-[#94A3B8] hover:text-[#EF4444]">
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <ActionButton variant="secondary" onClick={onCancel} disabled={saving}>Batal</ActionButton>
        <ActionButton onClick={simpan} disabled={saving} data-testid={`rps-simpan-${rps.id}`}>
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </ActionButton>
      </div>
    </div>
  )
}

export default function RpsList({ mataKuliahId, mataKuliah = null, refreshKey = 0 }) {
  const { pushToast } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [hapusTarget, setHapusTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    if (!mataKuliahId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/rps/${mataKuliahId}`)
      const list = Array.isArray(res.data) ? res.data : []
      setItems(list)
      setEditId(null)
      // Buka otomatis draf terbaru (urutan dari backend: id terbesar dulu).
      setOpenId(list.length > 0 ? list[0].id : null)
    } catch (err) {
      console.warn('Gagal memuat daftar RPS:', err)
      setError(!err.response
        ? 'Server error (kemungkinan error 500 di backend). Periksa log backend.'
        : getApiErrorMessage(err, 'Gagal memuat daftar draf RPS.'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const prevMkIdRef = useRef(null)
  const prevRefreshKeyRef = useRef(null)

  useEffect(() => {
    if (!mataKuliahId) return
    if (prevMkIdRef.current === mataKuliahId && prevRefreshKeyRef.current === refreshKey) return
    prevMkIdRef.current = mataKuliahId
    prevRefreshKeyRef.current = refreshKey
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mataKuliahId, refreshKey])

  const hapus = async () => {
    if (!hapusTarget) return
    setDeleting(true)
    try {
      await api.delete(`/rps/${hapusTarget.id}`)
      setItems((list) => list.filter((r) => r.id !== hapusTarget.id))
      pushToast('Draf RPS dihapus')
      setHapusTarget(null)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menghapus RPS'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const cetak = (rps) => {
    if (!printRps(rps, mataKuliah)) {
      pushToast('Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini.', 'warning')
    }
  }

  return (
    <SectionCard
      title="Draf RPS"
      description="Draf Rencana Pembelajaran Semester hasil Generate RPS. Bisa diedit, dihapus, diunduh sebagai Word, atau dicetak/disimpan sebagai PDF."
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
        <p className="text-sm text-[#64748B]">Belum ada draf RPS. Klik “Generate RPS” untuk membuatnya.</p>
      ) : (
        <div className="space-y-3">
          {items.map((rps, index) => {
            const isOpen = openId === rps.id
            const isEditing = editId === rps.id
            return (
              <div key={rps.id} className="rounded-md border border-[#E2E8F0]">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : rps.id)}
                    aria-expanded={isOpen}
                    className="flex flex-1 flex-wrap items-center gap-2 text-left"
                  >
                    {isOpen ? <ChevronUp className="h-4 w-4 text-[#64748B]" /> : <ChevronDown className="h-4 w-4 text-[#64748B]" />}
                    <span className="text-sm font-semibold text-[#142B4A]">
                      Versi {items.length - index} · {rps.tahun_ajaran} · {rps.semester}
                    </span>
                    <Badge tone="default">{rps.status}</Badge>
                    <span className="text-xs text-[#64748B]">
                      {formatTanggal(rps.updated_at || rps.created_at)}
                    </span>
                  </button>
                  {!isEditing && (
                    <div className="flex flex-wrap gap-1.5">
                      <ActionButton
                        variant="secondary"
                        onClick={() => { setOpenId(rps.id); setEditId(rps.id) }}
                        data-testid={`rps-edit-${rps.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </ActionButton>
                      <ActionButton variant="secondary" onClick={() => downloadRpsWord(rps, mataKuliah)} data-testid={`rps-word-${rps.id}`}>
                        <Download className="h-3.5 w-3.5" /> Word
                      </ActionButton>
                      <ActionButton variant="secondary" onClick={() => cetak(rps)} data-testid={`rps-pdf-${rps.id}`}>
                        <Printer className="h-3.5 w-3.5" /> Cetak / PDF
                      </ActionButton>
                      <ActionButton variant="secondary" onClick={() => setHapusTarget(rps)} data-testid={`rps-hapus-${rps.id}`}>
                        <Trash2 className="h-3.5 w-3.5 text-[#EF4444]" /> Hapus
                      </ActionButton>
                    </div>
                  )}
                </div>
                {isOpen && (
                  <div className="border-t border-[#E2E8F0] px-4 py-4">
                    {isEditing ? (
                      <RpsEditor
                        rps={rps}
                        onCancel={() => setEditId(null)}
                        onSaved={(baru) => {
                          setItems((list) => list.map((r) => (r.id === baru.id ? baru : r)))
                          setEditId(null)
                        }}
                      />
                    ) : (
                      <RpsDetail rps={rps} />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(hapusTarget)}
        title="Hapus Draf RPS"
        message={hapusTarget ? `Hapus draf RPS ${hapusTarget.tahun_ajaran} ${hapusTarget.semester}? Tindakan ini tidak bisa dibatalkan.` : ''}
        onConfirm={hapus}
        onCancel={() => setHapusTarget(null)}
        loading={deleting}
        confirmTestId="rps-hapus-konfirmasi"
      />
    </SectionCard>
  )
}
