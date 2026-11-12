import { useMemo, useState } from 'react'
import { AlertCircle, Edit2, Loader2, Network, Plus, Search, Trash2 } from 'lucide-react'
import { ActionButton, PageHeader, SectionCard } from '../../components/PageChrome'
import { TableActionHeader, TableActionCell, TableActionButton } from '../../components/TableActions'
import SearchableSelect from '../../components/SearchableSelect'
import ConfirmDialog from '../../components/ConfirmDialog'
import CpmkFormModal from '../../components/cpmk/CpmkFormModal'
import CpmkMappingModal from '../../components/cpmk/CpmkMappingModal'
import useCpmkWorkspace from '../../components/cpmk/useCpmkWorkspace'
import { deriveCplCodes, round2 } from '../../components/cpmk/cpmkData'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import { getApiErrorMessage } from '../superAdminHelpers'

export default function CpmkSayaPage() {
  const { pushToast } = useToast()
  const { mkList, cpmkList, cplList, ikList, mappings, mkById, ikById, cplById, loading, error, reload } =
    useCpmkWorkspace()

  const [mkFilter, setMkFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingCpmk, setEditingCpmk] = useState(null)
  const [mappingTarget, setMappingTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return cpmkList.filter((c) => {
      if (mkFilter !== 'ALL' && String(c.mata_kuliah_id) !== mkFilter) return false
      const mapped = (mappings[c.id] || []).length > 0
      if (statusFilter === 'MAPPED' && !mapped) return false
      if (statusFilter === 'UNMAPPED' && mapped) return false
      if (!q) return true
      const mk = mkById.get(c.mata_kuliah_id)
      return `${c.kode} ${c.deskripsi} ${mk?.kode || ''} ${mk?.nama || ''}`.toLowerCase().includes(q)
    })
  }, [cpmkList, mappings, mkById, mkFilter, statusFilter, search])

  const mappingTotal = (cpmkId) => round2((mappings[cpmkId] || []).reduce((acc, m) => acc + Number(m.bobot), 0))

  const suggestedKode = useMemo(() => {
    if (mkFilter === 'ALL') return 'CPMK-01'
    const count = cpmkList.filter((c) => String(c.mata_kuliah_id) === mkFilter).length
    return `CPMK-${String(count + 1).padStart(2, '0')}`
  }, [cpmkList, mkFilter])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/cpmk/${deleteTarget.id}`)
      pushToast(`CPMK ${deleteTarget.kode} berhasil dihapus`)
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menghapus CPMK'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="RUANG KERJA DOSEN"
        title="CPMK Saya"
        description="Seluruh CPMK dari mata kuliah yang Anda ampu. Edit isi dan bobot CPMK, atur CPL dan IK yang diukur, atau hapus CPMK yang tidak dipakai."
        badge="Dosen Pengampu"
        actions={
          <ActionButton
            onClick={() => {
              setEditingCpmk(null)
              setFormOpen(true)
            }}
            disabled={mkList.length === 0}
            data-testid="add-cpmk-saya"
          >
            <Plus className="h-4 w-4" />
            Tambah CPMK
          </ActionButton>
        }
      />

      {error ? (
        <div className="flex items-center gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <SectionCard title="Daftar CPMK" description={`Menampilkan ${filtered.length} dari ${cpmkList.length} CPMK`}>
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode, deskripsi CPMK, atau mata kuliah..."
              data-testid="search-cpmk-saya"
              className="h-10 w-full rounded-[6px] border border-[#CBD5E1] bg-white pl-9 pr-3 text-sm text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="label-filter">Mata Kuliah:</span>
            <SearchableSelect
              value={mkFilter}
              onChange={(val) => setMkFilter(String(val))}
              className="w-72"
              buttonClassName="h-10 text-sm"
              data-testid="filter-mk-cpmk-saya"
              aria-label="Filter mata kuliah"
              searchPlaceholder="Cari kode atau nama mata kuliah..."
              options={[
                { value: 'ALL', label: `Semua Mata Kuliah (${mkList.length})` },
                ...mkList.map((mk) => ({ value: mk.id, label: `${mk.kode} - ${mk.nama}`, searchText: mk.nama })),
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="filter-status-cpmk" className="label-filter">
              Pemetaan:
            </label>
            <select
              id="filter-status-cpmk"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-sm text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            >
              <option value="ALL">Semua</option>
              <option value="MAPPED">Sudah dipetakan</option>
              <option value="UNMAPPED">Belum dipetakan</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" data-testid="table-cpmk-saya">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-[#475569]">
                <th className="w-28 px-4 py-3">Kode</th>
                <th className="w-48 px-4 py-3">Mata Kuliah</th>
                <th className="px-4 py-3">Deskripsi CPMK</th>
                <th className="w-44 px-4 py-3">CPL &amp; IK</th>
                <th className="w-20 px-4 py-3 text-right">Bobot</th>
                <TableActionHeader />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#64748B]">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#1A3A6B]" />
                    Memuat CPMK...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#64748B]">
                    {cpmkList.length === 0
                      ? 'Belum ada CPMK pada mata kuliah yang Anda ampu. Klik "Tambah CPMK" untuk membuat.'
                      : 'Tidak ada CPMK yang cocok dengan filter.'}
                  </td>
                </tr>
              ) : (
                filtered.map((cpmk) => {
                  const mk = mkById.get(cpmk.mata_kuliah_id)
                  const maps = mappings[cpmk.id] || []
                  const cplCodes = deriveCplCodes(maps, ikById, cplById)
                  return (
                    <tr key={cpmk.id} className="align-top transition-colors hover:bg-[#F8FAFC]" data-testid={`cpmk-saya-row-${cpmk.id}`}>
                      <td className="px-4 py-3">
                        <span className="block font-mono font-bold text-[#142B4A]">{cpmk.kode}</span>
                        <span className="mt-1 inline-flex rounded-[4px] bg-[#F2F4F7] px-1.5 py-0.5 font-mono text-xs font-semibold text-[#142B4A]">
                          {cpmk.level_taksonomi}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-mono text-xs font-bold text-[#1A3A6B]">{mk?.kode}</span>
                        <span className="block text-[#142B4A]">{mk?.nama}</span>
                      </td>
                      <td className="px-4 py-3 leading-relaxed text-[#142B4A]">{cpmk.deskripsi}</td>
                      <td className="px-4 py-3">
                        {maps.length > 0 ? (
                          <div className="space-y-1">
                            <span className="inline-flex rounded-[4px] border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-xs font-semibold text-blue-800">
                              {cplCodes.join(', ') || '-'}
                            </span>
                            <p className="font-mono text-xs text-[#475569]">{maps.map((m) => m.ik_kode).join(', ')}</p>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700">Belum dipetakan</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#1A3A6B]">{cpmk.bobot}%</td>
                      <TableActionCell>
                        <TableActionButton
                          variant="primary"
                          icon={Network}
                          label="Atur CPL & IK"
                          onClick={() => setMappingTarget(cpmk)}
                          data-testid={`cpmk-saya-map-${cpmk.id}`}
                        />
                        <TableActionButton
                          variant="secondary"
                          icon={Edit2}
                          label="Edit"
                          onClick={() => {
                            setEditingCpmk(cpmk)
                            setFormOpen(true)
                          }}
                          data-testid={`cpmk-saya-edit-${cpmk.id}`}
                        />
                        <TableActionButton
                          variant="danger"
                          icon={Trash2}
                          label="Hapus"
                          onClick={() => setDeleteTarget(cpmk)}
                          data-testid={`cpmk-saya-delete-${cpmk.id}`}
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

      <CpmkFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
        cpmk={editingCpmk}
        mataKuliahId={mkFilter !== 'ALL' ? Number(mkFilter) : null}
        mkOptions={mkList}
        suggestedKode={suggestedKode}
        mappingTotal={editingCpmk ? mappingTotal(editingCpmk.id) : 0}
      />

      <CpmkMappingModal
        open={Boolean(mappingTarget)}
        onClose={() => setMappingTarget(null)}
        onSaved={reload}
        cpmk={mappingTarget}
        kurikulumVersionId={mappingTarget ? mkById.get(mappingTarget.mata_kuliah_id)?.kurikulum_version_id : null}
        cplList={cplList}
        ikList={ikList}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus CPMK"
        message={deleteTarget ? `Hapus ${deleteTarget.kode} beserta pemetaan CPL & IK-nya?` : ''}
        warning="CPMK yang sudah memiliki nilai mahasiswa atau hasil evaluasi final tidak dapat dihapus."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
        confirmTestId="confirm-delete-cpmk-saya"
      />
    </div>
  )
}
