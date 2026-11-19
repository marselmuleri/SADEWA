import { useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import api from '../../services/api'
import Modal from '../Modal'
import { ActionButton, Badge } from '../PageChrome'
import { IMPOR_ACCEPT } from '../../utils/spreadsheet'
import { bacaFileNilai, judulKomponen, rekamanImpor, unduhTemplateNilai } from '../../utils/imporNilai'
import { getApiErrorMessage } from '../../pages/superAdminHelpers'

const MAKS_UKURAN = 5 * 1024 * 1024

const WARNA_SEL = {
  baru: 'bg-emerald-50 font-semibold text-emerald-800',
  ubah: 'bg-amber-50 font-semibold text-amber-800',
  tetap: 'text-[#64748B]',
  kosong: 'text-[#CBD5E1]',
  galat: 'bg-red-50 font-semibold text-red-700',
}

// Unduh template + impor nilai dari Excel untuk satu mata kuliah (halaman Penilaian dosen).
export default function ImporNilaiExcel({ course, componentsList, bentukMap, pesertaList, scoresByPesertaAndComp, onSelesai, pushToast }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [hasil, setHasil] = useState(null)
  const [galatFile, setGalatFile] = useState('')
  const [membaca, setMembaca] = useState(false)
  const [menyimpan, setMenyimpan] = useState(false)
  const [mengunduh, setMengunduh] = useState(false)

  const konteks = { course, componentsList, bentukMap, pesertaList, scoresByPesertaAndComp }
  const belumSiap = componentsList.length === 0 || pesertaList.length === 0
  const alasanBelumSiap = componentsList.length === 0 ? 'Tambahkan komponen penilaian terlebih dahulu' : 'Belum ada peserta di mata kuliah ini'

  const unduhTemplate = async () => {
    setMengunduh(true)
    try {
      await unduhTemplateNilai(konteks)
      pushToast('Template Excel nilai berhasil diunduh')
    } catch {
      pushToast('Gagal membuat template Excel', 'error')
    } finally {
      setMengunduh(false)
    }
  }

  const buka = () => {
    setFile(null)
    setHasil(null)
    setGalatFile('')
    setOpen(true)
  }

  const pilihFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    setHasil(null)
    setGalatFile('')
    if (!f) return
    if (!/\.(xlsx|csv|tsv|txt)$/i.test(f.name)) {
      setGalatFile('File harus berformat Excel (.xlsx) atau CSV (.csv). File .xls lama: buka di Excel lalu Save As "Excel Workbook (.xlsx)".')
      return
    }
    if (f.size > MAKS_UKURAN) {
      setGalatFile(`Ukuran file ${(f.size / 1024 / 1024).toFixed(1)} MB melebihi batas 5 MB.`)
      return
    }
    setFile(f)
    setMembaca(true)
    try {
      const h = await bacaFileNilai(await f.arrayBuffer(), konteks)
      if (!h.baris.length) setGalatFile('File tidak berisi baris nilai.')
      else setHasil(h)
    } catch (err) {
      setGalatFile(`Gagal membaca file: ${err.message}`)
    } finally {
      setMembaca(false)
    }
  }

  const rekaman = hasil ? rekamanImpor(hasil.baris) : []
  const jumlah = (st) => (hasil ? hasil.baris.filter((b) => b.status === st).length : 0)

  const simpan = async () => {
    if (!rekaman.length) return
    setMenyimpan(true)
    try {
      await api.post('/nilai/manual', {
        mk_id: course.id,
        semester: course.semester || 'Ganjil',
        sumber: 'upload',
        records: rekaman,
      })
      pushToast(`${rekaman.length} nilai dari ${jumlah('siap')} mahasiswa berhasil diimpor. Klik "Hitung Evaluasi Capaian" untuk memperbarui capaian.`, 'success')
      setOpen(false)
      await onSelesai()
    } catch (err) {
      setGalatFile(getApiErrorMessage(err, 'Gagal menyimpan nilai hasil impor'))
    } finally {
      setMenyimpan(false)
    }
  }

  const judul = judulKomponen(componentsList, bentukMap)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          onClick={unduhTemplate}
          disabled={belumSiap || mengunduh}
          title={belumSiap ? alasanBelumSiap : 'Template berisi daftar peserta dan nilai yang sudah tersimpan'}
          data-testid="btn-unduh-template-nilai"
        >
          {mengunduh ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Unduh Template Excel
        </ActionButton>
        <ActionButton
          className="px-3 py-1.5 text-xs"
          onClick={buka}
          disabled={belumSiap}
          title={belumSiap ? alasanBelumSiap : undefined}
          data-testid="btn-impor-nilai"
        >
          <Upload className="h-3.5 w-3.5" />
          Impor Nilai Excel
        </ActionButton>
      </div>

      <Modal
        open={open}
        title={`Impor Nilai Excel · ${course.kode} ${course.nama}`}
        onClose={() => !menyimpan && setOpen(false)}
        dismissible={!menyimpan}
        size="max-w-5xl"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-4 text-xs text-[#64748B] space-y-2">
            <p className="text-[#142B4A]">
              <b>Langkah:</b> unduh template (sudah berisi semua peserta dan nilai tersimpan), isi nilai 0 - 100 di Excel, simpan, lalu unggah di sini.
              Anda akan melihat pratinjau sebelum nilai disimpan.
            </p>
            <p>
              Kolom: <code>NIM</code>, <code>Nama Mahasiswa</code>, <code>Kelas</code>, lalu {judul.map((j, i) => <span key={j}>{i ? ', ' : ''}<code>{j}</code></span>)}. Sel kosong = nilai tidak diubah.
            </p>
            <button
              type="button"
              onClick={unduhTemplate}
              disabled={mengunduh}
              className="inline-flex items-center gap-1 font-semibold text-[#1A3A6B] hover:underline disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Unduh Template Excel
            </button>
          </div>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-[#CBD5E1] p-6 text-center transition-colors hover:border-[#1A3A6B]">
            <FileSpreadsheet className="h-9 w-9 text-[#94A3B8]" />
            <span className="text-xs font-bold text-[#1A3A6B]">{file ? 'Ganti file' : 'Pilih file Excel (.xlsx) atau CSV'}</span>
            <span className="text-[11px] text-[#64748B]">{file ? file.name : 'Maksimal 5 MB'}</span>
            <input type="file" accept={IMPOR_ACCEPT} onChange={pilihFile} disabled={menyimpan} className="sr-only" data-testid="input-file-nilai" />
          </label>

          {membaca && (
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" /> Membaca file...
            </div>
          )}

          {galatFile && (
            <div className="flex items-start gap-2 rounded-[6px] border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{galatFile}</span>
            </div>
          )}

          {hasil && (
            <>
              {hasil.kolomHilang.length > 0 && (
                <div className="flex items-start gap-2 rounded-[6px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Kolom tidak ditemukan di file sehingga tidak diimpor: <b>{hasil.kolomHilang.join(', ')}</b>. Pastikan judul kolom sama dengan template.</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone="success">{jumlah('siap')} mahasiswa siap diimpor ({rekaman.length} nilai)</Badge>
                <Badge>{jumlah('tetap')} tidak berubah</Badge>
                {jumlah('galat') > 0 && <Badge tone="danger">{jumlah('galat')} baris bermasalah, dilewati</Badge>}
                <span className="ml-auto flex items-center gap-3 text-[11px] text-[#64748B]">
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" />baru</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200" />diubah</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-200" />salah</span>
                </span>
              </div>

              <div className="max-h-[45vh] overflow-auto rounded-lg border border-[#E2E8F0]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#142B4A]">
                    <tr>
                      <th className="px-3 py-2">Baris</th>
                      <th className="px-3 py-2">NIM</th>
                      <th className="px-3 py-2 min-w-[160px]">Nama</th>
                      {judul.map((j) => <th key={j} className="px-3 py-2 text-center">{j}</th>)}
                      <th className="px-3 py-2 min-w-[180px]">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {hasil.baris.map((b) => (
                      <tr key={b.nomor} className={b.status === 'galat' ? 'bg-red-50/40' : ''}>
                        <td className="px-3 py-2 text-[#64748B]">{b.nomor}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-[#1A3A6B]">{b.nim || '-'}</td>
                        <td className="px-3 py-2 text-[#142B4A]">{b.nama || '-'}</td>
                        {componentsList.map((c) => {
                          const v = b.nilai[c.id]
                          return (
                            <td key={c.id} className={`px-3 py-2 text-center font-mono ${WARNA_SEL[v.status]}`}>
                              {v.status === 'kosong' ? '-' : v.angka ?? v.teks}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2">
                          {b.status === 'galat' ? (
                            <span className="text-red-700">{b.galat.join('; ')}</span>
                          ) : b.status === 'siap' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Siap</span>
                          ) : (
                            <span className="text-[#64748B]">Tidak ada perubahan</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-4">
            <ActionButton variant="secondary" onClick={() => setOpen(false)} disabled={menyimpan}>Batal</ActionButton>
            <ActionButton onClick={simpan} disabled={menyimpan || !rekaman.length} data-testid="btn-simpan-impor-nilai">
              {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {menyimpan ? 'Menyimpan...' : `Simpan ${rekaman.length} nilai`}
            </ActionButton>
          </div>
        </div>
      </Modal>
    </>
  )
}
