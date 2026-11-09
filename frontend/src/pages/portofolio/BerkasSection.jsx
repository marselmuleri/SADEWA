import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Eye, FileUp, Loader2, Trash2 } from 'lucide-react'
import { ActionButton, Badge, SectionCard } from '../../components/PageChrome'
import ConfirmDialog from '../../components/ConfirmDialog'
import api from '../../services/api'
import { getApiErrorMessage } from '../superAdminHelpers'
import { blobErrorMessage, bukaBerkas, formatBytes, formatTanggal, unduhBerkas } from './portofolioShared'

const KONFIG = {
  rps: {
    judul: 'Dokumen RPS',
    deskripsi: 'Unggah dokumen RPS resmi mata kuliah (PDF/Word). Versi terbaru ditampilkan paling atas.',
    accept: '.pdf,.doc,.docx',
    format: 'PDF, DOC, DOCX',
    placeholderJudul: 'mis. RPS Algoritma 2025/2026 Ganjil',
    kosong: 'Belum ada dokumen RPS yang diunggah.',
  },
  lampiran: {
    judul: 'Lampiran Portofolio',
    deskripsi: 'Bukti pendukung: soal UTS/UAS, rubrik, contoh jawaban mahasiswa, daftar hadir, berita acara, dll.',
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip,.txt,.csv',
    format: 'PDF, Office, gambar, ZIP, TXT, CSV',
    placeholderJudul: 'mis. Soal UTS',
    kosong: 'Belum ada lampiran yang diunggah.',
  },
}

const input =
  'w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none'

export default function BerkasSection({ mkId, jenis, canWrite, pushToast, onChanged }) {
  const cfg = KONFIG[jenis]
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [judul, setJudul] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [hapus, setHapus] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef(null)

  const muat = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/portofolio/${mkId}/berkas`, { params: { jenis } })
      setList(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat berkas'))
    } finally {
      setLoading(false)
    }
  }, [mkId, jenis])

  useEffect(() => {
    muat()
  }, [muat])

  const unggah = async (e) => {
    e.preventDefault()
    if (!file) {
      pushToast('Pilih file terlebih dahulu', 'error')
      return
    }
    const form = new FormData()
    form.append('jenis', jenis)
    form.append('judul', judul)
    form.append('keterangan', keterangan)
    form.append('file', file)
    setUploading(true)
    try {
      await api.post(`/portofolio/${mkId}/berkas`, form)
      pushToast('Berkas berhasil diunggah')
      setJudul('')
      setKeterangan('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await muat()
      onChanged?.()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal mengunggah berkas'), 'error')
    } finally {
      setUploading(false)
    }
  }

  const konfirmasiHapus = async () => {
    setDeleting(true)
    try {
      await api.delete(`/portofolio/berkas/${hapus.id}`)
      pushToast('Berkas dihapus')
      setHapus(null)
      await muat()
      onChanged?.()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menghapus berkas'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const aksiBerkas = async (fn, b) => {
    try {
      await fn(b)
    } catch (err) {
      pushToast(await blobErrorMessage(err, 'Gagal membuka berkas'), 'error')
    }
  }

  return (
    <div className="space-y-6">
      {canWrite ? (
        <SectionCard title={`Unggah ${jenis === 'rps' ? 'RPS' : 'Lampiran'}`} description={cfg.deskripsi}>
          <form onSubmit={unggah} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-[#142B4A]">Judul</span>
              <input className={input} value={judul} onChange={(e) => setJudul(e.target.value)} placeholder={cfg.placeholderJudul} maxLength={255} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-[#142B4A]">File</span>
              <input
                ref={fileRef}
                type="file"
                accept={cfg.accept}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-[#142B4A] file:mr-3 file:rounded-[6px] file:border-0 file:bg-[#1A3A6B] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                data-testid={`portofolio-file-${jenis}`}
              />
              <span className="block text-xs text-[#64748B]">Format: {cfg.format}. Maksimal 10 MB.</span>
            </label>
            <label className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium text-[#142B4A]">Keterangan (opsional)</span>
              <textarea className={input} rows={2} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
            </label>
            <div className="md:col-span-2">
              <ActionButton type="submit" disabled={uploading || !file}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                {uploading ? 'Mengunggah...' : 'Unggah'}
              </ActionButton>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title={cfg.judul} description={`${list.length} berkas`}>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-[#64748B]">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat berkas...
          </div>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#64748B]">{cfg.kosong}</p>
        ) : (
          <ul className="divide-y divide-[#EEF2F6]">
            {list.map((b, idx) => (
              <li key={b.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#142B4A]">{b.judul}</span>
                    {jenis === 'rps' && idx === 0 ? <Badge tone="success">Terbaru</Badge> : null}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[#64748B]">
                    {b.nama_file} · {formatBytes(b.ukuran)} · {formatTanggal(b.created_at)}
                    {b.uploader_nama ? ` · ${b.uploader_nama}` : ''}
                  </div>
                  {b.keterangan ? <p className="mt-1 text-xs text-[#142B4A]">{b.keterangan}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => aksiBerkas(bukaBerkas, b)}>
                    <Eye className="h-3.5 w-3.5" /> Lihat
                  </ActionButton>
                  <ActionButton variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => aksiBerkas(unduhBerkas, b)}>
                    <Download className="h-3.5 w-3.5" /> Unduh
                  </ActionButton>
                  {canWrite ? (
                    <ActionButton
                      variant="ghost"
                      className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50"
                      onClick={() => setHapus(b)}
                      aria-label={`Hapus ${b.judul}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <ConfirmDialog
        open={Boolean(hapus)}
        title="Hapus Berkas"
        message={`Hapus berkas "${hapus?.judul}"? File akan dihapus permanen dari server.`}
        loading={deleting}
        onCancel={() => setHapus(null)}
        onConfirm={konfirmasiHapus}
      />
    </div>
  )
}
