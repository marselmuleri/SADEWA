import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Target,
  Award,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { ActionButton, Badge, PageHeader, SectionCard, StatCard } from '../components/PageChrome'
import Modal from '../components/Modal'
import useAuth from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import useToast from '../hooks/useToast'
import api from '../services/api'

// Fallback demo data jika backend belum memiliki data awal
const defaultVersions = [
  {
    id: 1,
    version_label: 'Kurikulum OBE 2024 (Revisi 2)',
    semester: 'Genap',
    status: 'published',
    published_at: '2024-02-01T00:00:00Z',
  },
]

const defaultCplList = [
  {
    id: 1,
    kurikulum_version_id: 1,
    kode: 'CPL-01',
    deskripsi: 'Mampu menerapkan pengetahuan matematika, sains, dan prinsip rekayasa komputer untuk menyelesaikan masalah rekayasa kompleks.',
    threshold_capaian: 70.0,
  },
  {
    id: 2,
    kurikulum_version_id: 1,
    kode: 'CPL-02',
    deskripsi: 'Mampu merancang dan mengimplementasikan sistem berbasis komputer mencakup perangkat keras, perangkat lunak, dan jaringan.',
    threshold_capaian: 70.0,
  },
  {
    id: 3,
    kurikulum_version_id: 1,
    kode: 'CPL-03',
    deskripsi: 'Mampu berkomunikasi secara efektif baik lisan maupun tulisan dalam lingkungan profesional dan multidisiplin.',
    threshold_capaian: 75.0,
  },
]

const defaultIkList = [
  {
    id: 1,
    cpl_id: 1,
    kode: 'IK-01.1',
    deskripsi: 'Menjelaskan prinsip dasar rekayasa perangkat lunak dan komputasi cerdas.',
    urutan: 1,
  },
  {
    id: 2,
    cpl_id: 1,
    kode: 'IK-01.2',
    deskripsi: 'Memformulasikan masalah komputasi kompleks dengan pemodelan matematis.',
    urutan: 2,
  },
  {
    id: 3,
    cpl_id: 2,
    kode: 'IK-02.1',
    deskripsi: 'Merancang arsitektur sistem embedded dan protokol komunikasi jaringan terdistribusi.',
    urutan: 1,
  },
  {
    id: 4,
    cpl_id: 3,
    kode: 'IK-03.1',
    deskripsi: 'Menyusun laporan teknis rekayasa dengan struktur baku dan presentasi efektif.',
    urutan: 1,
  },
]

const defaultMataKuliahList = [
  {
    id: 1,
    kurikulum_version_id: 1,
    kode: 'TK2101',
    nama: 'Algoritma & Struktur Data',
    sks: 3,
    semester: 'Ganjil',
    tahun_ajaran: '2024/2025',
  },
  {
    id: 2,
    kurikulum_version_id: 1,
    kode: 'TK2202',
    nama: 'Arsitektur Komputer & Organisasi',
    sks: 3,
    semester: 'Genap',
    tahun_ajaran: '2024/2025',
  },
  {
    id: 3,
    kurikulum_version_id: 1,
    kode: 'TK3103',
    nama: 'Sistem Terdistribusi',
    sks: 4,
    semester: 'Ganjil',
    tahun_ajaran: '2024/2025',
  },
]

const defaultCpmkList = [
  {
    id: 1,
    mata_kuliah_id: 1,
    kode: 'CPMK-01',
    deskripsi: 'Mampu mengimplementasikan struktur data linier dan non-linier menggunakan bahasa pemrograman modern.',
    level_taksonomi: 'C3',
    bobot: 25.0,
    mappings: [{ ik_id: 1, bobot: 25.0 }],
  },
  {
    id: 2,
    mata_kuliah_id: 1,
    kode: 'CPMK-02',
    deskripsi: 'Mampu menganalisis efisiensi algoritma rekursif dan struktur pohon (Time & Space Complexity).',
    level_taksonomi: 'C4',
    bobot: 35.0,
    mappings: [{ ik_id: 2, bobot: 35.0 }],
  },
  {
    id: 3,
    mata_kuliah_id: 2,
    kode: 'CPMK-01',
    deskripsi: 'Mampu menganalisis rancangan unit pengolah mikro dan instruksi pipelining.',
    level_taksonomi: 'C4',
    bobot: 30.0,
    mappings: [{ ik_id: 3, bobot: 30.0 }],
  },
]

