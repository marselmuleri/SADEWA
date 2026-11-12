import { useState, useEffect, useMemo } from 'react'
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { PageHeader, ActionButton } from '../../components/PageChrome'
import { TableActionHeader, TableActionCell, TableActionButton } from '../../components/TableActions'
import { getApiErrorMessage } from '../superAdminHelpers'

export default function JenisEvaluasiPage() {
  const { pushToast } = useToast()

  const [jenisList, setJenisList] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal Tambah / Edit
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingJenis, setEditingJenis] = useState(null)
  const [formNama, setFormNama] = useState('')
  const [formUrutan, setFormUrutan] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Dialog & Modal Contoh Standar
  const [isConfirmStandarOpen, setIsConfirmStandarOpen] = useState(false)
  const [standarLoading, setStandarLoading] = useState(false)
  const [standarResults, setStandarResults] = useState(null)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)

  // 1. Fetch data
  const fetchJenisEvaluasi = async () => {
    setLoading(true)
    try {
      const res = await api.get('/jenis-evaluasi')
      setJenisList(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal memuat daftar jenis evaluasi'), 'error')
      setJenisList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJenisEvaluasi()
  }, [])

  // 2. Pre-save UI Duplicate Check (Nama Jenis Evaluasi)
  const duplicateNamaError = useMemo(() => {
    const trimmed = formNama.trim().toLowerCase()
    if (!trimmed) return null
    const existing = jenisList.find(
      (j) => (j.nama || '').trim().toLowerCase() === trimmed && j.id !== editingJenis?.id
    )
    if (existing) {
      return `Nama jenis evaluasi "${existing.nama}" sudah terdaftar.`
    }
    return null
  }, [formNama, jenisList, editingJenis])

  // 3. Filtered list
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return jenisList
    return jenisList.filter((j) => (j.nama || '').toLowerCase().includes(q))
  }, [jenisList, searchQuery])

  // 4. Modal Handlers
  const handleOpenAdd = () => {
    setEditingJenis(null)
    setFormNama('')
    // Berikan saran urutan berikutnya
    const nextUrutan = jenisList.length > 0
      ? Math.max(...jenisList.map((j) => (typeof j.urutan === 'number' ? j.urutan : 0))) + 1
      : 1
    setFormUrutan(nextUrutan)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item) => {
    setEditingJenis(item)
    setFormNama(item.nama || '')
    setFormUrutan(item.urutan ?? '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (duplicateNamaError) return
    if (!formNama.trim()) {
      pushToast('Nama jenis evaluasi tidak boleh kosong', 'warning')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        nama: formNama.trim(),
        urutan: formUrutan === '' || formUrutan === null ? null : Number(formUrutan),
      }

      if (editingJenis) {
        await api.put(`/jenis-evaluasi/${editingJenis.id}`, payload)
        pushToast(`Jenis evaluasi "${payload.nama}" berhasil diperbarui`, 'success')
      } else {
        await api.post('/jenis-evaluasi', payload)
        pushToast(`Jenis evaluasi "${payload.nama}" berhasil ditambahkan`, 'success')
      }

      setIsModalOpen(false)
      await fetchJenisEvaluasi()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan jenis evaluasi'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // 5. Eksekusi "Isi Contoh Standar"
  const handlePopulateStandard = async () => {
    setStandarLoading(true)
    const results = []

    try {
      // a. Ambil jenis evaluasi terbaru dari server
      const resJenis = await api.get('/jenis-evaluasi')
      const currentJenis = Array.isArray(resJenis.data) ? resJenis.data : []

      // Formatif
      let formatif = currentJenis.find((j) => (j.nama || '').trim().toLowerCase() === 'formatif')
      if (formatif) {
        results.push({ item: 'Jenis Evaluasi: Formatif', status: 'skipped', detail: 'Sudah ada' })
      } else {
        try {
          const res = await api.post('/jenis-evaluasi', { nama: 'Formatif', urutan: 1 })
          formatif = res.data
          results.push({ item: 'Jenis Evaluasi: Formatif', status: 'created', detail: 'Berhasil dibuat (Urutan 1)' })
        } catch (err) {
          results.push({ item: 'Jenis Evaluasi: Formatif', status: 'failed', detail: getApiErrorMessage(err, 'Gagal') })
        }
      }

      // Sumatif
      let sumatif = currentJenis.find((j) => (j.nama || '').trim().toLowerCase() === 'sumatif')
      if (sumatif) {
        results.push({ item: 'Jenis Evaluasi: Sumatif', status: 'skipped', detail: 'Sudah ada' })
      } else {
        try {
          const res = await api.post('/jenis-evaluasi', { nama: 'Sumatif', urutan: 2 })
          sumatif = res.data
          results.push({ item: 'Jenis Evaluasi: Sumatif', status: 'created', detail: 'Berhasil dibuat (Urutan 2)' })
        } catch (err) {
          results.push({ item: 'Jenis Evaluasi: Sumatif', status: 'failed', detail: getApiErrorMessage(err, 'Gagal') })
        }
      }

      // b. Ambil bentuk penilaian saat ini
      const resBentuk = await api.get('/bentuk-penilaian')
      const currentBentuk = Array.isArray(resBentuk.data) ? resBentuk.data : []

      // Helper untuk buat bentuk penilaian
      const createBentukIfMissing = async (jenisObj, namaBentuk) => {
        if (!jenisObj?.id) {
          results.push({
            item: `Bentuk Penilaian: ${namaBentuk}`,
            status: 'failed',
            detail: `Gagal karena jenis evaluasi induk tidak tersedia`,
          })
          return
        }

        const exists = currentBentuk.find(
          (b) =>
            Number(b.jenis_evaluasi_id) === Number(jenisObj.id) &&
            (b.nama || '').trim().toLowerCase() === namaBentuk.toLowerCase()
        )

        if (exists) {
          results.push({
            item: `Bentuk Penilaian: ${namaBentuk} (${jenisObj.nama})`,
            status: 'skipped',
            detail: 'Sudah ada pada jenis ini',
          })
        } else {
          try {
            await api.post('/bentuk-penilaian', {
              jenis_evaluasi_id: jenisObj.id,
              nama: namaBentuk,
            })
            results.push({
              item: `Bentuk Penilaian: ${namaBentuk} (${jenisObj.nama})`,
              status: 'created',
              detail: 'Berhasil dibuat',
            })
          } catch (err) {
            results.push({
              item: `Bentuk Penilaian: ${namaBentuk} (${jenisObj.nama})`,
              status: 'failed',
              detail: getApiErrorMessage(err, 'Gagal'),
            })
          }
        }
      }

      // Buat bentuk penilaian Formatif: Tugas, Kuis
      if (formatif) {
        await createBentukIfMissing(formatif, 'Tugas')
        await createBentukIfMissing(formatif, 'Kuis')
      }

      // Buat bentuk penilaian Sumatif: UTS, UAS
      if (sumatif) {
        await createBentukIfMissing(sumatif, 'UTS')
        await createBentukIfMissing(sumatif, 'UAS')
      }

      setStandarResults(results)
      setIsConfirmStandarOpen(false)
      setIsResultModalOpen(true)
      pushToast('Proses inisialisasi contoh standar selesai', 'success')
      await fetchJenisEvaluasi()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal mengeksekusi inisialisasi standar'), 'error')
      setIsConfirmStandarOpen(false)
    } finally {
      setStandarLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="KURIKULUM OBE · EVALUASI PEMBELAJARAN"
        title="Jenis Evaluasi"
        description="Definisikan klasifikasi evaluasi pembelajaran (contoh: Formatif dan Sumatif) untuk mengelompokkan bentuk penilaian prodi."
        badge="Admin Prodi"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConfirmStandarOpen(true)}
              data-testid="btn-isi-standar"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] hover:border-[#1A3A6B] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Isi Contoh Standar</span>
            </button>
            <ActionButton
              onClick={handleOpenAdd}
              data-testid="btn-tambah-jenis"
              className="bg-[#1A3A6B] text-white hover:bg-[#142B4A]"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Jenis Evaluasi</span>
            </ActionButton>
          </div>
        }
      />

      {/* Info Callout */}
      <div className="flex items-start gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-[#64748B] leading-relaxed">
        <HelpCircle className="h-4 w-4 text-[#1A3A6B] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#142B4A]">Panduan Skema:</span> Jenis Evaluasi berfungsi sebagai payung kategori untuk bentuk penilaian (seperti Tugas, UTS, UAS). Di level kurikulum prodi, jenis evaluasi <strong>tidak memiliki kolom bobot</strong> dan <strong>tidak dapat dihapus</strong> demi menjaga konsistensi riwayat akademik. Bobot penilaian ditentukan oleh dosen pengampu pada mata kuliah masing-masing.
        </div>
      </div>

      {/* Main Content Table Card */}
      <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#E2E8F0] p-4 bg-white">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Cari jenis evaluasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[#CBD5E1] bg-white pl-9 pr-3 py-1.5 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            />
          </div>
          <div className="text-xs text-[#64748B]">
            Total: <span className="font-semibold text-[#142B4A]">{filteredList.length}</span> jenis evaluasi
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#142B4A] font-semibold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 w-16 text-center">No</th>
                <th className="py-3 px-4">Nama Jenis Evaluasi</th>
                <th className="py-3 px-4 w-36 text-center">Urutan Tampilan</th>
                <TableActionHeader />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#64748B]">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                      <span>Memuat jenis evaluasi...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#64748B]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="h-8 w-8 text-[#CBD5E1]" />
                      <p className="font-medium text-[#142B4A]">
                        {searchQuery ? 'Tidak ada jenis evaluasi yang cocok dengan pencarian' : 'Belum ada data jenis evaluasi'}
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        {searchQuery
                          ? 'Coba gunakan kata kunci pencarian yang lain'
                          : 'Tambahkan jenis evaluasi baru atau gunakan "Isi Contoh Standar" untuk memulai'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr key={item.id} className="align-top hover:bg-[#F8FAFC]/80 transition-colors">
                    <td className="py-3 px-4 text-center font-medium text-[#64748B]">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#142B4A]">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#1A3A6B]" />
                        <span>{item.nama}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[#64748B]">
                      {item.urutan ?? '-'}
                    </td>
                    <TableActionCell>
                      <TableActionButton
                        variant="secondary"
                        onClick={() => handleOpenEdit(item)}
                        data-testid={`btn-edit-jenis-${item.id}`}
                        icon={Edit2}
                        label="Ubah"
                        title="Ubah jenis evaluasi"
                      />
                    </TableActionCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TAMBAH / EDIT */}
      <Modal
        open={isModalOpen}
        title={editingJenis ? 'Ubah Jenis Evaluasi' : 'Tambah Jenis Evaluasi'}
        onClose={submitting ? () => {} : () => setIsModalOpen(false)}
        size="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Nama Jenis Evaluasi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={formNama}
              onChange={(e) => setFormNama(e.target.value)}
              placeholder="Contoh: Formatif, Sumatif"
              data-testid="input-nama-jenis"
              className={`w-full rounded-md border px-3 py-2 text-xs text-[#142B4A] focus:outline-none focus:ring-1 ${
                duplicateNamaError
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  : 'border-[#CBD5E1] focus:border-[#1A3A6B] focus:ring-[#1A3A6B]'
              }`}
            />
            {duplicateNamaError && (
              <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1" data-testid="error-duplicate-nama">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{duplicateNamaError}</span>
              </p>
            )}
            <p className="mt-1 text-[11px] text-[#64748B]">
              Nama kategori evaluasi yang merepresentasikan kelompok bentuk penilaian.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Urutan Tampilan <span className="text-[#94A3B8] font-normal">(opsional)</span>
            </label>
            <input
              type="number"
              min="1"
              value={formUrutan}
              onChange={(e) => setFormUrutan(e.target.value)}
              placeholder="Contoh: 1"
              data-testid="input-urutan-jenis"
              className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            />
            <p className="mt-1 text-[11px] text-[#64748B]">
              Nomor urut penataan pada tampilan dan rekap laporan.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
              className="rounded-md border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(duplicateNamaError) || !formNama.trim()}
              data-testid="btn-submit-jenis"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1A3A6B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{editingJenis ? 'Simpan Perubahan' : 'Tambah Jenis'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* DIALOG KONFIRMASI ISI CONTOH STANDAR */}
      <ConfirmDialog
        open={isConfirmStandarOpen}
        title="Isi Contoh Standar Evaluasi"
        message="Aksi ini akan memeriksa dan menambahkan jenis evaluasi standar (Formatif & Sumatif) serta bentuk penilaian standar (Tugas & Kuis untuk Formatif, UTS & UAS untuk Sumatif)."
        warning="Item yang sudah ada di prodi Anda akan dilewati secara otomatis sehingga tidak terjadi duplikasi."
        confirmLabel="Ya, Inisialisasi Standar"
        cancelLabel="Batal"
        isDestructive={false}
        loading={standarLoading}
        onConfirm={handlePopulateStandard}
        onCancel={() => setIsConfirmStandarOpen(false)}
      />

      {/* MODAL HASIL PENGISIAN STANDAR */}
      <Modal
        open={isResultModalOpen}
        title="Hasil Inisialisasi Contoh Standar"
        onClose={() => setIsResultModalOpen(false)}
        size="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#64748B]">
            Berikut ringkasan hasil pemeriksaan dan pembuatan jenis evaluasi serta bentuk penilaian standar:
          </p>

          <div className="max-h-64 overflow-y-auto divide-y divide-[#E2E8F0] rounded-md border border-[#E2E8F0]">
            {standarResults?.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 text-xs">
                <div className="font-medium text-[#142B4A]">{r.item}</div>
                <div className="flex items-center gap-1.5">
                  {r.status === 'created' && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      Dibuat
                    </span>
                  )}
                  {r.status === 'skipped' && (
                    <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                      Dilewati
                    </span>
                  )}
                  {r.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                      <AlertCircle className="h-3 w-3" />
                      Gagal
                    </span>
                  )}
                  <span className="text-[11px] text-[#64748B]">({r.detail})</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsResultModalOpen(false)}
              className="rounded-md bg-[#1A3A6B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142B4A]"
            >
              Selesai
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
