import { useEffect, useMemo, useState, useRef } from 'react'
import { getApiErrorMessage } from '../pages/superAdminHelpers'
import { ChevronDown, ChevronUp, Download, Loader2, Pencil, Printer, RefreshCw, Trash2 } from 'lucide-react'
import { ActionButton, Badge, SectionCard } from './PageChrome'
import ConfirmDialog from './ConfirmDialog'
import useToast from '../hooks/useToast'
import api from '../services/api'
import { buildRpsHtml, downloadRpsWord, normalisasiRps, parseRpsKonten, printRps, totalBobotPenilaian } from '../utils/rpsExport'
import RpsDocEditor from './rps/RpsDocEditor'

function formatTanggal(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

const label = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]'
function RpsDetail({ rps, identitas }) {
  const data = normalisasiRps(rps.konten)
  const sumber = Array.isArray(rps.sumber_dokumen_rag) ? rps.sumber_dokumen_rag : []
  const total = totalBobotPenilaian(data)
  const lamaFormat = parseRpsKonten(rps.konten)?.format !== 2
  const html = useMemo(() => buildRpsHtml(rps, identitas, { mode: 'preview' }), [rps, identitas])

  if (!parseRpsKonten(rps.konten)) {
    return <p className="text-sm text-[#64748B]">Konten RPS kosong atau formatnya tidak dikenali.</p>
  }

  return (
    <div className="space-y-4">
      {lamaFormat && (
        <p className="rounded-[6px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Draf ini dibuat dengan format RPS lama, sehingga Tabel Penilaian, pengalaman belajar, dan kriteria masih
          kosong. Lengkapi lewat Edit atau buat ulang dengan Generate RPS.
        </p>
      )}
      {data.penilaian.length > 0 && total !== 100 && (
        <p className="rounded-[6px] border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          Total bobot Tabel Penilaian {total}%, seharusnya 100%.
        </p>
      )}
      <iframe
        title={`Pratinjau RPS ${rps.tahun_ajaran} ${rps.semester}`}
        srcDoc={html}
        className="h-[640px] w-full rounded-md border border-[#E2E8F0] bg-[#E2E8F0]"
        data-testid={`rps-preview-${rps.id}`}
      />
      <p className="text-[11px] text-[#94A3B8]">
        Pratinjau sama dengan hasil unduhan Word dan Cetak/PDF. Logo universitas tampil di file unduhan bila
        file <code>logo-universitas.png</code> sudah tersedia.
      </p>

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

// sorotId: id draf yang baru dibuat; setelah daftar dimuat, draf itu dibuka, di-scroll
// ke tampilan, dan diberi sorotan amber yang memudar.
export default function RpsList({ mataKuliahId, mataKuliah = null, refreshKey = 0, sorotId = null }) {
  const { pushToast } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [hapusTarget, setHapusTarget] = useState(null)
  const [disorot, setDisorot] = useState(null)
  const [deleting, setDeleting] = useState(false)
  // Identitas kepala dokumen (fakultas, prodi, dosen pengampu) dari data SADEWA
  const [identitasApi, setIdentitasApi] = useState(null)
  const identitas = identitasApi || (mataKuliah
    ? { kode: mataKuliah.kode, nama: mataKuliah.nama, sks: mataKuliah.sks, program_studi: '', fakultas: '', dosen: [] }
    : null)

  useEffect(() => {
    if (!mataKuliahId) return undefined
    let aktif = true
    setIdentitasApi(null)
    api
      .get(`/rps/identitas/${mataKuliahId}`)
      .then((res) => aktif && setIdentitasApi(res.data))
      .catch((err) => console.warn('Gagal memuat identitas dokumen RPS:', err))
    return () => {
      aktif = false
    }
  }, [mataKuliahId])

  const load = async () => {
    if (!mataKuliahId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/rps/${mataKuliahId}`)
      const list = Array.isArray(res.data) ? res.data : []
      setItems(list)
      setEditId(null)
      // Buka draf yang baru dibuat bila ada, selain itu draf terbaru (backend: id terbesar dulu).
      const baru = sorotId != null && list.find((r) => r.id === sorotId)
      setOpenId(baru ? baru.id : list.length > 0 ? list[0].id : null)
      if (baru) {
        setDisorot(baru.id)
        requestAnimationFrame(() => {
          const kurangiGerak = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          document.getElementById(`rps-item-${baru.id}`)?.scrollIntoView({ behavior: kurangiGerak ? 'auto' : 'smooth', block: 'start' })
        })
      }
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
    if (!printRps(rps, identitas)) {
      pushToast('Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini.', 'warning')
    }
  }

  return (
    <SectionCard
      title="Draf RPS"
      description="Draf Kontrak Kuliah dan Rencana Pembelajaran Semester hasil Generate RPS. Bisa diedit, dihapus, diunduh sebagai Word, atau dicetak/disimpan sebagai PDF."
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
              <div
                key={rps.id}
                id={`rps-item-${rps.id}`}
                className={`scroll-mt-24 rounded-md border border-[#E2E8F0] ${disorot === rps.id ? 'ai-sorot animate-sorot-pudar' : ''}`}
              >
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
                      <ActionButton variant="secondary" onClick={() => downloadRpsWord(rps, identitas)} data-testid={`rps-word-${rps.id}`}>
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
                      <RpsDocEditor
                        rps={rps}
                        identitas={identitas}
                        onCancel={() => setEditId(null)}
                        onSaved={(baru) => {
                          setItems((list) => list.map((r) => (r.id === baru.id ? baru : r)))
                          setEditId(null)
                        }}
                      />
                    ) : (
                      <RpsDetail rps={rps} identitas={identitas} />
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