export default function KurikulumPage() {
  const { user, activeRole } = useAuth()
  const { role } = useRole()
  const { pushToast } = useToast()

  const currentRole = activeRole || role || user?.role || 'admin_prodi'
  const canEdit = currentRole === 'admin_prodi'

  // Navigation tab
  const [activeTab, setActiveTab] = useState('cpl') // 'cpl' | 'mk' | 'matrix'

  // Versions state
  const [versions, setVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [loadingVersions, setLoadingVersions] = useState(true)

  // Main data states
  const [cplList, setCplList] = useState([])
  const [ikList, setIkList] = useState([])
  const [mkList, setMkList] = useState([])
  const [cpmkList, setCpmkList] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  // UI accordion state (expanded CPL / MK IDs)
  const [expandedCplIds, setExpandedCplIds] = useState(new Set([1]))
  const [expandedMkIds, setExpandedMkIds] = useState(new Set([1]))

  // Filters
  const [mkSemesterFilter, setMkSemesterFilter] = useState('ALL')

  // Modals state
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false)
  const [isCplModalOpen, setIsCplModalOpen] = useState(false)
  const [isIkModalOpen, setIsIkModalOpen] = useState(false)
  const [isMkModalOpen, setIsMkModalOpen] = useState(false)
  const [isCpmkModalOpen, setIsCpmkModalOpen] = useState(false)
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false)

  // Edit targets & form states
  const [editingCpl, setEditingCpl] = useState(null)
  const [editingIk, setEditingIk] = useState(null)
  const [editingMk, setEditingMk] = useState(null)
  const [editingCpmk, setEditingCpmk] = useState(null)
  const [targetCplForIk, setTargetCplForIk] = useState(null)
  const [targetMkForCpmk, setTargetMkForCpmk] = useState(null)
  const [targetCpmkForMapping, setTargetCpmkForMapping] = useState(null)

  // Form inputs
  const [versionForm, setVersionForm] = useState({ version_label: '', semester: 'Ganjil' })
  const [cplForm, setCplForm] = useState({ kode: '', deskripsi: '', threshold_capaian: 70.0 })
  const [ikForm, setIkForm] = useState({ kode: '', deskripsi: '', urutan: 1 })
  const [mkForm, setMkForm] = useState({ kode: '', nama: '', sks: 3, semester: 'Ganjil', tahun_ajaran: '2024/2025' })
  const [cpmkForm, setCpmkForm] = useState({ kode: '', deskripsi: '', level_taksonomi: 'C3', bobot: 20.0 })

  // Mapping Form State: array of { ik_id, bobot }
  const [mappingRows, setMappingRows] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // 1. Fetch versions
  const fetchVersions = async () => {
    setLoadingVersions(true)
    try {
      const res = await api.get('/kurikulum/versions')
      if (Array.isArray(res.data) && res.data.length > 0) {
        setVersions(res.data)
        if (!selectedVersionId) {
          setSelectedVersionId(res.data[0].id)
        }
      } else {
        setVersions(defaultVersions)
        setSelectedVersionId(defaultVersions[0].id)
      }
    } catch {
      setVersions(defaultVersions)
      setSelectedVersionId(defaultVersions[0].id)
    } finally {
      setLoadingVersions(false)
    }
  }

  // 2. Fetch CPL, IK, MK, CPMK for selected version
  const fetchCurriculumData = async (versionId) => {
    if (!versionId) return
    setLoadingData(true)
    try {
      const [cplRes, ikRes, mkRes, cpmkRes] = await Promise.allSettled([
        api.get('/cpl', { params: { kurikulum_version_id: versionId } }),
        api.get('/ik'),
        api.get('/mata-kuliah', { params: { kurikulum_version_id: versionId } }),
        api.get('/cpmk'),
      ])

      const fetchedCpl = cplRes.status === 'fulfilled' && Array.isArray(cplRes.value.data) ? cplRes.value.data : []
      const fetchedIk = ikRes.status === 'fulfilled' && Array.isArray(ikRes.value.data) ? ikRes.value.data : []
      const fetchedMk = mkRes.status === 'fulfilled' && Array.isArray(mkRes.value.data) ? mkRes.value.data : []
      const fetchedCpmk = cpmkRes.status === 'fulfilled' && Array.isArray(cpmkRes.value.data) ? cpmkRes.value.data : []

      if (fetchedCpl.length > 0) {
        setCplList(fetchedCpl)
        setExpandedCplIds(new Set([fetchedCpl[0].id]))
      } else {
        setCplList(defaultCplList)
      }

      setIkList(fetchedIk.length > 0 ? fetchedIk : defaultIkList)

      if (fetchedMk.length > 0) {
        setMkList(fetchedMk)
        setExpandedMkIds(new Set([fetchedMk[0].id]))
      } else {
        setMkList(defaultMataKuliahList)
      }

      setCpmkList(fetchedCpmk.length > 0 ? fetchedCpmk : defaultCpmkList)
    } catch {
      setCplList(defaultCplList)
      setIkList(defaultIkList)
      setMkList(defaultMataKuliahList)
      setCpmkList(defaultCpmkList)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchVersions()
  }, [])

  useEffect(() => {
    if (selectedVersionId) {
      fetchCurriculumData(selectedVersionId)
    }
  }, [selectedVersionId])

  // Active version object
  const currentVersion = useMemo(() => {
    return versions.find((v) => v.id === selectedVersionId) || versions[0]
  }, [versions, selectedVersionId])

  // Stats calculation
  const stats = useMemo(() => {
    return {
      totalCpl: cplList.length,
      totalIk: ikList.length,
      totalMk: mkList.length,
      totalCpmk: cpmkList.length,
    }
  }, [cplList, ikList, mkList, cpmkList])

  // Helpers to toggle accordion
  const toggleCplAccordion = (id) => {
    setExpandedCplIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleMkAccordion = (id) => {
    setExpandedMkIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // --- VERSION ACTIONS ---
  const handleOpenAddVersion = () => {
    setVersionForm({ version_label: '', semester: 'Ganjil' })
    setIsVersionModalOpen(true)
  }

  const handleSaveVersion = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await api.post('/kurikulum/versions', versionForm).catch(() => null)
      const newVersion = res?.data || {
        id: Date.now(),
        ...versionForm,
        status: 'draft',
        created_at: new Date().toISOString(),
      }
      setVersions((prev) => [newVersion, ...prev])
      setSelectedVersionId(newVersion.id)
      setIsVersionModalOpen(false)
      pushToast(`Versi kurikulum ${newVersion.version_label} berhasil dibuat (Draft)`)
    } catch {
      pushToast('Gagal membuat versi kurikulum', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublishVersion = async () => {
    if (!currentVersion || currentVersion.status === 'published') return
    try {
      await api.post(`/kurikulum/versions/${currentVersion.id}/publish`).catch(() => {})
      setVersions((prev) =>
        prev.map((v) => (v.id === currentVersion.id ? { ...v, status: 'published', published_at: new Date().toISOString() } : v))
      )
      pushToast(`Kurikulum ${currentVersion.version_label} berhasil dipublikasikan`)
    } catch {
      pushToast('Gagal mempublikasikan kurikulum', 'error')
    }
  }

  // --- CPL ACTIONS ---
  const handleOpenAddCpl = () => {
    setEditingCpl(null)
    setCplForm({ kode: '', deskripsi: '', threshold_capaian: 70.0 })
    setIsCplModalOpen(true)
  }

  const handleOpenEditCpl = (cpl) => {
    setEditingCpl(cpl)
    setCplForm({
      kode: cpl.kode,
      deskripsi: cpl.deskripsi,
      threshold_capaian: cpl.threshold_capaian || 70.0,
    })
    setIsCplModalOpen(true)
  }

  const handleSaveCpl = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        kurikulum_version_id: selectedVersionId,
        kode: cplForm.kode,
        deskripsi: cplForm.deskripsi,
        threshold_capaian: Number(cplForm.threshold_capaian),
      }

      if (editingCpl) {
        await api.put(`/cpl/${editingCpl.id}`, payload).catch(() => {})
        setCplList((prev) => prev.map((item) => (item.id === editingCpl.id ? { ...item, ...payload } : item)))
        pushToast(`CPL ${cplForm.kode} berhasil diperbarui`)
      } else {
        const res = await api.post('/cpl', payload).catch(() => null)
        const newCpl = res?.data || { id: Date.now(), ...payload }
        setCplList((prev) => [...prev, newCpl])
        setExpandedCplIds((prev) => new Set([...prev, newCpl.id]))
        pushToast(`CPL ${cplForm.kode} berhasil ditambahkan`)
      }
      setIsCplModalOpen(false)
    } catch {
      pushToast('Gagal menyimpan CPL', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCpl = async (cplId, kode) => {
    if (!window.confirm(`Yakin ingin menghapus ${kode}? Semua IK di bawahnya akan terpengaruh.`)) return
    try {
      await api.delete(`/cpl/${cplId}`).catch(() => {})
      setCplList((prev) => prev.filter((item) => item.id !== cplId))
      setIkList((prev) => prev.filter((ik) => ik.cpl_id !== cplId))
      pushToast(`CPL ${kode} berhasil dihapus`)
    } catch {
      pushToast('Gagal menghapus CPL', 'error')
    }
  }

  // --- IK ACTIONS ---
  const handleOpenAddIk = (cpl) => {
    setTargetCplForIk(cpl)
    setEditingIk(null)
    const existingIks = ikList.filter((ik) => ik.cpl_id === cpl.id)
    setIkForm({
      kode: `${cpl.kode}.${existingIks.length + 1}`,
      deskripsi: '',
      urutan: existingIks.length + 1,
    })
    setIsIkModalOpen(true)
  }

  const handleOpenEditIk = (ik, cpl) => {
    setTargetCplForIk(cpl)
    setEditingIk(ik)
    setIkForm({
      kode: ik.kode,
      deskripsi: ik.deskripsi,
      urutan: ik.urutan || 1,
    })
    setIsIkModalOpen(true)
  }

  const handleSaveIk = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        cpl_id: targetCplForIk.id,
        kode: ikForm.kode,
        deskripsi: ikForm.deskripsi,
        urutan: Number(ikForm.urutan),
      }

      if (editingIk) {
        await api.put(`/ik/${editingIk.id}`, payload).catch(() => {})
        setIkList((prev) => prev.map((item) => (item.id === editingIk.id ? { ...item, ...payload } : item)))
        pushToast(`IK ${ikForm.kode} berhasil diperbarui`)
      } else {
        const res = await api.post('/ik', payload).catch(() => null)
        const newIk = res?.data || { id: Date.now(), ...payload }
        setIkList((prev) => [...prev, newIk])
        pushToast(`IK ${ikForm.kode} berhasil ditambahkan pada ${targetCplForIk.kode}`)
      }
      setIsIkModalOpen(false)
    } catch {
      pushToast('Gagal menyimpan IK', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteIk = async (ikId, kode) => {
    if (!window.confirm(`Yakin ingin menghapus ${kode}?`)) return
    try {
      await api.delete(`/ik/${ikId}`).catch(() => {})
      setIkList((prev) => prev.filter((item) => item.id !== ikId))
      pushToast(`IK ${kode} berhasil dihapus`)
    } catch {
      pushToast('Gagal menghapus IK', 'error')
    }
  }

  // --- MATA KULIAH ACTIONS ---
  const handleOpenAddMk = () => {
    setEditingMk(null)
    setMkForm({
      kode: '',
      nama: '',
      sks: 3,
      semester: 'Ganjil',
      tahun_ajaran: '2024/2025',
    })
    setIsMkModalOpen(true)
  }

  const handleOpenEditMk = (mk) => {
    setEditingMk(mk)
    setMkForm({
      kode: mk.kode,
      nama: mk.nama,
      sks: mk.sks,
      semester: mk.semester,
      tahun_ajaran: mk.tahun_ajaran,
    })
    setIsMkModalOpen(true)
  }

  const handleSaveMk = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        kurikulum_version_id: selectedVersionId,
        kode: mkForm.kode,
        nama: mkForm.nama,
        sks: Number(mkForm.sks),
        semester: mkForm.semester,
        tahun_ajaran: mkForm.tahun_ajaran,
      }

      if (editingMk) {
        await api.put(`/mata-kuliah/${editingMk.id}`, payload).catch(() => {})
        setMkList((prev) => prev.map((item) => (item.id === editingMk.id ? { ...item, ...payload } : item)))
        pushToast(`Mata kuliah ${mkForm.nama} berhasil diperbarui`)
      } else {
        const res = await api.post('/mata-kuliah', payload).catch(() => null)
        const newMk = res?.data || { id: Date.now(), ...payload }
        setMkList((prev) => [...prev, newMk])
        setExpandedMkIds((prev) => new Set([...prev, newMk.id]))
        pushToast(`Mata kuliah ${mkForm.nama} berhasil ditambahkan`)
      }
      setIsMkModalOpen(false)
    } catch {
      pushToast('Gagal menyimpan mata kuliah', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // --- CPMK ACTIONS ---
  const handleOpenAddCpmk = (mk) => {
    setTargetMkForCpmk(mk)
    setEditingCpmk(null)
    const existingCpmk = cpmkList.filter((c) => c.mata_kuliah_id === mk.id)
    setCpmkForm({
      kode: `CPMK-${String(existingCpmk.length + 1).padStart(2, '0')}`,
      deskripsi: '',
      level_taksonomi: 'C3',
      bobot: 20.0,
    })
    setIsCpmkModalOpen(true)
  }

  const handleOpenEditCpmk = (cpmk, mk) => {
    setTargetMkForCpmk(mk)
    setEditingCpmk(cpmk)
    setCpmkForm({
      kode: cpmk.kode,
      deskripsi: cpmk.deskripsi,
      level_taksonomi: cpmk.level_taksonomi || 'C3',
      bobot: cpmk.bobot,
    })
    setIsCpmkModalOpen(true)
  }

  const handleSaveCpmk = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        mata_kuliah_id: targetMkForCpmk.id,
        kode: cpmkForm.kode,
        deskripsi: cpmkForm.deskripsi,
        level_taksonomi: cpmkForm.level_taksonomi,
        bobot: Number(cpmkForm.bobot),
      }

      if (editingCpmk) {
        await api.put(`/cpmk/${editingCpmk.id}`, payload).catch(() => {})
        setCpmkList((prev) => prev.map((item) => (item.id === editingCpmk.id ? { ...item, ...payload } : item)))
        pushToast(`CPMK ${cpmkForm.kode} berhasil diperbarui`)
      } else {
        const res = await api.post('/cpmk', payload).catch(() => null)
        const newCpmk = res?.data || { id: Date.now(), ...payload, mappings: [] }
        setCpmkList((prev) => [...prev, newCpmk])
        pushToast(`CPMK ${cpmkForm.kode} berhasil ditambahkan pada ${targetMkForCpmk.kode}`)
      }
      setIsCpmkModalOpen(false)
    } catch {
      pushToast('Gagal menyimpan CPMK', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // --- CPMK -> IK MAPPING ACTIONS (WITH REALTIME VALIDATION) ---
  const handleOpenMappingModal = (cpmk) => {
    setTargetCpmkForMapping(cpmk)
    // Inisialisasi rows dari mapping existing jika ada
    const existing = cpmk.mappings || []
    if (existing.length > 0) {
      setMappingRows(existing.map((m) => ({ ik_id: m.ik_id, bobot: Number(m.bobot) })))
    } else {
      // Default baris kosong dengan IK pertama jika ada
      setMappingRows(ikList.length > 0 ? [{ ik_id: ikList[0].id, bobot: Number(cpmk.bobot) }] : [])
    }
    setIsMappingModalOpen(true)
  }

  const handleAddMappingRow = () => {
    if (ikList.length === 0) return
    const currentTotal = mappingRows.reduce((acc, row) => acc + (Number(row.bobot) || 0), 0)
    const remainingQuota = Math.max(0, Number(targetCpmkForMapping?.bobot || 0) - currentTotal)

    // Cari IK yang belum dipilih jika ada
    const chosenIds = new Set(mappingRows.map((r) => r.ik_id))
    const availableIk = ikList.find((ik) => !chosenIds.has(ik.id)) || ikList[0]

    setMappingRows((prev) => [...prev, { ik_id: availableIk.id, bobot: remainingQuota }])
  }

  const handleRemoveMappingRow = (index) => {
    setMappingRows((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateMappingRow = (index, field, value) => {
    setMappingRows((prev) =>
      prev.map((row, i) => {
        if (i === index) {
          return {
            ...row,
            [field]: field === 'bobot' ? Number(value) : Number(value),
          }
        }
        return row
      })
    )
  }

  // Real-time Mapping Calculation
  const mappingCalculation = useMemo(() => {
    if (!targetCpmkForMapping) return { total: 0, cpmkBobot: 0, remaining: 0, isExceeded: false, isValid: true }
    const cpmkBobot = Number(targetCpmkForMapping.bobot) || 0
    const total = mappingRows.reduce((acc, row) => acc + (Number(row.bobot) || 0), 0)
    const remaining = cpmkBobot - total
    const isExceeded = total > cpmkBobot
    const hasDuplicateIk = new Set(mappingRows.map((r) => r.ik_id)).size !== mappingRows.length
    const hasEmptyBobot = mappingRows.some((r) => !r.bobot || r.bobot <= 0)

    return {
      total: Math.round(total * 100) / 100,
      cpmkBobot,
      remaining: Math.round(remaining * 100) / 100,
      isExceeded,
      hasDuplicateIk,
      hasEmptyBobot,
      isValid: !isExceeded && !hasDuplicateIk && !hasEmptyBobot && mappingRows.length > 0,
    }
  }, [targetCpmkForMapping, mappingRows])

  const handleSaveMapping = async (e) => {
    e.preventDefault()
    if (!mappingCalculation.isValid) return
    setSubmitting(true)
    try {
      const payload = {
        mappings: mappingRows.map((r) => ({
          ik_id: r.ik_id,
          bobot: r.bobot,
        })),
      }

      await api.put(`/cpmk/${targetCpmkForMapping.id}/map-ik`, payload).catch(() => {})

      // Update state lokal
      setCpmkList((prev) =>
        prev.map((c) => (c.id === targetCpmkForMapping.id ? { ...c, mappings: payload.mappings } : c))
      )
      setIsMappingModalOpen(false)
      pushToast(`Pemetaan IK untuk ${targetCpmkForMapping.kode} berhasil disimpan`)
    } catch (err) {
      pushToast(err?.response?.data?.detail || 'Gagal menyimpan mapping IK', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Filtered Mata Kuliah
  const filteredMkList = useMemo(() => {
    return mkList.filter((mk) => {
      if (mkSemesterFilter === 'ALL') return true
      return mk.semester === mkSemesterFilter
    })
  }, [mkList, mkSemesterFilter])

  return (
    <div className="space-y-8 animate-[fadeUp_240ms_ease]">
      {/* Header Halaman */}
      <PageHeader
        eyebrow="Kurikulum OBE"
        title="Manajemen Kurikulum OBE"
        description="Konfigurasi capaian pembelajaran 3-level (CPL → IK → CPMK) beserta pemetaan mata kuliah berbasis Outcome-Based Education."
        badge={canEdit ? 'Mode Edit (Admin Prodi)' : 'Mode Lihat'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Version Selector */}
            <div className="flex items-center gap-2 rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-1.5 shadow-sm">
              <span className="text-xs font-semibold text-[#6D778E]">Versi:</span>
              <select
                value={selectedVersionId || ''}
                onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-[#142B4A] focus:outline-none cursor-pointer"
                data-testid="version-select"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_label} ({v.semester}) — {v.status.toUpperCase()}
                  </option>
                ))}
              </select>
              <Badge tone={currentVersion?.status === 'published' ? 'success' : 'warning'}>
                {currentVersion?.status === 'published' ? 'Published' : 'Draft'}
              </Badge>
            </div>

            {canEdit && currentVersion?.status === 'draft' && (
              <ActionButton
                variant="secondary"
                onClick={handlePublishVersion}
                data-testid="publish-version-btn"
                className="h-9 text-xs"
              >
                <Send className="h-3.5 w-3.5 text-[#1A3A6B]" />
                <span>Publikasikan Versi Ini</span>
              </ActionButton>
            )}

            {canEdit && (
              <ActionButton
                onClick={handleOpenAddVersion}
                data-testid="add-version-btn"
                className="h-9 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Versi Baru</span>
              </ActionButton>
            )}
          </div>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Capaian Pembelajaran (CPL)"
          value={stats.totalCpl}
          caption="Level Program Studi"
          icon={<Award className="h-4 w-4" />}
        />
        <StatCard
          label="Indikator Kinerja (IK)"
          value={stats.totalIk}
          caption="Titik Ukur Terverifikasi"
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label="Mata Kuliah Terpetakan"
          value={stats.totalMk}
          caption={`Semester ${currentVersion?.semester || 'Aktif'}`}
          icon={<BookOpen className="h-4 w-4" />}
        />
        <StatCard
          label="CPMK Aktif"
          value={stats.totalCpmk}
          caption="Course Learning Outcomes"
          icon={<Layers className="h-4 w-4" />}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-[#E2E8F0] gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('cpl')}
          className={`flex items-center gap-2 pb-3.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === 'cpl'
              ? 'border-[#1A3A6B] text-[#1A3A6B]'
              : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
          }`}
          data-testid="tab-cpl"
        >
          <Award className="h-4 w-4" />
          <span>CPL & Indikator Kinerja (IK)</span>
          <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[10px] text-[#142B4A] font-bold">
            {cplList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mk')}
          className={`flex items-center gap-2 pb-3.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === 'mk'
              ? 'border-[#1A3A6B] text-[#1A3A6B]'
              : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
          }`}
          data-testid="tab-mk"
        >
          <BookOpen className="h-4 w-4" />
          <span>Mata Kuliah & CPMK</span>
          <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[10px] text-[#142B4A] font-bold">
            {mkList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 pb-3.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === 'matrix'
              ? 'border-[#1A3A6B] text-[#1A3A6B]'
              : 'border-transparent text-[#64748B] hover:text-[#142B4A]'
          }`}
          data-testid="tab-matrix"
        >
          <Layers className="h-4 w-4" />
          <span>Matriks Pemetaan CPMK → IK</span>
        </button>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-24 text-xs text-[#64748B]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#1A3A6B]" />
          Memuat struktur kurikulum...
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* TAB 1: CPL & INDIKATOR KINERJA (IK) */}
          {/* ============================================================== */}
          {activeTab === 'cpl' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#142B4A]">
                    Daftar Capaian Pembelajaran Lulusan (Level 1 & 2)
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Klik pada kartu CPL untuk melihat dan mengelola Indikator Kinerja (IK) pendukung di bawahnya.
                  </p>
                </div>
                {canEdit && (
                  <ActionButton onClick={handleOpenAddCpl} data-testid="btn-add-cpl" className="h-8 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah CPL</span>
                  </ActionButton>
                )}
              </div>

              {cplList.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[#CBD5E1] p-12 text-center text-xs text-[#64748B]">
                  Belum ada CPL untuk versi kurikulum ini. Silakan tambahkan CPL pertama Anda.
                </div>
              ) : (
                <div className="space-y-4">
                  {cplList.map((cpl) => {
                    const isExpanded = expandedCplIds.has(cpl.id)
                    const relatedIks = ikList
                      .filter((ik) => ik.cpl_id === cpl.id)
                      .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))

                    return (
                      <div
                        key={cpl.id}
                        className="rounded-[8px] border border-[#E2E8F0] bg-white transition-shadow shadow-sm hover:border-[#CBD5E1]"
                      >
                        {/* CPL Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-[#F2F4F7]">
                          <div
                            className="flex items-start gap-3 cursor-pointer flex-1"
                            onClick={() => toggleCplAccordion(cpl.id)}
                            data-testid={`cpl-card-${cpl.id}`}
                          >
                            <button
                              type="button"
                              className="mt-0.5 rounded p-1 text-[#64748B] hover:bg-[#F2F4F7] transition-colors"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[#1A3A6B] bg-[#1A3A6B]/10 px-2 py-0.5 rounded">
                                  {cpl.kode}
                                </span>
                                <Badge tone="default">Target Capaian: {cpl.threshold_capaian}%</Badge>
                                <span className="text-[11px] text-[#64748B]">
                                  {relatedIks.length} Indikator Kinerja
                                </span>
                              </div>
                              {/* Sesuai Poin 1: deskripsi digunakan apa adanya sebagai label utama */}
                              <p className="text-xs font-medium text-[#142B4A] leading-relaxed max-w-4xl">
                                {cpl.deskripsi}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons for CPL */}
                          {canEdit && (
                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenAddIk(cpl)}
                                className="inline-flex h-7 items-center gap-1 rounded-[4px] border border-[#1A3A6B] bg-white px-2 text-[11px] font-semibold text-[#1A3A6B] hover:bg-[#1A3A6B]/5 transition-colors"
                                data-testid={`btn-add-ik-${cpl.id}`}
                              >
                                <Plus className="h-3 w-3" />
                                <span>Tambah IK</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditCpl(cpl)}
                                aria-label="Edit CPL"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#CBD5E1] text-[#64748B] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                                data-testid={`btn-edit-cpl-${cpl.id}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCpl(cpl.id, cpl.kode)}
                                aria-label="Hapus CPL"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] border border-red-200 text-red-600 hover:bg-red-50"
                                data-testid={`btn-delete-cpl-${cpl.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* IK Nested List */}
                        {isExpanded && (
                          <div className="p-4 bg-[#F8FAFC]/50">
                            {relatedIks.length === 0 ? (
                              <div className="py-6 text-center text-xs text-[#94A3B8] border border-dashed border-[#E2E8F0] rounded-[6px]">
                                Belum ada Indikator Kinerja untuk {cpl.kode}. Klik tombol "+ Tambah IK" di atas.
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs bg-white rounded-[6px] border border-[#E2E8F0]">
                                  <thead>
                                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                                      <th className="py-2.5 px-3 font-semibold w-16">Urutan</th>
                                      <th className="py-2.5 px-3 font-semibold w-24">Kode IK</th>
                                      <th className="py-2.5 px-3 font-semibold">Deskripsi Indikator Kinerja</th>
                                      {canEdit && <th className="py-2.5 px-3 font-semibold text-right w-24">Aksi</th>}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#F2F4F7]">
                                    {relatedIks.map((ik) => (
                                      <tr key={ik.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                                        <td className="py-2.5 px-3 text-[#64748B] font-mono">{ik.urutan || '-'}</td>
                                        <td className="py-2.5 px-3 font-mono font-bold text-[#142B4A]">{ik.kode}</td>
                                        <td className="py-2.5 px-3 text-[#142B4A] leading-relaxed">{ik.deskripsi}</td>
                                        {canEdit && (
                                          <td className="py-2.5 px-3 text-right">
                                            <div className="inline-flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => handleOpenEditIk(ik, cpl)}
                                                className="p-1 rounded text-[#64748B] hover:text-[#1A3A6B]"
                                                data-testid={`btn-edit-ik-${ik.id}`}
                                              >
                                                <Edit2 className="h-3 w-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteIk(ik.id, ik.kode)}
                                                className="p-1 rounded text-red-500 hover:text-red-700"
                                                data-testid={`btn-delete-ik-${ik.id}`}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: MATA KULIAH & CPMK */}
          {/* ============================================================== */}
          {activeTab === 'mk' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-[#142B4A]">
                    Daftar Mata Kuliah & Capaian Pembelajaran MK (Level 3)
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Definisikan CPMK untuk setiap mata kuliah dan atur bobot evaluasi akademik.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={mkSemesterFilter}
                    onChange={(e) => setMkSemesterFilter(e.target.value)}
                    className="h-8 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs font-medium text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none cursor-pointer"
                    data-testid="filter-semester-mk"
                  >
                    <option value="ALL">Semua Semester</option>
                    <option value="Ganjil">Semester Ganjil</option>
                    <option value="Genap">Semester Genap</option>
                  </select>

                  {canEdit && (
                    <ActionButton onClick={handleOpenAddMk} data-testid="btn-add-mk" className="h-8 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah Mata Kuliah</span>
                    </ActionButton>
                  )}
                </div>
              </div>

              {filteredMkList.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[#CBD5E1] p-12 text-center text-xs text-[#64748B]">
                  Tidak ada mata kuliah yang terdaftar dengan filter ini.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredMkList.map((mk) => {
                    const isExpanded = expandedMkIds.has(mk.id)
                    const relatedCpmk = cpmkList.filter((c) => c.mata_kuliah_id === mk.id)
                    const totalCpmkBobot = relatedCpmk.reduce((acc, c) => acc + (Number(c.bobot) || 0), 0)

                    return (
                      <div
                        key={mk.id}
                        className="rounded-[8px] border border-[#E2E8F0] bg-white transition-shadow shadow-sm"
                      >
                        {/* MK Header Card */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-[#F2F4F7]">
                          <div
                            className="flex items-start gap-3 cursor-pointer flex-1"
                            onClick={() => toggleMkAccordion(mk.id)}
                            data-testid={`mk-card-${mk.id}`}
                          >
                            <button
                              type="button"
                              className="mt-0.5 rounded p-1 text-[#64748B] hover:bg-[#F2F4F7] transition-colors"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[#142B4A] bg-[#F2F4F7] px-2 py-0.5 rounded">
                                  {mk.kode}
                                </span>
                                <span className="text-xs font-bold text-[#142B4A]">{mk.nama}</span>
                                <Badge tone="default">{mk.sks} SKS</Badge>
                                <Badge tone="warning">Semester {mk.semester}</Badge>
                                <span className="text-[11px] text-[#64748B]">TA {mk.tahun_ajaran}</span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
                                <span>{relatedCpmk.length} CPMK Terdaftar</span>
                                <span>•</span>
                                <span>Total Bobot CPMK: {totalCpmkBobot}%</span>
                              </div>
                            </div>
                          </div>

                          {/* MK Actions */}
                          {canEdit && (
                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenAddCpmk(mk)}
                                className="inline-flex h-7 items-center gap-1 rounded-[4px] border border-[#1A3A6B] bg-white px-2 text-[11px] font-semibold text-[#1A3A6B] hover:bg-[#1A3A6B]/5 transition-colors"
                                data-testid={`btn-add-cpmk-${mk.id}`}
                              >
                                <Plus className="h-3 w-3" />
                                <span>Tambah CPMK</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditMk(mk)}
                                aria-label="Edit Mata Kuliah"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#CBD5E1] text-[#64748B] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                                data-testid={`btn-edit-mk-${mk.id}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* CPMK Nested List */}
                        {isExpanded && (
                          <div className="p-4 bg-[#F8FAFC]/50">
                            {relatedCpmk.length === 0 ? (
                              <div className="py-6 text-center text-xs text-[#94A3B8] border border-dashed border-[#E2E8F0] rounded-[6px]">
                                Belum ada CPMK untuk mata kuliah ini. Klik "+ Tambah CPMK" di atas.
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs bg-white rounded-[6px] border border-[#E2E8F0]">
                                  <thead>
                                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[10px] uppercase tracking-[0.14em] text-[#6D778E]">
                                      <th className="py-2.5 px-3 font-semibold w-24">Kode</th>
                                      <th className="py-2.5 px-3 font-semibold">Deskripsi Capaian Mata Kuliah</th>
                                      <th className="py-2.5 px-3 font-semibold w-24">Taksonomi</th>
                                      <th className="py-2.5 px-3 font-semibold w-24">Bobot</th>
                                      <th className="py-2.5 px-3 font-semibold w-36">IK Terpetakan</th>
                                      <th className="py-2.5 px-3 font-semibold text-right w-36">Aksi</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#F2F4F7]">
                                    {relatedCpmk.map((cpmk) => {
                                      const mappedIks = cpmk.mappings || []

                                      return (
                                        <tr key={cpmk.id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                                          <td className="py-2.5 px-3 font-mono font-bold text-[#142B4A]">
                                            {cpmk.kode}
                                          </td>
                                          <td className="py-2.5 px-3 text-[#142B4A] leading-relaxed">
                                            {cpmk.deskripsi}
                                          </td>
                                          <td className="py-2.5 px-3">
                                            <span className="rounded bg-[#E2E8F0] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#142B4A]">
                                              {cpmk.level_taksonomi || 'C3'}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-3 font-bold text-[#142B4A]">{cpmk.bobot}%</td>
                                          <td className="py-2.5 px-3">
                                            {mappedIks.length > 0 ? (
                                              <div className="flex flex-wrap gap-1">
                                                {mappedIks.map((m, idx) => {
                                                  const ikObj = ikList.find((ik) => ik.id === m.ik_id)
                                                  return (
                                                    <span
                                                      key={idx}
                                                      className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-800"
                                                      title={`Bobot IK: ${m.bobot}%`}
                                                    >
                                                      {ikObj?.kode || `IK #${m.ik_id}`} ({m.bobot}%)
                                                    </span>
                                                  )
                                                })}
                                              </div>
                                            ) : (
                                              <span className="text-[11px] text-amber-600 font-medium">
                                                Belum dipetakan
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2.5 px-3 text-right">
                                            <div className="inline-flex items-center gap-1.5">
                                              {canEdit && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenMappingModal(cpmk)}
                                                  className="inline-flex items-center gap-1 rounded border border-[#1A3A6B] bg-white px-2 py-1 text-[10px] font-semibold text-[#1A3A6B] hover:bg-[#1A3A6B]/5 transition-colors"
                                                  data-testid={`btn-map-ik-${cpmk.id}`}
                                                >
                                                  <Layers className="h-3 w-3" />
                                                  <span>Map IK</span>
                                                </button>
                                              )}
                                              {canEdit && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenEditCpmk(cpmk, mk)}
                                                  className="p-1 rounded text-[#64748B] hover:text-[#1A3A6B]"
                                                  data-testid={`btn-edit-cpmk-${cpmk.id}`}
                                                >
                                                  <Edit2 className="h-3 w-3" />
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: MATRIKS PEMETAAN CPMK -> IK */}
          {/* ============================================================== */}
          {activeTab === 'matrix' && (
            <SectionCard
              title="Matriks Pemetaan CPMK ke Indikator Kinerja (IK)"
              description="Visualisasi hubungan antara capaian pembelajaran mata kuliah (CPMK) dan indikator kinerja (IK) program studi."
            >
              {cpmkList.length === 0 || ikList.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#64748B]">
                  Perlu melengkapi data CPL, IK, dan CPMK terlebih dahulu untuk melihat matriks pemetaan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#CBD5E1] bg-[#F8FAFC] text-[10px] uppercase tracking-wider text-[#6D778E]">
                        <th className="p-3 border-r border-[#E2E8F0] font-semibold">Mata Kuliah</th>
                        <th className="p-3 border-r border-[#E2E8F0] font-semibold">CPMK</th>
                        <th className="p-3 border-r border-[#E2E8F0] font-semibold">Bobot CPMK</th>
                        {ikList.map((ik) => (
                          <th key={ik.id} className="p-2 border-r border-[#E2E8F0] text-center font-semibold w-16">
                            <div className="font-mono">{ik.kode}</div>
                          </th>
                        ))}
                        {canEdit && <th className="p-3 text-center font-semibold">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {cpmkList.map((cpmk) => {
                        const mk = mkList.find((m) => m.id === cpmk.mata_kuliah_id)
                        const mapDict = (cpmk.mappings || []).reduce((acc, m) => {
                          acc[m.ik_id] = m.bobot
                          return acc
                        }, {})

                        return (
                          <tr key={cpmk.id} className="hover:bg-[#F8FAFC]/80">
                            <td className="p-3 border-r border-[#E2E8F0] font-medium text-[#142B4A]">
                              {mk?.kode || '-'} {mk?.nama ? `— ${mk.nama}` : ''}
                            </td>
                            <td className="p-3 border-r border-[#E2E8F0] font-mono font-bold text-[#1A3A6B]">
                              {cpmk.kode}
                            </td>
                            <td className="p-3 border-r border-[#E2E8F0] font-bold text-[#142B4A]">
                              {cpmk.bobot}%
                            </td>
                            {ikList.map((ik) => {
                              const weight = mapDict[ik.id]
                              return (
                                <td
                                  key={ik.id}
                                  className={`p-2 border-r border-[#E2E8F0] text-center font-mono text-xs ${
                                    weight
                                      ? 'bg-emerald-50 text-emerald-800 font-bold'
                                      : 'text-[#CBD5E1]'
                                  }`}
                                >
                                  {weight ? `${weight}%` : '—'}
                                </td>
                              )
                            })}
                            {canEdit && (
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenMappingModal(cpmk)}
                                  className="inline-flex items-center gap-1 rounded border border-[#CBD5E1] px-2 py-1 text-[11px] font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B]"
                                >
                                  <Edit2 className="h-3 w-3" />
                                  <span>Edit Map</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}
        </>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: VERSI KURIKULUM BARU */}
      {/* ============================================================== */}
      <Modal open={isVersionModalOpen} title="Buat Versi Kurikulum Baru" onClose={() => setIsVersionModalOpen(false)}>
        <form onSubmit={handleSaveVersion} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Label Versi Kurikulum</span>
            <input
              type="text"
              required
              className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              placeholder="Contoh: Kurikulum OBE 2025"
              value={versionForm.version_label}
              onChange={(e) => setVersionForm((prev) => ({ ...prev, version_label: e.target.value }))}
              data-testid="modal-version-label"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Semester Awal Berlaku</span>
            <select
              value={versionForm.semester}
              onChange={(e) => setVersionForm((prev) => ({ ...prev, semester: e.target.value }))}
              className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs font-medium text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none cursor-pointer"
              data-testid="modal-version-semester"
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </label>

          <p className="text-[11px] text-[#64748B]">
            Versi kurikulum baru akan dibuat dengan status <span className="font-semibold text-amber-700">Draft</span>.
            Anda dapat mempublikasikannya setelah seluruh CPL, IK, dan CPMK terkonfigurasi.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <ActionButton type="button" variant="secondary" onClick={() => setIsVersionModalOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" disabled={submitting} data-testid="modal-version-submit">
              {submitting ? 'Menyimpan...' : 'Buat Versi'}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 2: CPL (TAMBAH / EDIT) */}
      {/* ============================================================== */}
      <Modal
        open={isCplModalOpen}
        title={editingCpl ? `Edit Capaian Pembelajaran Lulusan (${editingCpl.kode})` : 'Tambah CPL Baru'}
        onClose={() => setIsCplModalOpen(false)}
      >
        <form onSubmit={handleSaveCpl} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Kode CPL</span>
            <input
              type="text"
              required
              className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs font-mono text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              placeholder="Contoh: CPL-01 atau CPL-A"
              value={cplForm.kode}
              onChange={(e) => setCplForm((prev) => ({ ...prev, kode: e.target.value }))}
              data-testid="modal-cpl-kode"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Deskripsi CPL (Judul/Pernyataan Capaian)</span>
            <textarea
              required
              rows={4}
              className="w-full rounded-[6px] border border-[#CBD5E1] bg-white p-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none leading-relaxed"
              placeholder="Mampu menganalisis dan merancang..."
              value={cplForm.deskripsi}
              onChange={(e) => setCplForm((prev) => ({ ...prev, deskripsi: e.target.value }))}
              data-testid="modal-cpl-deskripsi"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Threshold Capaian (%)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              required
              className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              placeholder="70.0"
              value={cplForm.threshold_capaian}
              onChange={(e) => setCplForm((prev) => ({ ...prev, threshold_capaian: e.target.value }))}
              data-testid="modal-cpl-threshold"
            />
            <p className="text-[11px] text-[#64748B]">Batas minimal persentase mahasiswa memenuhi CPL.</p>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <ActionButton type="button" variant="secondary" onClick={() => setIsCplModalOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" disabled={submitting} data-testid="modal-cpl-submit">
              {submitting ? 'Menyimpan...' : 'Simpan CPL'}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 3: IK (TAMBAH / EDIT) */}
      {/* ============================================================== */}
      <Modal
        open={isIkModalOpen}
        title={editingIk ? `Edit Indikator Kinerja (${editingIk.kode})` : `Tambah IK untuk ${targetCplForIk?.kode}`}
        onClose={() => setIsIkModalOpen(false)}
      >
        <form onSubmit={handleSaveIk} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">Kode IK</span>
              <input
                type="text"
                required
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs font-mono text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                placeholder="Contoh: IK-01.1"
                value={ikForm.kode}
                onChange={(e) => setIkForm((prev) => ({ ...prev, kode: e.target.value }))}
                data-testid="modal-ik-kode"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">Urutan Tampil</span>
              <input
                type="number"
                min="1"
                required
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                value={ikForm.urutan}
                onChange={(e) => setIkForm((prev) => ({ ...prev, urutan: e.target.value }))}
                data-testid="modal-ik-urutan"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Deskripsi Indikator Kinerja</span>
            <textarea
              required
              rows={4}
              className="w-full rounded-[6px] border border-[#CBD5E1] bg-white p-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none leading-relaxed"
              placeholder="Indikator terukur yang membuktikan ketercapaian CPL..."
              value={ikForm.deskripsi}
              onChange={(e) => setIkForm((prev) => ({ ...prev, deskripsi: e.target.value }))}
              data-testid="modal-ik-deskripsi"
            />
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <ActionButton type="button" variant="secondary" onClick={() => setIsIkModalOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" disabled={submitting} data-testid="modal-ik-submit">
              {submitting ? 'Menyimpan...' : 'Simpan IK'}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 4: MATA KULIAH (TAMBAH / EDIT) */}
      {/* ============================================================== */}
      <Modal
        open={isMkModalOpen}
        title={editingMk ? `Edit Mata Kuliah (${editingMk.kode})` : 'Tambah Mata Kuliah Baru'}
        onClose={() => setIsMkModalOpen(false)}
      >
        <form onSubmit={handleSaveMk} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <label className="block space-y-1 col-span-1">
              <span className="text-xs font-semibold text-[#142B4A]">Kode MK</span>
              <input
                type="text"
                required
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs font-mono text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                placeholder="TK2101"
                value={mkForm.kode}
                onChange={(e) => setMkForm((prev) => ({ ...prev, kode: e.target.value }))}
                data-testid="modal-mk-kode"
              />
            </label>

            <label className="block space-y-1 col-span-2">
              <span className="text-xs font-semibold text-[#142B4A]">Nama Mata Kuliah</span>
              <input
                type="text"
                required
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                placeholder="Algoritma & Struktur Data"
                value={mkForm.nama}
                onChange={(e) => setMkForm((prev) => ({ ...prev, nama: e.target.value }))}
                data-testid="modal-mk-nama"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">Bobot SKS</span>
              <input
                type="number"
                min="1"
                max="8"
                required
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                value={mkForm.sks}
                onChange={(e) => setMkForm((prev) => ({ ...prev, sks: e.target.value }))}
                data-testid="modal-mk-sks"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">Semester</span>
              <select
                value={mkForm.semester}
                onChange={(e) => setMkForm((prev) => ({ ...prev, semester: e.target.value }))}
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs font-medium text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none cursor-pointer"
                data-testid="modal-mk-semester"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">Tahun Ajaran</span>
              <input
                type="text"
                required
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                placeholder="2024/2025"
                value={mkForm.tahun_ajaran}
                onChange={(e) => setMkForm((prev) => ({ ...prev, tahun_ajaran: e.target.value }))}
                data-testid="modal-mk-ta"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <ActionButton type="button" variant="secondary" onClick={() => setIsMkModalOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" disabled={submitting} data-testid="modal-mk-submit">
              {submitting ? 'Menyimpan...' : 'Simpan Mata Kuliah'}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 5: CPMK (TAMBAH / EDIT) */}
      {/* ============================================================== */}
      <Modal
        open={isCpmkModalOpen}
        title={editingCpmk ? `Edit CPMK (${editingCpmk.kode})` : `Tambah CPMK untuk ${targetMkForCpmk?.kode}`}
        onClose={() => setIsCpmkModalOpen(false)}
      >
        <form onSubmit={handleSaveCpmk} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">Kode CPMK</span>
              <input
                type="text"
                required
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs font-mono text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                placeholder="CPMK-01"
                value={cpmkForm.kode}
                onChange={(e) => setCpmkForm((prev) => ({ ...prev, kode: e.target.value }))}
                data-testid="modal-cpmk-kode"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">Taksonomi Bloom</span>
              <input
                type="text"
                required
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                placeholder="Contoh: C3, C4, A2"
                value={cpmkForm.level_taksonomi}
                onChange={(e) => setCpmkForm((prev) => ({ ...prev, level_taksonomi: e.target.value }))}
                data-testid="modal-cpmk-taksonomi"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[#142B4A]">Bobot (%)</span>
              <input
                type="number"
                step="0.1"
                min="1"
                max="100"
                required
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                value={cpmkForm.bobot}
                onChange={(e) => setCpmkForm((prev) => ({ ...prev, bobot: e.target.value }))}
                data-testid="modal-cpmk-bobot"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#142B4A]">Deskripsi CPMK</span>
            <textarea
              required
              rows={4}
              className="w-full rounded-[6px] border border-[#CBD5E1] bg-white p-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none leading-relaxed"
              placeholder="Setelah menyelesaikan mata kuliah ini, mahasiswa mampu..."
              value={cpmkForm.deskripsi}
              onChange={(e) => setCpmkForm((prev) => ({ ...prev, deskripsi: e.target.value }))}
              data-testid="modal-cpmk-deskripsi"
            />
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <ActionButton type="button" variant="secondary" onClick={() => setIsCpmkModalOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton type="submit" disabled={submitting} data-testid="modal-cpmk-submit">
              {submitting ? 'Menyimpan...' : 'Simpan CPMK'}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 6: PEMETAAN CPMK -> IK (DENGAN REALTIME VALIDATION BOBOT) */}
      {/* ============================================================== */}
      <Modal
        open={isMappingModalOpen}
        title={`Petakan IK untuk ${targetCpmkForMapping?.kode}`}
        onClose={() => setIsMappingModalOpen(false)}
        size="max-w-2xl"
      >
        <form onSubmit={handleSaveMapping} className="space-y-4">
          <div className="rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[#142B4A]">Bobot Plafon CPMK:</span>
              <span className="font-bold text-sm text-[#1A3A6B]">{targetCpmkForMapping?.bobot}%</span>
            </div>
            <p className="text-[11px] text-[#64748B] leading-relaxed">
              {targetCpmkForMapping?.deskripsi}
            </p>
          </div>

          {/* Real-time Kuota Bar */}
          <div className="rounded-[6px] border border-[#E2E8F0] p-3 space-y-2 bg-white">
            <div className="flex justify-between text-xs font-semibold">
              <span>Alokasi Bobot IK:</span>
              <span
                className={
                  mappingCalculation.isExceeded
                    ? 'text-red-600 font-bold'
                    : mappingCalculation.remaining === 0
                    ? 'text-emerald-700 font-bold'
                    : 'text-amber-700 font-bold'
                }
              >
                {mappingCalculation.total}% / {mappingCalculation.cpmkBobot}%
              </span>
            </div>

            {/* Visual Indicator Bar */}
            <div className="h-2 w-full bg-[#EEF2F7] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  mappingCalculation.isExceeded
                    ? 'bg-red-500'
                    : mappingCalculation.remaining === 0
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (mappingCalculation.total / (mappingCalculation.cpmkBobot || 1)) * 100
                  )}%`,
                }}
              />
            </div>

            {/* Validation Feedback Messages */}
            {mappingCalculation.isExceeded && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Total bobot IK ({mappingCalculation.total}%) melebihi bobot CPMK ({mappingCalculation.cpmkBobot}%).
                  Harap kurangi alokasi bobot IK.
                </span>
              </div>
            )}

            {!mappingCalculation.isExceeded && mappingCalculation.remaining > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Tersisa kuota {mappingCalculation.remaining}% bobot yang belum dialokasikan ke IK (aturan backend
                  mengizinkan total &le; bobot CPMK).
                </span>
              </div>
            )}

            {!mappingCalculation.isExceeded && mappingCalculation.remaining === 0 && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>100% bobot CPMK teralokasikan secara optimal ke seluruh IK pendukung.</span>
              </div>
            )}
          </div>

          {/* List Mapping Rows */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#142B4A]">Indikator Kinerja yang Didukung:</span>
              <button
                type="button"
                onClick={handleAddMappingRow}
                disabled={mappingCalculation.isExceeded}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1A3A6B] hover:underline"
              >
                <Plus className="h-3 w-3" />
                <span>Tambah Baris IK</span>
              </button>
            </div>

            {mappingRows.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#94A3B8] border border-dashed border-[#CBD5E1] rounded-[6px]">
                Belum ada IK yang dipilih. Klik "+ Tambah Baris IK" untuk memetakan.
              </div>
            ) : (
              <div className="space-y-2">
                {mappingRows.map((row, index) => {
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2.5 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC]"
                    >
                      {/* IK Selector */}
                      <select
                        value={row.ik_id}
                        onChange={(e) => handleUpdateMappingRow(index, 'ik_id', e.target.value)}
                        className="flex-1 h-8 rounded border border-[#CBD5E1] bg-white px-2 text-xs font-medium text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                      >
                        {ikList.map((ik) => {
                          const cplParent = cplList.find((c) => c.id === ik.cpl_id)
                          return (
                            <option key={ik.id} value={ik.id}>
                              [{cplParent?.kode || 'CPL'}] {ik.kode} — {ik.deskripsi.slice(0, 50)}...
                            </option>
                          )
                        })}
                      </select>

                      {/* Bobot Input */}
                      <div className="flex items-center gap-1 w-28">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max={targetCpmkForMapping?.bobot || 100}
                          value={row.bobot}
                          onChange={(e) => handleUpdateMappingRow(index, 'bobot', e.target.value)}
                          className="h-8 w-20 rounded border border-[#CBD5E1] bg-white px-2 text-xs font-bold text-center text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
                        />
                        <span className="text-xs font-bold text-[#6D778E]">%</span>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveMappingRow(index)}
                        className="p-1 rounded text-red-500 hover:bg-red-50"
                        title="Hapus baris"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <ActionButton type="button" variant="secondary" onClick={() => setIsMappingModalOpen(false)}>
              Batal
            </ActionButton>
            <ActionButton
              type="submit"
              disabled={submitting || !mappingCalculation.isValid}
              data-testid="modal-mapping-submit"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Pemetaan IK'}
            </ActionButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
