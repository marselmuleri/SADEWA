import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Edit2,
  Network,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
} from 'lucide-react'
import { PageHeader, SectionCard, Badge, ActionButton } from '../../components/PageChrome'
import Modal from '../../components/Modal'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import useAuth from '../../hooks/useAuth'
import { getApiErrorMessage } from '../superAdminHelpers'

const TAXONOMY_OPTIONS = [
  { value: 'C1', label: 'C1 - Mengingat (Remember)' },
  { value: 'C2', label: 'C2 - Memahami (Understand)' },
  { value: 'C3', label: 'C3 - Menerapkan (Apply)' },
  { value: 'C4', label: 'C4 - Menganalisis (Analyze)' },
  { value: 'C5', label: 'C5 - Mengevaluasi (Evaluate)' },
  { value: 'C6', label: 'C6 - Menciptakan (Create)' },
]

export default function CpmkDetailPage() {
  const { mkId } = useParams()
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()
  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isAdminProdi = currentRole === 'admin_prodi'

  const [mk, setMk] = useState(null)
  const [cpmkList, setCpmkList] = useState([])
  const [cplList, setCplList] = useState([])
  const [ikList, setIkList] = useState([])
  const [cpmkMappings, setCpmkMappings] = useState({}) // cpmk_id -> list of { ik_id, bobot }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // CPMK Add / Edit Modal states
  const [isCpmkModalOpen, setIsCpmkModalOpen] = useState(false)
  const [editingCpmk, setEditingCpmk] = useState(null)
  const [cpmkFormKode, setCpmkFormKode] = useState('')
  const [cpmkFormDeskripsi, setCpmkFormDeskripsi] = useState('')
  const [cpmkFormLevel, setCpmkFormLevel] = useState('C3')
  const [cpmkFormBobot, setCpmkFormBobot] = useState(20.0)
  const [cpmkSubmitting, setCpmkSubmitting] = useState(false)

  // Mapping IK Modal states
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false)
  const [targetCpmkForMapping, setTargetCpmkForMapping] = useState(null)
  const [mappingWeights, setMappingWeights] = useState({}) // ik_id -> weight string/number
  const [loadingModalMapping, setLoadingModalMapping] = useState(false)
  const [mappingSubmitting, setMappingSubmitting] = useState(false)

  // Load MK, CPMK, CPL, IK, and existing mappings
  const loadData = async () => {
    if (!mkId) return
    setLoading(true)
    setError(null)
    try {
      const [mkRes, cpmkRes, cplRes, ikRes] = await Promise.all([
        api.get(`/mata-kuliah/${mkId}`),
        api.get('/cpmk', { params: { mata_kuliah_id: Number(mkId) } }),
        api.get('/cpl'),
        api.get('/ik'),
      ])

      const currentMk = mkRes.data
      const currentCpmks = Array.isArray(cpmkRes.data) ? cpmkRes.data : []
      const currentCpls = Array.isArray(cplRes.data) ? cplRes.data : []
      const currentIks = Array.isArray(ikRes.data) ? ikRes.data : []

      setMk(currentMk)
      setCpmkList(currentCpmks)
      setCplList(currentCpls)
      setIkList(currentIks)

      // Fetch mapping for each CPMK in this MK to determine linked CPLs
      const mappingDict = {}
      await Promise.all(
        currentCpmks.map(async (cpmk) => {
          try {
            const mapRes = await api.get(`/cpmk/${cpmk.id}/map-ik`)
            mappingDict[cpmk.id] = Array.isArray(mapRes.data) ? mapRes.data : []
          } catch {
            mappingDict[cpmk.id] = []
          }
        })
      )
      setCpmkMappings(mappingDict)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat detail mata kuliah dan CPMK'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [mkId])

  // Lookup maps for fast lookup
  const ikMap = useMemo(() => {
    const map = new Map()
    for (const ik of ikList) map.set(ik.id, ik)
    return map
  }, [ikList])

  const cplMap = useMemo(() => {
    const map = new Map()
    for (const c of cplList) map.set(c.id, c)
    return map
  }, [cplList])

  // Group IKs by CPL for Mapping Modal
  const iksGroupedByCpl = useMemo(() => {
    const groups = []
    for (const cpl of cplList) {
      const iks = ikList.filter((ik) => ik.cpl_id === cpl.id)
      if (iks.length > 0) {
        groups.push({ cpl, iks })
      }
    }
    return groups
  }, [cplList, ikList])

  // Calculate total bobot CPMK for this MK
  const totalBobotCpmk = useMemo(() => {
    const sum = cpmkList.reduce((acc, c) => acc + (Number(c.bobot) || 0), 0)
    return Math.round(sum * 100) / 100
  }, [cpmkList])

  // Helper to derive CPLs for a CPMK from mapped IKs
  const getDerivedCplCodes = (cpmkId) => {
    const maps = cpmkMappings[cpmkId] || []
    if (maps.length === 0) return '-'
    const cplCodes = new Set()
    for (const m of maps) {
      const ik = ikMap.get(m.ik_id)
      if (ik) {
        const cpl = cplMap.get(ik.cpl_id)
        if (cpl) cplCodes.add(cpl.kode)
      }
    }
    return cplCodes.size > 0 ? Array.from(cplCodes).join(', ') : '-'
  }

  // --- CPMK ADD / EDIT ---
  const handleOpenAddCpmk = () => {
    setEditingCpmk(null)
    const nextNum = String(cpmkList.length + 1).padStart(2, '0')
    setCpmkFormKode(`CPMK-${nextNum}`)
    setCpmkFormDeskripsi('')
    setCpmkFormLevel('C3')
    setCpmkFormBobot(20.0)
    setIsCpmkModalOpen(true)
  }

  const handleOpenEditCpmk = (cpmk) => {
    setEditingCpmk(cpmk)
    setCpmkFormKode(cpmk.kode || '')
    setCpmkFormDeskripsi(cpmk.deskripsi || '')
    setCpmkFormLevel(cpmk.level_taksonomi || 'C3')
    setCpmkFormBobot(Number(cpmk.bobot) || 0)
    setIsCpmkModalOpen(true)
  }

  const handleSaveCpmk = async (e) => {
    e.preventDefault()
    setCpmkSubmitting(true)
    try {
      const payload = {
        mata_kuliah_id: Number(mkId),
        kode: cpmkFormKode.trim(),
        deskripsi: cpmkFormDeskripsi.trim(),
        level_taksonomi: cpmkFormLevel,
        bobot: Number(cpmkFormBobot),
      }

      if (editingCpmk) {
        await api.put(`/cpmk/${editingCpmk.id}`, payload)
        pushToast(`CPMK ${cpmkFormKode} berhasil diperbarui`)
      } else {
        await api.post('/cpmk', payload)
        pushToast(`CPMK ${cpmkFormKode} berhasil ditambahkan`)
      }

      setIsCpmkModalOpen(false)
      await loadData()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan CPMK'), 'error')
    } finally {
      setCpmkSubmitting(false)
    }
  }

  // --- MAPPING IK MODAL ---
  const handleOpenMappingModal = async (cpmk) => {
    setTargetCpmkForMapping(cpmk)
    setLoadingModalMapping(true)
    setIsMappingModalOpen(true)

    // Load existing mapping from backend
    try {
      const res = await api.get(`/cpmk/${cpmk.id}/map-ik`)
      const existing = Array.isArray(res.data) ? res.data : []
      const weightDict = {}
      for (const m of existing) {
        weightDict[m.ik_id] = Number(m.bobot)
      }
      setMappingWeights(weightDict)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal memuat pemetaan IK yang ada'), 'error')
      setMappingWeights({})
    } finally {
      setLoadingModalMapping(false)
    }
  }

  // Real-time Mapping Calculation in modal
  const mappingCalculation = useMemo(() => {
    if (!targetCpmkForMapping) return { total: 0, cpmkBobot: 0, isExceeded: false, isValid: true }
    const cpmkBobot = Number(targetCpmkForMapping.bobot) || 0
    let total = 0
    for (const ikId in mappingWeights) {
      const val = Number(mappingWeights[ikId])
      if (val > 0) total += val
    }
    total = Math.round(total * 100) / 100
    const isExceeded = total > cpmkBobot
    return {
      total,
      cpmkBobot,
      isExceeded,
      isValid: !isExceeded,
    }
  }, [targetCpmkForMapping, mappingWeights])

  const handleWeightChange = (ikId, value) => {
    const num = value === '' ? '' : Math.max(0, Number(value))
    setMappingWeights((prev) => ({
      ...prev,
      [ikId]: num,
    }))
  }

  const handleSaveMapping = async (e) => {
    e.preventDefault()
    if (!mappingCalculation.isValid || !targetCpmkForMapping) return
    setMappingSubmitting(true)

    // Compile active mappings with bobot > 0
    const activeMappings = []
    for (const ikId in mappingWeights) {
      const val = Number(mappingWeights[ikId])
      if (val > 0) {
        activeMappings.push({
          ik_id: Number(ikId),
          bobot: val,
        })
      }
    }

    try {
      await api.put(`/cpmk/${targetCpmkForMapping.id}/map-ik`, {
        mappings: activeMappings,
      })
      pushToast(`Pemetaan IK untuk ${targetCpmkForMapping.kode} berhasil disimpan`)
      setIsMappingModalOpen(false)
      await loadData()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan pemetaan IK'), 'error')
    } finally {
      setMappingSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tombol Kembali & Breadcrumb Header */}
      <div className="flex items-center gap-2">
        <Link
          to="/kurikulum/cpmk"
          data-testid="back-to-cpmk-mk-list"
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Daftar Mata Kuliah</span>
        </Link>
      </div>

      <PageHeader
        eyebrow="KONFIGURASI CPMK MATA KULIAH"
        title={mk ? `${mk.kode} — ${mk.nama}` : 'Capaian Pembelajaran Mata Kuliah'}
        description="Kelola butir-butir CPMK pada mata kuliah ini dan petakan kontribusi bobot penilaian ke masing-masing Indikator Kinerja (IK)."
        badge={isAdminProdi ? 'Admin Prodi' : 'Mode Lihat'}
        actions={
          isAdminProdi ? (
            <ActionButton
              onClick={handleOpenAddCpmk}
              data-testid="add-cpmk-button"
              className="bg-[#1A3A6B] text-white hover:bg-[#142B4A]"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah CPMK</span>
            </ActionButton>
          ) : null
        }
      />

      {error && (
        <div className="flex items-center gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Ringkasan Mata Kuliah Card */}
      {mk && (
        <div className="rounded-[8px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-base text-[#1A3A6B]">{mk.kode}</span>
                <span className="text-sm font-semibold text-[#142B4A]">{mk.nama}</span>
              </div>
              <p className="text-xs text-[#64748B]">
                Tahun Ajaran: <strong className="text-[#142B4A] font-mono">{mk.tahun_ajaran || '-'}</strong> · Semester:{' '}
                <strong className="text-[#142B4A]">{mk.semester}</strong>
              </p>
            </div>

            <div className="flex items-center gap-6 shrink-0 border-t md:border-t-0 md:border-l border-[#E2E8F0] pt-3 md:pt-0 md:pl-6">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#6D778E] block">Beban SKS</span>
                <span className="text-lg font-bold text-[#142B4A] font-mono">{mk.sks} SKS</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#6D778E] block">Jumlah CPMK</span>
                <span className="text-lg font-bold text-[#142B4A] font-mono">{cpmkList.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Indikator Total Bobot CPMK Real-Time (Warning Non-Blocking jika != 100) */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[8px] border p-4 text-xs transition-colors ${
          totalBobotCpmk === 100
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
        data-testid="cpmk-total-bobot-indicator"
      >
        <div className="flex items-center gap-2.5">
          {totalBobotCpmk === 100 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          )}
          <div>
            <span className="font-bold">Total Bobot CPMK: {totalBobotCpmk}%</span>
            {totalBobotCpmk !== 100 && (
              <span className="ml-1 text-[11px] text-amber-700">
                (Total bobot CPMK idealnya 100%. Anda tetap dapat menyimpan konfigurasi ini sesuai kebutuhan kurikulum).
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono font-bold text-sm">{totalBobotCpmk} / 100%</span>
        </div>
      </div>

      {/* Tabel CPMK */}
      <SectionCard
        title="Daftar Capaian Pembelajaran Mata Kuliah (CPMK)"
        description={`Terdapat ${cpmkList.length} butir CPMK yang telah dirumuskan untuk mata kuliah ini.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs" data-testid="cpmk-table">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#6D778E]">
                <th className="py-3 px-4 w-28">CPL Terkait</th>
                <th className="py-3 px-4 w-28">Kode CPMK</th>
                <th className="py-3 px-4">Deskripsi CPMK</th>
                <th className="py-3 px-4 text-center w-28">Taksonomi</th>
                <th className="py-3 px-4 text-right w-24">Bobot</th>
                <th className="py-3 px-4 text-right w-44">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#64748B]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                      <span>Memuat butir CPMK...</span>
                    </div>
                  </td>
                </tr>
              ) : cpmkList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#94A3B8]" data-testid="empty-cpmk">
                    Belum ada CPMK yang dibuat untuk mata kuliah ini.
                  </td>
                </tr>
              ) : (
                cpmkList.map((cpmk) => {
                  const derivedCpl = getDerivedCplCodes(cpmk.id)
                  const hasMapping = derivedCpl !== '-'
                  return (
                    <tr
                      key={cpmk.id}
                      className="transition-colors hover:bg-[#F8FAFC]"
                      data-testid={`cpmk-row-${cpmk.id}`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-[#1A3A6B]">
                        {hasMapping ? (
                          <span className="inline-flex rounded-[4px] bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-800">
                            {derivedCpl}
                          </span>
                        ) : (
                          <span className="text-[#94A3B8] italic">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#142B4A]">{cpmk.kode}</td>
                      <td className="py-3 px-4 text-[#142B4A] leading-relaxed">{cpmk.deskripsi}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex rounded-[4px] bg-[#F2F4F7] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#142B4A]">
                          {cpmk.level_taksonomi || 'C3'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#1A3A6B]">
                        {cpmk.bobot}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Aksi Mapping IK */}
                          <button
                            type="button"
                            onClick={() => handleOpenMappingModal(cpmk)}
                            data-testid={`cpmk-map-ik-button-${cpmk.id}`}
                            className="inline-flex items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                            title="Petakan CPMK ini ke Indikator Kinerja"
                          >
                            <Network className="h-3 w-3 text-[#F4A300]" />
                            <span>Mapping IK</span>
                          </button>

                          {/* Aksi Edit CPMK */}
                          {isAdminProdi && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditCpmk(cpmk)}
                              data-testid={`cpmk-edit-button-${cpmk.id}`}
                              className="inline-flex items-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-white p-1 text-xs text-[#64748B] hover:border-[#1A3A6B] hover:text-[#1A3A6B] transition-colors"
                              title="Edit CPMK"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* MODAL TAMBAH / EDIT CPMK */}
      <Modal
        open={isCpmkModalOpen}
        title={editingCpmk ? `Edit CPMK — ${editingCpmk.kode}` : 'Tambah Capaian Pembelajaran Mata Kuliah'}
        onClose={() => setIsCpmkModalOpen(false)}
      >
        <form onSubmit={handleSaveCpmk} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                Kode CPMK <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: CPMK-01"
                value={cpmkFormKode}
                onChange={(e) => setCpmkFormKode(e.target.value)}
                data-testid="input-cpmk-kode"
                className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1">
                Bobot Penilaian (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                required
                value={cpmkFormBobot}
                onChange={(e) => setCpmkFormBobot(e.target.value)}
                data-testid="input-cpmk-bobot"
                className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Level Taksonomi Bloom <span className="text-red-500">*</span>
            </label>
            <select
              value={cpmkFormLevel}
              onChange={(e) => setCpmkFormLevel(e.target.value)}
              data-testid="select-cpmk-level"
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            >
              {TAXONOMY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142B4A] mb-1">
              Deskripsi CPMK <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Deskripsikan kemampuan akhir yang diharapkan dicapai mahasiswa pada mata kuliah ini..."
              value={cpmkFormDeskripsi}
              onChange={(e) => setCpmkFormDeskripsi(e.target.value)}
              data-testid="input-cpmk-deskripsi"
              className="w-full rounded-[6px] border border-[#CBD5E1] px-3 py-2 text-xs focus:border-[#1A3A6B] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setIsCpmkModalOpen(false)}
              className="rounded-[6px] border border-[#CBD5E1] px-3.5 py-1.5 text-xs font-semibold text-[#142B4A]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={cpmkSubmitting}
              data-testid="submit-cpmk-button"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-50"
            >
              {cpmkSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simpan CPMK</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL MAPPING IK (SELURUH IK DIKELOMPOKKAN PER CPL) */}
      <Modal
        open={isMappingModalOpen}
        title={`Pemetaan IK untuk ${targetCpmkForMapping?.kode || ''} (Bobot CPMK: ${targetCpmkForMapping?.bobot || 0}%)`}
        onClose={() => setIsMappingModalOpen(false)}
        size="max-w-3xl"
      >
        {targetCpmkForMapping && (
          <form onSubmit={handleSaveMapping} className="space-y-4">
            <div className="rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs">
              <span className="font-semibold text-[#142B4A]">Deskripsi CPMK:</span>
              <p className="mt-0.5 text-[#64748B] leading-relaxed">{targetCpmkForMapping.deskripsi}</p>
            </div>

            {/* Indikator Validasi Bobot Mapping Real-time */}
            <div
              className={`flex items-center justify-between rounded-[6px] border p-3 text-xs ${
                mappingCalculation.isExceeded
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : 'border-blue-200 bg-blue-50 text-blue-900'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Total Bobot IK Terpeta: {mappingCalculation.total}%</span>
                  <span className="text-[#64748B]">/ Batas CPMK: {mappingCalculation.cpmkBobot}%</span>
                </div>
                {mappingCalculation.isExceeded && (
                  <p className="text-red-700 font-semibold text-[11px]">
                    Aturan Backend: Total bobot IK ({mappingCalculation.total}%) tidak boleh melebihi bobot CPMK ({mappingCalculation.cpmkBobot}%).
                  </p>
                )}
              </div>
              <span
                className={`font-mono font-bold text-sm ${
                  mappingCalculation.isExceeded ? 'text-red-700' : 'text-blue-800'
                }`}
              >
                {mappingCalculation.total}%
              </span>
            </div>

            {loadingModalMapping ? (
              <div className="py-8 text-center text-xs text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B] inline mr-2" />
                <span>Memuat data pemetaan...</span>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
                {iksGroupedByCpl.map(({ cpl, iks }) => (
                  <div key={cpl.id} className="rounded-[6px] border border-[#E2E8F0] overflow-hidden">
                    <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#1A3A6B]">{cpl.kode}</span>
                        <span className="text-xs text-[#64748B] truncate max-w-lg">{cpl.deskripsi}</span>
                      </div>
                      <Badge tone="default">Threshold: {cpl.threshold_capaian}%</Badge>
                    </div>

                    <div className="divide-y divide-[#E2E8F0]">
                      {iks.map((ik) => {
                        const currentWeight = mappingWeights[ik.id] || ''
                        return (
                          <div
                            key={ik.id}
                            className="p-3 flex items-start justify-between gap-4 hover:bg-[#F8FAFC] transition-colors"
                          >
                            <div className="space-y-0.5 max-w-xl">
                              <span className="font-mono font-bold text-xs text-[#142B4A] block">
                                {ik.kode}
                              </span>
                              <p className="text-xs text-[#64748B] leading-relaxed">{ik.deskripsi}</p>
                            </div>
                            <div className="w-28 shrink-0 flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max={targetCpmkForMapping.bobot}
                                placeholder="0"
                                value={currentWeight}
                                onChange={(e) => handleWeightChange(ik.id, e.target.value)}
                                data-testid={`input-weight-ik-${ik.id}`}
                                className="w-20 rounded-[4px] border border-[#CBD5E1] px-2 py-1 text-xs text-right font-mono font-bold focus:border-[#1A3A6B] focus:outline-none"
                              />
                              <span className="text-xs text-[#64748B] font-semibold">%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0]">
              <span className="text-[11px] text-[#64748B]">
                Kosongkan atau beri nilai 0 untuk IK yang tidak diuji pada CPMK ini.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsMappingModalOpen(false)}
                  className="rounded-[6px] border border-[#CBD5E1] px-3.5 py-1.5 text-xs font-semibold text-[#142B4A]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!mappingCalculation.isValid || mappingSubmitting || loadingModalMapping}
                  data-testid="submit-mapping-button"
                  className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4A] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {mappingSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Simpan Pemetaan</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
