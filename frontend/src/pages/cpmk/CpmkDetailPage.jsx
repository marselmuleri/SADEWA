import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Edit2, Network, Loader2, AlertCircle, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import { PageHeader, SectionCard, ActionButton } from '../../components/PageChrome'
import { TableActionHeader, TableActionCell, TableActionButton } from '../../components/TableActions'
import ConfirmDialog from '../../components/ConfirmDialog'
import CpmkFormModal from '../../components/cpmk/CpmkFormModal'
import CpmkMappingModal from '../../components/cpmk/CpmkMappingModal'
import {
  deriveCplCodes,
  fetchCplAndIk,
  fetchCpmkMappings,
  indexById,
  round2,
} from '../../components/cpmk/cpmkData'
import api from '../../services/api'
import useToast from '../../hooks/useToast'
import useAuth from '../../hooks/useAuth'
import { getApiErrorMessage } from '../superAdminHelpers'

export default function CpmkDetailPage() {
  const { mkId } = useParams()
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()
  const currentRole = activeRole || user?.role || 'admin_prodi'
  const isAdminProdi = currentRole === 'admin_prodi'
  const isDosen = currentRole === 'dosen'
  // Dosen hanya bisa membuka MK yang diampu (backend menolak selain itu), jadi bila halaman
  // berhasil dimuat, dosen tersebut adalah pengampu dan boleh mengelola CPMK-nya.
  const canManage = isAdminProdi || isDosen
  const backTo = isDosen ? '/mata-kuliah-saya' : '/kurikulum/cpmk'

  const [mk, setMk] = useState(null)
  const [cpmkList, setCpmkList] = useState([])
  const [cplList, setCplList] = useState([])
  const [ikList, setIkList] = useState([])
  const [mappings, setMappings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingCpmk, setEditingCpmk] = useState(null)
  const [mappingTarget, setMappingTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    if (!mkId) return
    setLoading(true)
    setError(null)
    try {
      const [mkRes, cpmkRes, cplIk] = await Promise.all([
        api.get(`/mata-kuliah/${mkId}`),
        api.get('/cpmk', { params: { mata_kuliah_id: Number(mkId) } }),
        fetchCplAndIk(),
      ])
      const cpmks = Array.isArray(cpmkRes.data) ? cpmkRes.data : []
      setMk(mkRes.data)
      setCpmkList(cpmks)
      setCplList(cplIk.cplList)
      setIkList(cplIk.ikList)
      setMappings(await fetchCpmkMappings(cpmks))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat detail mata kuliah dan CPMK'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mkId])

  const ikById = useMemo(() => indexById(ikList), [ikList])
  const cplById = useMemo(() => indexById(cplList), [cplList])
  const totalBobotCpmk = useMemo(() => round2(cpmkList.reduce((acc, c) => acc + (Number(c.bobot) || 0), 0)), [cpmkList])
  const cplTerkaitMk = useMemo(() => {
    const all = Object.values(mappings).flat()
    return deriveCplCodes(all, ikById, cplById)
  }, [mappings, ikById, cplById])

  const mappingTotal = (cpmkId) => round2((mappings[cpmkId] || []).reduce((acc, m) => acc + Number(m.bobot), 0))

  const openAdd = () => {
    setEditingCpmk(null)
    setFormOpen(true)
  }

  const openEdit = (cpmk) => {
    setEditingCpmk(cpmk)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/cpmk/${deleteTarget.id}`)
      pushToast(`CPMK ${deleteTarget.kode} berhasil dihapus`)
      setDeleteTarget(null)
      await loadData()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menghapus CPMK'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to={backTo} data-testid="back-to-cpmk-mk-list" className="btn-kembali">
          <ArrowLeft />
          <span>Kembali ke Daftar Mata Kuliah</span>
        </Link>
      </div>

      <PageHeader
        eyebrow={isDosen ? 'KELOLA CPL & CPMK MATA KULIAH' : 'KONFIGURASI CPMK MATA KULIAH'}
        title={mk ? `${mk.kode} — ${mk.nama}` : 'Capaian Pembelajaran Mata Kuliah'}
        description="Kelola butir-butir CPMK pada mata kuliah ini, lalu atur CPL dan Indikator Kinerja (IK) yang diukur setiap CPMK beserta bobotnya."
        badge={isAdminProdi ? 'Admin Prodi' : isDosen ? 'Dosen Pengampu' : 'Mode Lihat'}
        actions={
          canManage && !error ? (
            <ActionButton onClick={openAdd} data-testid="add-cpmk-button">
              <Plus className="h-4 w-4" />
              <span>Tambah CPMK</span>
            </ActionButton>
          ) : null
        }
      />

      {error && (
        <div className="flex items-center gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {mk && (
        <div className="rounded-[8px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-base font-bold text-[#1A3A6B]">{mk.kode}</span>
                <span className="text-base font-semibold text-[#142B4A]">{mk.nama}</span>
              </div>
              <p className="text-sm text-[#64748B]">
                Tahun Ajaran: <strong className="font-mono text-[#142B4A]">{mk.tahun_ajaran || '-'}</strong> · Semester:{' '}
                <strong className="text-[#142B4A]">{mk.semester}</strong>
              </p>
              <p className="text-sm text-[#64748B]">
                CPL yang diukur:{' '}
                {cplTerkaitMk.length > 0 ? (
                  <strong className="font-mono text-[#1A3A6B]">{cplTerkaitMk.join(', ')}</strong>
                ) : (
                  <span className="italic">belum ada</span>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-6 border-t border-[#E2E8F0] pt-3 md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <div>
                <span className="block text-xs font-semibold uppercase text-[#475569]">Beban SKS</span>
                <span className="font-mono text-lg font-bold text-[#142B4A]">{mk.sks} SKS</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase text-[#475569]">Jumlah CPMK</span>
                <span className="font-mono text-lg font-bold text-[#142B4A]">{cpmkList.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`flex flex-col justify-between gap-3 rounded-[8px] border p-4 text-sm sm:flex-row sm:items-center ${
          totalBobotCpmk === 100 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
        data-testid="cpmk-total-bobot-indicator"
      >
        <div className="flex items-center gap-2.5">
          {totalBobotCpmk === 100 ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div>
            <span className="font-bold">Total Bobot CPMK: {totalBobotCpmk}%</span>
            {totalBobotCpmk !== 100 && (
              <span className="ml-1 text-amber-800">(idealnya 100%; konfigurasi tetap dapat disimpan).</span>
            )}
          </div>
        </div>
        <span className="shrink-0 font-mono text-base font-bold">{totalBobotCpmk} / 100%</span>
      </div>

      <SectionCard
        title="Daftar Capaian Pembelajaran Mata Kuliah (CPMK)"
        description={`Terdapat ${cpmkList.length} butir CPMK untuk mata kuliah ini.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" data-testid="cpmk-table">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-[#475569]">
                <th className="w-28 px-4 py-3">Kode CPMK</th>
                <th className="px-4 py-3">Deskripsi CPMK</th>
                <th className="w-44 px-4 py-3">CPL &amp; IK</th>
                <th className="w-24 px-4 py-3 text-center">Taksonomi</th>
                <th className="w-20 px-4 py-3 text-right">Bobot</th>
                <TableActionHeader />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B]">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#1A3A6B]" />
                    Memuat butir CPMK...
                  </td>
                </tr>
              ) : cpmkList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B]" data-testid="empty-cpmk">
                    Belum ada CPMK untuk mata kuliah ini.
                    {canManage ? ' Klik "Tambah CPMK" untuk membuat yang pertama.' : ''}
                  </td>
                </tr>
              ) : (
                cpmkList.map((cpmk) => {
                  const maps = mappings[cpmk.id] || []
                  const cplCodes = deriveCplCodes(maps, ikById, cplById)
                  return (
                    <tr key={cpmk.id} className="align-top transition-colors hover:bg-[#F8FAFC]" data-testid={`cpmk-row-${cpmk.id}`}>
                      <td className="px-4 py-3 font-mono font-bold text-[#142B4A]">{cpmk.kode}</td>
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
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-[4px] bg-[#F2F4F7] px-2 py-0.5 font-mono text-xs font-semibold text-[#142B4A]">
                          {cpmk.level_taksonomi || 'C3'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#1A3A6B]">{cpmk.bobot}%</td>
                      <TableActionCell>
                        <TableActionButton
                          variant="primary"
                          icon={Network}
                          label={canManage ? 'Atur CPL & IK' : 'Lihat CPL & IK'}
                          onClick={() => setMappingTarget(cpmk)}
                          data-testid={`cpmk-map-ik-button-${cpmk.id}`}
                        />
                        {canManage && (
                          <>
                            <TableActionButton
                              variant="secondary"
                              icon={Edit2}
                              label="Edit"
                              onClick={() => openEdit(cpmk)}
                              data-testid={`cpmk-edit-button-${cpmk.id}`}
                            />
                            <TableActionButton
                              variant="danger"
                              icon={Trash2}
                              label="Hapus"
                              onClick={() => setDeleteTarget(cpmk)}
                              data-testid={`cpmk-delete-button-${cpmk.id}`}
                            />
                          </>
                        )}
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
        onSaved={loadData}
        cpmk={editingCpmk}
        mataKuliahId={Number(mkId)}
        suggestedKode={`CPMK-${String(cpmkList.length + 1).padStart(2, '0')}`}
        mappingTotal={editingCpmk ? mappingTotal(editingCpmk.id) : 0}
      />

      <CpmkMappingModal
        open={Boolean(mappingTarget)}
        onClose={() => setMappingTarget(null)}
        onSaved={loadData}
        cpmk={mappingTarget}
        kurikulumVersionId={mk?.kurikulum_version_id}
        cplList={cplList}
        ikList={ikList}
        readOnly={!canManage}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus CPMK"
        message={deleteTarget ? `Hapus ${deleteTarget.kode} beserta pemetaan CPL & IK-nya?` : ''}
        warning="CPMK yang sudah memiliki nilai mahasiswa atau hasil evaluasi final tidak dapat dihapus."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
        confirmTestId="confirm-delete-cpmk"
      />
    </div>
  )
}
