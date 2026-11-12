import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Search,
  ChevronRight,
  Loader2,
  AlertCircle,
  Layers,
} from 'lucide-react'
import { PageHeader, SectionCard, Badge, ActionButton } from '../../components/PageChrome'
import { TableActionHeader, TableActionCell, TableActionLink } from '../../components/TableActions'
import KurikulumVersionSelector from '../../components/KurikulumVersionSelector'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import useAuth from '../../hooks/useAuth'
import { getApiErrorMessage } from '../superAdminHelpers'

export default function CpmkMkListPage() {
  const navigate = useNavigate()
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()
  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isAdminProdi = currentRole === 'admin_prodi'

  // Versions state
  const [versions, setVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [loadingVersions, setLoadingVersions] = useState(true)

  // MK & CPMK data
  const [mkList, setMkList] = useState([])
  const [cpmkList, setCpmkList] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [errorData, setErrorData] = useState(null)

  // Table controls
  const [searchQuery, setSearchQuery] = useState('')
  const [semesterFilter, setSemesterFilter] = useState('ALL')

  // 1. Fetch versions
  const fetchVersions = async () => {
    setLoadingVersions(true)
    try {
      const res = await api.get('/kurikulum/versions')
      const list = Array.isArray(res.data) ? res.data : []
      setVersions(list)
      if (list.length > 0 && !selectedVersionId) {
        setSelectedVersionId(list[0].id)
      }
    } catch (err) {
      setErrorData(getApiErrorMessage(err, 'Gagal memuat versi kurikulum'))
    } finally {
      setLoadingVersions(false)
    }
  }

  // 2. Fetch all MK in selected version & all CPMK
  const loadMkAndCpmk = async (versionId) => {
    if (!versionId) return
    setLoadingData(true)
    setErrorData(null)
    try {
      const [mkRes, cpmkRes] = await Promise.all([
        api.get('/mata-kuliah', { params: { kurikulum_version_id: versionId } }),
        api.get('/cpmk'),
      ])
      setMkList(Array.isArray(mkRes.data) ? mkRes.data : [])
      setCpmkList(Array.isArray(cpmkRes.data) ? cpmkRes.data : [])
    } catch (err) {
      setErrorData(getApiErrorMessage(err, 'Gagal memuat daftar mata kuliah'))
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    fetchVersions()
  }, [])

  useEffect(() => {
    if (selectedVersionId) {
      loadMkAndCpmk(selectedVersionId)
    }
  }, [selectedVersionId])

  // Count CPMK per MK
  const cpmkCountMap = useMemo(() => {
    const map = new Map()
    for (const c of cpmkList) {
      map.set(c.mata_kuliah_id, (map.get(c.mata_kuliah_id) || 0) + 1)
    }
    return map
  }, [cpmkList])

  // Filtered MKs
  const filteredMks = useMemo(() => {
    return mkList.filter((mk) => {
      const matchSemester = semesterFilter === 'ALL' || mk.semester === semesterFilter
      const query = searchQuery.toLowerCase().trim()
      const matchQuery =
        !query ||
        (mk.kode || '').toLowerCase().includes(query) ||
        (mk.nama || '').toLowerCase().includes(query)
      return matchSemester && matchQuery
    })
  }, [mkList, semesterFilter, searchQuery])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CAPAIAN PEMBELAJARAN MATA KULIAH (OBE)"
        title="Daftar Mata Kuliah — Konfigurasi CPMK"
        description="Pilih mata kuliah untuk mengelola Capaian Pembelajaran Mata Kuliah (CPMK) dan pemetaan ke Indikator Kinerja (IK)."
        badge={isAdminProdi ? 'Admin Prodi' : 'Mode Lihat'}
      />

      {/* Selector Versi Kurikulum */}
      <KurikulumVersionSelector
        versions={versions}
        selectedVersionId={selectedVersionId}
        onSelectVersion={(id) => setSelectedVersionId(id)}
        onRefreshVersions={fetchVersions}
        canManage={isAdminProdi}
        loading={loadingVersions}
      />

      {errorData && (
        <div className="flex items-center gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorData}</span>
        </div>
      )}

      {/* Tabel Daftar Mata Kuliah */}
      <SectionCard
        title="Semua Mata Kuliah"
        description={`Menampilkan seluruh mata kuliah terdaftar pada versi kurikulum aktif (${filteredMks.length} mata kuliah).`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Semester */}
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              data-testid="filter-semester-cpmk"
              className="h-8 rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
            >
              <option value="ALL">Semua Semester</option>
              <option value="Ganjil">Semester Ganjil</option>
              <option value="Genap">Semester Genap</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
              <input
                type="search"
                placeholder="Cari kode atau nama MK..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-mk-cpmk-input"
                className="h-8 w-60 rounded-[6px] border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none"
              />
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs" data-testid="mk-cpmk-table">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#6D778E]">
                <th className="py-3 px-4 w-28">Kode MK</th>
                <th className="py-3 px-4">Nama Mata Kuliah</th>
                <th className="py-3 px-4 text-center w-24">Semester</th>
                <th className="py-3 px-4 text-center w-20">SKS</th>
                <th className="py-3 px-4 text-center w-32">Tahun Ajaran</th>
                <th className="py-3 px-4 text-center w-28">Jumlah CPMK</th>
                <TableActionHeader />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loadingData ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#64748B]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1A3A6B]" />
                      <span>Memuat data mata kuliah...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#94A3B8]" data-testid="empty-mk-cpmk">
                    {searchQuery
                      ? 'Tidak ada mata kuliah yang cocok dengan pencarian.'
                      : 'Belum ada mata kuliah terdaftar pada versi kurikulum ini.'}
                  </td>
                </tr>
              ) : (
                filteredMks.map((mk) => {
                  const count = cpmkCountMap.get(mk.id) || 0
                  return (
                    <tr
                      key={mk.id}
                      className="align-top transition-colors hover:bg-[#F8FAFC]"
                      data-testid={`mk-row-${mk.id}`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[#1A3A6B]">{mk.kode}</td>
                      <td className="py-3 px-4 font-medium text-[#142B4A]">{mk.nama}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`rounded-[4px] px-2 py-0.5 text-[11px] font-semibold ${
                            mk.semester === 'Ganjil'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {mk.semester}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-[#142B4A]">
                        {mk.sks}
                      </td>
                      <td className="py-3 px-4 text-center text-[#64748B] font-mono text-[11px]">
                        {mk.tahun_ajaran || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            count > 0
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {count} CPMK
                        </span>
                      </td>
                      <TableActionCell>
                        <TableActionLink
                          to={`/kurikulum/cpmk/mk/${mk.id}`}
                          data-testid={`manage-cpmk-button-${mk.id}`}
                          variant="primary"
                          icon={ChevronRight}
                          label="Kelola CPMK"
                          title="Kelola CPMK"
                        />
                      </TableActionCell>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
