import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import HeatmapGrid from '../components/HeatmapGrid'
import Modal from '../components/Modal'
import ToastContainer from '../components/ToastContainer'
import useToast from '../hooks/useToast'
import { useRole } from '../hooks/useRole'

const nilaiInit = { mahasiswa_id: '', mata_kuliah_id: '', cpmk_id: '', jenis: 'tugas', nilai: '', semester: 'Ganjil', tahun_akademik: '' }
const cpmkInit = { kode_cpmk: '', deskripsi: '', bobot_ke_cpl: {} }

export default function MataKuliahDetailPage() {
  const { canEdit, canDelete, isAdmin, isKaprodi } = useRole()
  const { toasts, pushToast } = useToast()
  const { id } = useParams()
  const mkId = Number(id)
  const canManageMaster = isAdmin || isKaprodi

  const [heatmap, setHeatmap] = useState([])
  const [prediksiBatch, setPrediksiBatch] = useState([])
  const [mkDetail, setMkDetail] = useState(null)
  const [mahasiswaList, setMahasiswaList] = useState([])
  const [nilaiRows, setNilaiRows] = useState([])
  const [cpmkRows, setCpmkRows] = useState([])
  const [cplRows, setCplRows] = useState([])

  const [openNilaiModal, setOpenNilaiModal] = useState(false)
  const [openImportModal, setOpenImportModal] = useState(false)
  const [openCpmkModal, setOpenCpmkModal] = useState(false)
  const [selectedNilai, setSelectedNilai] = useState(null)
  const [selectedCpmk, setSelectedCpmk] = useState(null)
  const [nilaiForm, setNilaiForm] = useState({ ...nilaiInit, mata_kuliah_id: mkId })
  const [cpmkForm, setCpmkForm] = useState(cpmkInit)
  const [csvFile, setCsvFile] = useState(null)
  const [csvPreview, setCsvPreview] = useState([])
  const [importSummary, setImportSummary] = useState(null)

  const aggregateByMahasiswa = mahasiswaList.map((mhs) => {
    const rows = nilaiRows.filter((n) => n.mahasiswa_id === mhs.id)
    const avg = (jenis) => {
      const sub = rows.filter((n) => n.jenis === jenis)
      if (!sub.length) return 0
      return sub.reduce((acc, item) => acc + Number(item.nilai), 0) / sub.length
    }
    const tugas = avg('tugas')
    const kuis = avg('kuis')
    const uts = avg('uts')
    const uas = avg('uas')
    const proyek = avg('proyek')
    const nilaiAkhir = 0.2 * tugas + 0.1 * kuis + 0.25 * uts + 0.3 * uas + 0.15 * proyek
    return {
      mahasiswa: mhs,
      tugas,
      kuis,
      uts,
      uas,
      proyek,
      nilaiAkhir,
    }
  })

  const loadData = async () => {
    const [heatRes, predRes, mkRes, mahasiswaRes, nilaiRes, cpmkRes, cplRes] = await Promise.all([
      api.get('/dashboard/heatmap'),
      api.get(`/analisis/prediksi-batch/${mkId}`),
      api.get(`/mata-kuliah/${mkId}`),
      api.get('/mahasiswa'),
      api.get('/penilaian', { params: { mk_id: mkId } }),
      api.get('/cpmk', { params: { mk_id: mkId } }),
      api.get('/cpl'),
    ])

    setHeatmap(heatRes.data.filter((h) => h.mata_kuliah_id === mkId))
    setPrediksiBatch(predRes.data)
    setMkDetail(mkRes.data)
    setMahasiswaList(mahasiswaRes.data)
    setNilaiRows(nilaiRes.data)
    setCpmkRows(cpmkRes.data)
    setCplRows(cplRes.data.filter((c) => c.program_studi_id === mkRes.data.program_studi_id))
  }

  useEffect(() => {
    loadData().catch(() => pushToast('Gagal memuat detail mata kuliah', 'error'))
  }, [id])

  const cpmkMap = cpmkRows.reduce((acc, item) => ({ ...acc, [item.id]: item }), {})

  const openInputNilai = (mahasiswaId) => {
    setSelectedNilai(null)
    setNilaiForm({ ...nilaiInit, mata_kuliah_id: mkId, mahasiswa_id: mahasiswaId || '' })
    setOpenNilaiModal(true)
  }

  const editNilai = (row) => {
    setSelectedNilai(row)
    setNilaiForm({
      mahasiswa_id: row.mahasiswa_id,
      mata_kuliah_id: row.mata_kuliah_id,
      cpmk_id: row.cpmk_id,
      jenis: row.jenis,
      nilai: row.nilai,
      semester: row.semester,
      tahun_akademik: row.tahun_akademik,
    })
    setOpenNilaiModal(true)
  }

  const submitNilai = async (e) => {
    e.preventDefault()
    if (!/^\d{4}\/\d{4}$/.test(nilaiForm.tahun_akademik)) {
      pushToast('Format tahun akademik harus YYYY/YYYY', 'error')
      return
    }
    const payload = {
      ...nilaiForm,
      mahasiswa_id: Number(nilaiForm.mahasiswa_id),
      mata_kuliah_id: mkId,
      cpmk_id: Number(nilaiForm.cpmk_id),
      nilai: Number(nilaiForm.nilai),
    }

    try {
      if (selectedNilai) {
        await api.put(`/penilaian/${selectedNilai.id}`, payload)
        pushToast('Nilai berhasil diupdate')
      } else {
        await api.post('/penilaian', payload)
        pushToast('Nilai berhasil disimpan')
      }
      setOpenNilaiModal(false)
      await loadData()
    } catch {
      pushToast('Gagal menyimpan nilai', 'error')
    }
  }

  const deleteNilai = async (rowId) => {
    try {
      await api.delete(`/penilaian/${rowId}`)
      pushToast('Nilai berhasil dihapus')
      await loadData()
    } catch {
      pushToast('Gagal menghapus nilai', 'error')
    }
  }

  const openTambahCpmk = () => {
    setSelectedCpmk(null)
    const bobotDefault = cplRows.reduce((acc, c) => ({ ...acc, [c.kode_cpl]: 0 }), {})
    setCpmkForm({ ...cpmkInit, bobot_ke_cpl: bobotDefault })
    setOpenCpmkModal(true)
  }

  const openEditCpmk = (row) => {
    setSelectedCpmk(row)
    const bobotDefault = cplRows.reduce((acc, c) => ({ ...acc, [c.kode_cpl]: row.bobot_ke_cpl?.[c.kode_cpl] || 0 }), {})
    setCpmkForm({ kode_cpmk: row.kode_cpmk, deskripsi: row.deskripsi, bobot_ke_cpl: bobotDefault })
    setOpenCpmkModal(true)
  }

  const totalBobot = Object.values(cpmkForm.bobot_ke_cpl || {}).reduce((acc, v) => acc + Number(v || 0), 0)

  const submitCpmk = async (e) => {
    e.preventDefault()
    if (Math.abs(totalBobot - 1) > 0.001) {
      pushToast('Total bobot CPL harus 1.0', 'error')
      return
    }
    const payload = {
      kode_cpmk: cpmkForm.kode_cpmk,
      deskripsi: cpmkForm.deskripsi,
      mata_kuliah_id: mkId,
      bobot_ke_cpl: Object.fromEntries(
        Object.entries(cpmkForm.bobot_ke_cpl).map(([k, v]) => [k, Number(v || 0)])
      ),
    }
    try {
      if (selectedCpmk) {
        await api.put(`/cpmk/${selectedCpmk.id}`, payload)
        pushToast('CPMK berhasil diupdate')
      } else {
        await api.post('/cpmk', payload)
        pushToast('CPMK berhasil ditambahkan')
      }
      setOpenCpmkModal(false)
      await loadData()
    } catch {
      pushToast('Operasi CPMK gagal', 'error')
    }
  }

  const deleteCpmk = async (rowId) => {
    try {
      await api.delete(`/cpmk/${rowId}`)
      pushToast('CPMK berhasil dihapus')
      await loadData()
    } catch {
      pushToast('Gagal menghapus CPMK', 'error')
    }
  }

  const onCsvSelect = (file) => {
    setCsvFile(file)
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result || ''
      const lines = String(text).split(/\r?\n/).filter(Boolean)
      setCsvPreview(lines.slice(0, 6))
    }
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    const content = 'nim,cpmk_kode,jenis,nilai,semester,tahun_akademik\n2201001,CPMK-IF201-1,tugas,85,Ganjil,2025/2026\n'
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_import_nilai.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const submitImport = async () => {
    if (!csvFile) {
      pushToast('Pilih file CSV terlebih dulu', 'error')
      return
    }
    const formData = new FormData()
    formData.append('file', csvFile)
    try {
      const { data } = await api.post('/penilaian/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportSummary(data)
      pushToast('Import CSV selesai')
      await loadData()
    } catch {
      pushToast('Import CSV gagal', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} />

      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <h3 className="font-semibold mb-3">Tabel Prediksi Mahasiswa</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th>#</th><th>Prob. Lulus</th><th>Prediksi</th></tr></thead>
          <tbody>
            {prediksiBatch.map((p, idx) => (
              <tr key={idx} className="border-b"><td>{idx + 1}</td><td>{p.probabilitas_lulus}%</td><td>{p.prediksi}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <h3 className="font-semibold mb-3">Heatmap CPMK</h3>
        <HeatmapGrid data={heatmap} />
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Nilai Mahasiswa - {mkDetail?.nama_mk}</h3>
          <div className="flex gap-2">
            {canEdit && <button className="px-3 py-2 border rounded" onClick={() => setOpenImportModal(true)}>Import CSV</button>}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th>Mahasiswa</th><th>Rata Tugas</th><th>Kuis</th><th>UTS</th><th>UAS</th><th>Proyek</th><th>Nilai Akhir</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {aggregateByMahasiswa.map((row) => (
              <tr key={row.mahasiswa.id} className="border-b">
                <td>{row.mahasiswa.nama}</td>
                <td>{row.tugas.toFixed(1)}</td>
                <td>{row.kuis.toFixed(1)}</td>
                <td>{row.uts.toFixed(1)}</td>
                <td>{row.uas.toFixed(1)}</td>
                <td>{row.proyek.toFixed(1)}</td>
                <td>{row.nilaiAkhir.toFixed(1)}</td>
                <td>{canEdit && <button className="text-primary" onClick={() => openInputNilai(row.mahasiswa.id)}>+ Input Nilai</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">CPMK</h3>
          {canManageMaster && <button className="bg-primary text-white px-3 py-2 rounded" onClick={openTambahCpmk}>+ Tambah CPMK</button>}
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th>Kode CPMK</th><th>Deskripsi</th><th>Bobot ke CPL</th><th>Aksi</th></tr></thead>
          <tbody>
            {cpmkRows.map((row) => (
              <tr key={row.id} className="border-b">
                <td>{row.kode_cpmk}</td>
                <td>{row.deskripsi}</td>
                <td className="text-xs">{Object.entries(row.bobot_ke_cpl || {}).map(([k, v]) => `${k}:${v}`).join(' | ')}</td>
                <td>
                  <div className="flex gap-2">
                    {canManageMaster && <button className="text-amber-600" onClick={() => openEditCpmk(row)}>Edit</button>}
                    {canDelete && <button className="text-red-600" onClick={() => deleteCpmk(row.id)}>Hapus</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={openNilaiModal} title={selectedNilai ? 'Edit Nilai' : 'Input Nilai'} onClose={() => setOpenNilaiModal(false)}>
        <form onSubmit={submitNilai} className="space-y-3">
          <select className="w-full border rounded px-3 py-2" value={nilaiForm.mahasiswa_id} onChange={(e) => setNilaiForm((f) => ({ ...f, mahasiswa_id: e.target.value }))} required>
            <option value="">Pilih Mahasiswa</option>
            {mahasiswaList.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
          </select>
          <input className="w-full border rounded px-3 py-2 bg-slate-100" value={mkDetail?.nama_mk || ''} disabled />
          <select className="w-full border rounded px-3 py-2" value={nilaiForm.cpmk_id} onChange={(e) => setNilaiForm((f) => ({ ...f, cpmk_id: e.target.value }))} required>
            <option value="">Pilih CPMK</option>
            {cpmkRows.map((c) => <option key={c.id} value={c.id}>{c.kode_cpmk}</option>)}
          </select>
          <select className="w-full border rounded px-3 py-2" value={nilaiForm.jenis} onChange={(e) => setNilaiForm((f) => ({ ...f, jenis: e.target.value }))}>
            <option value="tugas">Tugas</option><option value="kuis">Kuis</option><option value="uts">UTS</option><option value="uas">UAS</option><option value="proyek">Proyek</option>
          </select>
          <input type="number" min="0" max="100" step="0.1" className="w-full border rounded px-3 py-2" value={nilaiForm.nilai} onChange={(e) => setNilaiForm((f) => ({ ...f, nilai: e.target.value }))} required />
          <select className="w-full border rounded px-3 py-2" value={nilaiForm.semester} onChange={(e) => setNilaiForm((f) => ({ ...f, semester: e.target.value }))}><option value="Ganjil">Ganjil</option><option value="Genap">Genap</option></select>
          <input className="w-full border rounded px-3 py-2" placeholder="2023/2024" value={nilaiForm.tahun_akademik} onChange={(e) => setNilaiForm((f) => ({ ...f, tahun_akademik: e.target.value }))} required />
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-2 border rounded" onClick={() => setOpenNilaiModal(false)}>Batal</button>
            <button className="px-3 py-2 bg-primary text-white rounded">{selectedNilai ? 'Update' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={openImportModal} title="Import Nilai dari CSV" onClose={() => setOpenImportModal(false)}>
        <div className="space-y-3">
          <button className="px-3 py-2 border rounded" onClick={downloadTemplate}>Download Template CSV</button>
          <input type="file" accept=".csv" onChange={(e) => onCsvSelect(e.target.files?.[0])} />
          {csvPreview.length > 0 && (
            <div className="bg-slate-50 border rounded p-2 text-xs whitespace-pre-wrap">
              {csvPreview.join('\n')}
            </div>
          )}
          {importSummary && (
            <div className="text-sm bg-green-50 border border-green-200 rounded p-2">
              Berhasil: {importSummary.berhasil} | Gagal: {importSummary.gagal}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 border rounded" onClick={() => setOpenImportModal(false)}>Batal</button>
            <button className="px-3 py-2 bg-primary text-white rounded" onClick={submitImport}>Konfirmasi Import</button>
          </div>
        </div>
      </Modal>

      <Modal open={openCpmkModal} title={selectedCpmk ? 'Edit CPMK' : 'Tambah CPMK'} onClose={() => setOpenCpmkModal(false)}>
        <form onSubmit={submitCpmk} className="space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="Kode CPMK" value={cpmkForm.kode_cpmk} onChange={(e) => setCpmkForm((f) => ({ ...f, kode_cpmk: e.target.value }))} required />
          <textarea className="w-full border rounded px-3 py-2" placeholder="Deskripsi" value={cpmkForm.deskripsi} onChange={(e) => setCpmkForm((f) => ({ ...f, deskripsi: e.target.value }))} required />
          <div className="space-y-2">
            {cplRows.map((cpl) => (
              <div key={cpl.id} className="flex items-center justify-between gap-2">
                <label className="text-sm">{cpl.kode_cpl}</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  className="border rounded px-2 py-1 w-24"
                  value={cpmkForm.bobot_ke_cpl?.[cpl.kode_cpl] ?? 0}
                  onChange={(e) => setCpmkForm((f) => ({
                    ...f,
                    bobot_ke_cpl: { ...f.bobot_ke_cpl, [cpl.kode_cpl]: e.target.value },
                  }))}
                />
              </div>
            ))}
          </div>
          <p className={`text-sm ${Math.abs(totalBobot - 1) > 0.001 ? 'text-red-600' : 'text-green-600'}`}>Total bobot: {totalBobot.toFixed(2)} (harus 1.00)</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-2 border rounded" onClick={() => setOpenCpmkModal(false)}>Batal</button>
            <button className="px-3 py-2 bg-primary text-white rounded">Simpan</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
