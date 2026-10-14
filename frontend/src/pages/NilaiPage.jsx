import { useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  Download,
  Save,
  RefreshCw,
  Sliders,
  AlertCircle,
  Loader2,
  HelpCircle,
  FileText,
  UserCheck,
} from 'lucide-react'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import Modal from '../components/Modal'
import useDosenCourses from '../hooks/useDosenCourses'
import useToast from '../hooks/useToast'
import api from '../services/api'
import { getApiErrorMessage } from './superAdminHelpers'

export default function NilaiPage() {
  const { pushToast } = useToast()
  const { courses, loading: coursesLoading } = useDosenCourses()

  const [selectedMkId, setSelectedMkId] = useState('')
  const [semester, setSemester] = useState('Ganjil')
  const [activeTab, setActiveTab] = useState('manual') // 'manual' | 'upload'

  // Data States
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [validatingBobot, setValidatingBobot] = useState(false)

  const [pesertaList, setPesertaList] = useState([])
  const [mahasiswaList, setMahasiswaList] = useState([])
  const [bentukList, setBentukList] = useState([])
  const [masterBentuk, setMasterBentuk] = useState([])
  const [existingNilai, setExistingNilai] = useState([])

  // Manual Matrix State: key `${pesertaId}_${mkBentukId}` -> number or string
  const [gradesMatrix, setGradesMatrix] = useState({})

  // Bobot Validation Modal State
  const [bobotResult, setBobotResult] = useState(null)
  const [openBobotModal, setOpenBobotModal] = useState(false)

  // Quick Add Bentuk Modal
  const [openAddBentukModal, setOpenAddBentukModal] = useState(false)
  const [newBentukForm, setNewBentukForm] = useState({
    bentuk_penilaian_id: '',
    bobot: 20,
  })

  // Upload State
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadPreview, setUploadPreview] = useState([])
  const [uploadSummary, setUploadSummary] = useState(null)

  // Default course selection
  useEffect(() => {
    if (courses.length > 0 && !selectedMkId) {
      setSelectedMkId(courses[0].id)
      if (courses[0].semester) {
        setSemester(courses[0].semester)
      }
    }
  }, [courses, selectedMkId])

  // Master Mahasiswa & Master Bentuk Penilaian
  useEffect(() => {
    api
      .get('/mahasiswa')
      .then((r) => setMahasiswaList(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})

    api
      .get('/bentuk-penilaian')
      .then((r) => setMasterBentuk(Array.isArray(r.data) ? r.data : []))
      .catch(() => {
        setMasterBentuk([
          { id: 1, nama: 'Tugas' },
          { id: 2, nama: 'Kuis' },
          { id: 3, nama: 'UTS' },
          { id: 4, nama: 'UAS' },
          { id: 5, nama: 'Praktikum' },
        ])
      })
  }, [])

  const mahasiswaMap = useMemo(() => {
    const map = new Map()
    mahasiswaList.forEach((m) => map.set(Number(m.id), m))
    return map
  }, [mahasiswaList])

  const masterBentukMap = useMemo(() => {
    const map = new Map()
    masterBentuk.forEach((b) => map.set(Number(b.id), b))
    return map
  }, [masterBentuk])

  // Fetch course specific data: Peserta, MK Bentuk Penilaian, Existing Nilai
  const loadCourseData = async () => {
    if (!selectedMkId) return
    setLoading(true)
    try {
      const [pesertaRes, bentukRes, nilaiRes] = await Promise.all([
        api.get('/peserta-mata-kuliah', { params: { mata_kuliah_id: selectedMkId } }),
        api.get('/mk-bentuk-penilaian', { params: { mata_kuliah_id: selectedMkId } }),
        api.get(`/nilai/${selectedMkId}`),
      ])

      const pList = Array.isArray(pesertaRes.data) ? pesertaRes.data : []
      const bList = Array.isArray(bentukRes.data) ? bentukRes.data : []
      const nList = Array.isArray(nilaiRes.data) ? nilaiRes.data : []

      setPesertaList(pList)
      setBentukList(bList)
      setExistingNilai(nList)

      // Initialize Matrix
      const matrix = {}
      nList.forEach((item) => {
        const key = `${item.peserta_mata_kuliah_id}_${item.mk_bentuk_penilaian_id}`
        matrix[key] = item.nilai
      })
      setGradesMatrix(matrix)
    } catch (err) {
      console.warn('Gagal memuat data nilai:', err)
      // Fallback demo data jika offline
      const mockBentuk = [
        { id: 1, mata_kuliah_id: Number(selectedMkId), bentuk_penilaian_id: 1, bobot: 20 },
        { id: 2, mata_kuliah_id: Number(selectedMkId), bentuk_penilaian_id: 3, bobot: 35 },
        { id: 3, mata_kuliah_id: Number(selectedMkId), bentuk_penilaian_id: 4, bobot: 45 },
      ]
      setBentukList(mockBentuk)
      setPesertaList([
        { id: 101, mata_kuliah_id: Number(selectedMkId), mahasiswa_id: 1, kelas: 'A' },
        { id: 102, mata_kuliah_id: Number(selectedMkId), mahasiswa_id: 2, kelas: 'A' },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCourseData()
  }, [selectedMkId])

  const currentCourse = useMemo(() => {
    return courses.find((c) => String(c.id) === String(selectedMkId)) || null
  }, [courses, selectedMkId])

  // Total weight of configured evaluation components
  const totalBobotBentuk = useMemo(() => {
    return bentukList.reduce((acc, b) => acc + Number(b.bobot || 0), 0)
  }, [bentukList])

  // Handler cell change
  const handleMatrixChange = (pesertaId, bentukId, val) => {
    const key = `${pesertaId}_${bentukId}`
    setGradesMatrix((prev) => ({
      ...prev,
      [key]: val,
    }))
  }

  // Submit manual grades
  const handleSaveManualGrades = async () => {
    if (!selectedMkId) return
    const records = []
    const invalidRecords = []

    pesertaList.forEach((p) => {
      bentukList.forEach((b) => {
        const key = `${p.id}_${b.id}`
        const rawVal = gradesMatrix[key]
        if (rawVal !== undefined && rawVal !== '' && rawVal !== null) {
          const num = Number(rawVal)
          if (Number.isNaN(num) || num < 0 || num > 100) {
            invalidRecords.push({ peserta: p, bentuk: b, val: rawVal })
          } else {
            records.push({
              peserta_mata_kuliah_id: p.id,
              mk_bentuk_penilaian_id: b.id,
              nilai: num,
            })
          }
        }
      })
    })

    if (invalidRecords.length > 0) {
      pushToast('Terdapat nilai yang tidak valid (harus angka 0 - 100)', 'error')
      return
    }

    if (records.length === 0) {
      pushToast('Tidak ada data nilai yang diisi untuk disimpan', 'warning')
      return
    }

    setSaving(true)
    try {
      await api.post('/nilai/manual', {
        mk_id: Number(selectedMkId),
        semester: semester === 'Genap' ? 'Genap' : 'Ganjil',
        records,
      })

      pushToast(`${records.length} record nilai berhasil disimpan`)
      loadCourseData()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal menyimpan nilai')
      pushToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle Validasi Bobot
  const handleValidasiBobot = async () => {
    if (!selectedMkId) return
    setValidatingBobot(true)
    try {
      const res = await api.post('/kalkulasi/validasi-bobot', {
        mata_kuliah_id: Number(selectedMkId),
      })
      setBobotResult(res.data)
      setOpenBobotModal(true)
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal memvalidasi bobot mata kuliah')
      pushToast(msg, 'error')
    } finally {
      setValidatingBobot(false)
    }
  }

  // Handle Run Kalkulasi OBE
  const handleRunKalkulasi = async () => {
    if (!selectedMkId) return
    setCalculating(true)
    try {
      const res = await api.post(`/kalkulasi/run/${selectedMkId}`)
      pushToast(
        `Kalkulasi OBE berhasil dihitung! (${res.data?.total_mahasiswa || pesertaList.length} mahasiswa diproses)`
      )
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal menjalankan engine kalkulasi OBE')
      pushToast(msg, 'error')
    } finally {
      setCalculating(false)
    }
  }

  // Handle Add Bentuk Penilaian
  const handleAddBentuk = async (e) => {
    e.preventDefault()
    if (!newBentukForm.bentuk_penilaian_id) {
      pushToast('Pilih bentuk penilaian', 'error')
      return
    }
    try {
      await api.post('/mk-bentuk-penilaian', {
        mata_kuliah_id: Number(selectedMkId),
        bentuk_penilaian_id: Number(newBentukForm.bentuk_penilaian_id),
        bobot: Number(newBentukForm.bobot),
        semester: semester,
      })
      pushToast('Bentuk penilaian berhasil ditambahkan')
      setOpenAddBentukModal(false)
      loadCourseData()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal menambahkan bentuk penilaian')
      pushToast(msg, 'error')
    }
  }

  // Download CSV Template
  const handleDownloadTemplate = () => {
    if (bentukList.length === 0) {
      pushToast('Konfigurasi bentuk penilaian terlebih dahulu sebelum download template', 'warning')
      return
    }

    const headers = ['NIM', 'Nama Mahasiswa', 'Kelas']
    bentukList.forEach((b) => {
      const label = masterBentukMap.get(b.bentuk_penilaian_id)?.nama || `Komponen_${b.id}`
      headers.push(`${label}_(${b.bobot}%)`)
    })

    const rows = [headers.join(',')]
    pesertaList.forEach((p) => {
      const mhs = mahasiswaMap.get(Number(p.mahasiswa_id))
      const row = [mhs?.nim || '', `"${mhs?.nama || ''}"`, p.kelas || 'A']
      bentukList.forEach(() => row.push(''))
      rows.push(row.join(','))
    })

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `template_nilai_${currentCourse?.kode || 'MK'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    pushToast('Template CSV berhasil diunduh')
  }

  // CSV Parsing
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadFile(file)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target.result
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

      if (lines.length < 2) {
        pushToast('File CSV tidak memiliki baris data', 'error')
        return
      }

      const rows = []
      let validCount = 0
      let warningCount = 0

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.replace(/^"|"$/g, '').trim())
        const nim = parts[0]
        const nama = parts[1] || ''
        const kelas = parts[2] || ''

        // Match peserta
        const matchedPeserta = pesertaList.find((p) => {
          const m = mahasiswaMap.get(Number(p.mahasiswa_id))
          return m?.nim === nim
        })

        const scores = []
        let hasError = false
        let hasWarning = false

        if (!matchedPeserta) {
          hasWarning = true
        }

        // Values starting from index 3
        bentukList.forEach((b, bIdx) => {
          const rawScore = parts[3 + bIdx]
          if (rawScore !== undefined && rawScore !== '') {
            const scoreNum = Number(rawScore)
            if (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
              hasError = true
              scores.push({ bentukId: b.id, val: rawScore, valid: false })
            } else {
              scores.push({ bentukId: b.id, val: scoreNum, valid: true })
            }
          } else {
            scores.push({ bentukId: b.id, val: null, valid: true })
          }
        })

        if (hasError) {
          warningCount++
        } else if (hasWarning) {
          warningCount++
        } else {
          validCount++
        }

        rows.push({
          rowIdx: i + 1,
          nim,
          nama,
          kelas,
          matchedPeserta,
          scores,
          status: hasError ? 'ERROR' : hasWarning ? 'WARNING' : 'VALID',
        })
      }

      setUploadPreview(rows)
      setUploadSummary({
        total: rows.length,
        valid: validCount,
        warnings: warningCount,
      })
    }
    reader.readAsText(file)
  }

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!uploadPreview.length) return
    const records = []

    uploadPreview.forEach((row) => {
      if (row.matchedPeserta && row.status !== 'ERROR') {
        row.scores.forEach((s) => {
          if (s.val !== null && s.valid) {
            records.push({
              peserta_mata_kuliah_id: row.matchedPeserta.id,
              mk_bentuk_penilaian_id: s.bentukId,
              nilai: s.val,
            })
          }
        })
      }
    })

    if (records.length === 0) {
      pushToast('Tidak ada data valid yang dapat diimpor', 'warning')
      return
    }

    setSaving(true)
    try {
      await api.post('/nilai/manual', {
        mk_id: Number(selectedMkId),
        semester: semester === 'Genap' ? 'Genap' : 'Ganjil',
        records,
      })

      pushToast(`${records.length} record nilai berhasil diimpor dari file!`)
      setUploadFile(null)
      setUploadPreview([])
      setUploadSummary(null)
      loadCourseData()
      setActiveTab('manual')
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Gagal mengimpor nilai')
      pushToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 animate-[fadeUp_200ms_ease]">
      <PageHeader
        eyebrow="Evaluasi Akademik & Penilaian"
        title="Input & Validasi Nilai"
        description="Kelola penilaian mahasiswa berdasarkan bobot komponen kurikulum OBE, periksa kepatuhan bobot, dan jalankan kalkulasi capaian pembelajaran."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              variant="secondary"
              onClick={handleValidasiBobot}
              disabled={!selectedMkId || validatingBobot}
              data-testid="btn-validasi-bobot"
            >
              {validatingBobot ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sliders className="h-4 w-4" />
              )}
              Validasi Bobot
            </ActionButton>

            <ActionButton
              onClick={handleRunKalkulasi}
              disabled={!selectedMkId || calculating}
              data-testid="btn-run-kalkulasi"
            >
              {calculating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Jalankan Kalkulasi OBE
            </ActionButton>
          </div>
        }
      />

      {/* Course Context & Stat Cards */}
      <div className="grid gap-4 xl:grid-cols-4">
        <SectionCard className="xl:col-span-2" title="Mata Kuliah Yang Dinilai">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-[#64748B]">Mata Kuliah Diampu:</label>
              {coursesLoading ? (
                <div className="mt-1 h-9 animate-pulse rounded bg-[#F8FAFC]" />
              ) : (
                <select
                  value={selectedMkId}
                  onChange={(e) => setSelectedMkId(e.target.value)}
                  data-testid="select-nilai-mk"
                  className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.kode} - {c.nama}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-[#64748B]">Semester Evaluasi:</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                data-testid="select-semester"
                className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              >
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between border-t border-[#E2E8F0] pt-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">Total Bobot Komponen:</span>
              <span
                className={`font-bold ${
                  totalBobotBentuk === 100
                    ? 'text-emerald-700'
                    : totalBobotBentuk > 100
                    ? 'text-red-600'
                    : 'text-amber-600'
                }`}
              >
                {totalBobotBentuk}% {totalBobotBentuk === 100 ? '✓ (Sesuai)' : '(Belum 100%)'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setOpenAddBentukModal(true)}
              className="text-xs font-semibold text-[#1A3A6B] hover:text-[#F4A300] transition-colors"
              data-testid="btn-tambah-bentuk"
            >
              + Konfigurasi Komponen Penilaian
            </button>
          </div>
        </SectionCard>

        <StatCard
          label="Peserta Terdaftar"
          value={pesertaList.length}
          caption="Mahasiswa siap dinilai"
          icon={<UserCheck className="h-4 w-4" />}
          accent="text-[#1A3A6B]"
        />

        <StatCard
          label="Komponen Evaluasi"
          value={bentukList.length}
          caption={`${bentukList.map((b) => masterBentukMap.get(b.bentuk_penilaian_id)?.nama || 'Item').join(', ') || 'Belum ada'}`}
          icon={<Sliders className="h-4 w-4" />}
          accent="text-[#10B981]"
        />
      </div>

      {/* Tab Navigation: Manual vs Upload File */}
      <div className="flex items-center gap-3 border-b border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          data-testid="tab-manual"
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'manual'
              ? 'border-[#1A3A6B] text-[#1A3A6B]'
              : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
          }`}
        >
          <FileText className="h-4 w-4" />
          Input Manual (Form Matriks)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          data-testid="tab-upload"
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'upload'
              ? 'border-[#1A3A6B] text-[#1A3A6B]'
              : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
          }`}
        >
          <Upload className="h-4 w-4" />
          Upload File (CSV / Excel)
        </button>
      </div>

      {/* TAB 1: FORM MATRIX INPUT MANUAL */}
      {activeTab === 'manual' && (
        <SectionCard
          title="Matriks Input Nilai Mahasiswa"
          description="Masukkan nilai angka (0 - 100) untuk setiap peserta pada komponen evaluasi yang aktif."
          action={
            <div className="flex items-center gap-2">
              <ActionButton
                onClick={handleSaveManualGrades}
                disabled={saving || pesertaList.length === 0 || bentukList.length === 0}
                data-testid="btn-simpan-nilai-manual"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Simpan Semua Nilai
                  </>
                )}
              </ActionButton>
            </div>
          }
        >
          {loading ? (
            <div className="space-y-3 py-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-[#F8FAFC]" />
              ))}
            </div>
          ) : pesertaList.length === 0 ? (
            <div className="py-12 text-center" data-testid="nilai-no-peserta">
              <UserCheck className="mx-auto h-10 w-10 text-[#94A3B8]" />
              <h4 className="mt-2 text-sm font-semibold text-[#142B4A]">Belum Ada Peserta</h4>
              <p className="mt-1 text-xs text-[#64748B]">
                Mata kuliah ini belum memiliki peserta terdaftar. Daftarkan mahasiswa terlebih dahulu
                pada halaman Peserta Mata Kuliah.
              </p>
            </div>
          ) : bentukList.length === 0 ? (
            <div className="py-12 text-center" data-testid="nilai-no-bentuk">
              <Sliders className="mx-auto h-10 w-10 text-[#94A3B8]" />
              <h4 className="mt-2 text-sm font-semibold text-[#142B4A]">
                Belum Ada Komponen Penilaian
              </h4>
              <p className="mt-1 text-xs text-[#64748B]">
                Tambahkan komponen evaluasi (misal: Tugas, UTS, UAS) beserta bobotnya untuk memulai
                penilaian.
              </p>
              <div className="mt-4">
                <ActionButton onClick={() => setOpenAddBentukModal(true)}>
                  + Tambah Komponen Penilaian
                </ActionButton>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" data-testid="table-matrix-nilai">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                    <th className="pb-3 w-10 text-center">No</th>
                    <th className="pb-3 w-32">NIM</th>
                    <th className="pb-3">Nama Mahasiswa</th>
                    <th className="pb-3 w-16 text-center">Kelas</th>
                    {bentukList.map((b) => {
                      const name = masterBentukMap.get(b.bentuk_penilaian_id)?.nama || `Item ${b.id}`
                      return (
                        <th key={b.id} className="pb-3 w-28 text-center">
                          {name} ({b.bobot}%)
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F7]">
                  {pesertaList.map((p, idx) => {
                    const mhs = mahasiswaMap.get(Number(p.mahasiswa_id))
                    return (
                      <tr key={p.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 text-center text-xs text-[#64748B]">{idx + 1}</td>
                        <td className="py-2.5 font-mono text-xs font-semibold text-[#142B4A]">
                          {mhs?.nim || `ID #${p.mahasiswa_id}`}
                        </td>
                        <td className="py-2.5 text-xs font-medium text-[#142B4A]">
                          {mhs?.nama || `Mahasiswa ${p.mahasiswa_id}`}
                        </td>
                        <td className="py-2.5 text-center text-xs">
                          <span className="font-semibold text-[#1A3A6B]">{p.kelas || 'A'}</span>
                        </td>
                        {bentukList.map((b) => {
                          const key = `${p.id}_${b.id}`
                          const val = gradesMatrix[key] !== undefined ? gradesMatrix[key] : ''
                          return (
                            <td key={b.id} className="py-2.5 text-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.1"
                                value={val}
                                onChange={(e) => handleMatrixChange(p.id, b.id, e.target.value)}
                                data-testid={`input-nilai-${p.id}-${b.id}`}
                                placeholder="0"
                                className="h-8 w-20 rounded-[4px] border border-[#CBD5E1] bg-white text-center text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* TAB 2: UPLOAD FILE (FEATURE 5) */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <SectionCard
            title="Upload File Nilai (CSV)"
            description="Unggah file CSV nilai mahasiswa hasil ekspor atau gunakan template baku sistem."
            action={
              <ActionButton
                variant="secondary"
                onClick={handleDownloadTemplate}
                data-testid="btn-download-template"
              >
                <Download className="h-4 w-4" />
                Unduh Template CSV
              </ActionButton>
            }
          >
            <div className="rounded-lg border-2 border-dashed border-[#CBD5E1] p-8 text-center hover:border-[#1A3A6B] transition-colors">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-[#94A3B8]" />
              <div className="mt-3">
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer text-xs font-bold text-[#1A3A6B] hover:underline"
                >
                  Pilih file CSV dari komputer
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="sr-only"
                  data-testid="input-file-csv"
                />
                <p className="mt-1 text-[11px] text-[#64748B]">Maksimal ukuran file 5 MB (.csv)</p>
              </div>

              {uploadFile && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{uploadFile.name}</span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Upload Preview & Validation */}
          {uploadPreview.length > 0 && (
            <SectionCard
              title="Preview Hasil Pembacaan File"
              description={`Menampilkan ${Math.min(uploadPreview.length, 10)} baris pertama untuk verifikasi sebelum data disimpan.`}
              action={
                <div className="flex items-center gap-3">
                  {uploadSummary && (
                    <div className="flex items-center gap-2 text-xs">
                      <Badge tone="success">{uploadSummary.valid} Valid</Badge>
                      {uploadSummary.warnings > 0 && (
                        <Badge tone="warning">{uploadSummary.warnings} Warning/Error</Badge>
                      )}
                    </div>
                  )}

                  <ActionButton
                    onClick={handleConfirmImport}
                    disabled={saving}
                    data-testid="btn-confirm-import"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mengimpor...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Konfirmasi & Impor Nilai
                      </>
                    )}
                  </ActionButton>
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" data-testid="table-preview-upload">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                      <th className="pb-3 w-10 text-center">Baris</th>
                      <th className="pb-3 w-32">NIM</th>
                      <th className="pb-3">Nama</th>
                      <th className="pb-3 w-16 text-center">Kelas</th>
                      <th className="pb-3 text-center">Nilai Terbaca</th>
                      <th className="pb-3 w-28 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F7]">
                    {uploadPreview.slice(0, 15).map((row) => (
                      <tr key={row.rowIdx} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 text-center text-xs text-[#64748B]">{row.rowIdx}</td>
                        <td className="py-2.5 font-mono text-xs font-semibold text-[#142B4A]">
                          {row.nim}
                        </td>
                        <td className="py-2.5 text-xs text-[#142B4A]">
                          {row.nama || (row.matchedPeserta ? 'Cocok di sistem' : '-')}
                        </td>
                        <td className="py-2.5 text-center text-xs font-semibold">{row.kelas}</td>
                        <td className="py-2.5 text-center text-xs">
                          {row.scores.map((s, idx) => (
                            <span
                              key={idx}
                              className={`mx-1 inline-block rounded px-1.5 py-0.5 font-mono ${
                                !s.valid
                                  ? 'bg-red-100 text-red-700'
                                  : s.val !== null
                                  ? 'bg-[#1A3A6B]/10 text-[#1A3A6B]'
                                  : 'text-slate-400'
                              }`}
                            >
                              {s.val !== null ? s.val : '-'}
                            </span>
                          ))}
                        </td>
                        <td className="py-2.5 text-center">
                          {row.status === 'VALID' ? (
                            <Badge tone="success">Valid</Badge>
                          ) : row.status === 'WARNING' ? (
                            <Badge tone="warning">NIM Tak Terdaftar</Badge>
                          ) : (
                            <Badge tone="danger">Nilai Tidak Valid</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* Modal Validasi Bobot */}
      <Modal
        open={openBobotModal}
        onClose={() => setOpenBobotModal(false)}
        title="Hasil Validasi Bobot Penilaian"
      >
        <div className="space-y-4">
          {bobotResult?.valid ? (
            <div className="flex items-start gap-3 rounded-[6px] border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <strong className="block text-sm font-semibold">Bobot Penilaian Valid!</strong>
                <span>
                  Total bobot komponen pada mata kuliah ini tepat 100% dan seluruh bentuk penilaian
                  terpetakan dengan benar ke Indikator Kinerja (IK).
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-[6px] border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong className="block text-sm font-semibold">
                  Terdapat Catatan / Warning Bobot
                </strong>
                <ul className="mt-2 list-disc pl-4 space-y-1">
                  {bobotResult?.warnings?.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-[#E2E8F0]">
            <ActionButton onClick={() => setOpenBobotModal(false)}>Tutup</ActionButton>
          </div>
        </div>
      </Modal>

      {/* Modal Tambah Bentuk Penilaian */}
      <Modal
        open={openAddBentukModal}
        onClose={() => setOpenAddBentukModal(false)}
        title="Tambah Komponen Bentuk Penilaian"
      >
        <form onSubmit={handleAddBentuk} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B]">
              Bentuk Penilaian Master *
            </label>
            <select
              value={newBentukForm.bentuk_penilaian_id}
              onChange={(e) =>
                setNewBentukForm({ ...newBentukForm, bentuk_penilaian_id: e.target.value })
              }
              required
              className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
            >
              <option value="">-- Pilih Bentuk Penilaian --</option>
              {masterBentuk.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748B]">Bobot Persentase (%) *</label>
            <input
              type="number"
              min={1}
              max={100}
              value={newBentukForm.bobot}
              onChange={(e) => setNewBentukForm({ ...newBentukForm, bobot: e.target.value })}
              required
              className="mt-1 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <ActionButton
              type="button"
              variant="secondary"
              onClick={() => setOpenAddBentukModal(false)}
            >
              Batal
            </ActionButton>
            <ActionButton type="submit">Tambahkan</ActionButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
