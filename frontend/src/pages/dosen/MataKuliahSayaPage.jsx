import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, BookOpen, ChevronRight, Layers, Loader2, Network, Search, Target } from 'lucide-react'
import { PageHeader, SectionCard, StatCard } from '../../components/PageChrome'
import useCpmkWorkspace from '../../components/cpmk/useCpmkWorkspace'
import { deriveCplCodes, round2 } from '../../components/cpmk/cpmkData'

export default function MataKuliahSayaPage() {
  const { mkList, cpmkList, mappings, ikById, cplById, loading, error } = useCpmkWorkspace()
  const [search, setSearch] = useState('')

  // Ringkasan per mata kuliah: jumlah CPMK, CPL yang diukur, total bobot, CPMK belum dipetakan.
  const rows = useMemo(() => {
    return mkList.map((mk) => {
      const cpmks = cpmkList.filter((c) => c.mata_kuliah_id === mk.id)
      const allMaps = cpmks.flatMap((c) => mappings[c.id] || [])
      return {
        mk,
        cpmkCount: cpmks.length,
        cplCodes: deriveCplCodes(allMaps, ikById, cplById),
        totalBobot: round2(cpmks.reduce((acc, c) => acc + (Number(c.bobot) || 0), 0)),
        unmapped: cpmks.filter((c) => (mappings[c.id] || []).length === 0).length,
      }
    })
  }, [mkList, cpmkList, mappings, ikById, cplById])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return rows
    return rows.filter(({ mk }) => `${mk.kode} ${mk.nama}`.toLowerCase().includes(q))
  }, [rows, search])

  const stats = useMemo(
    () => ({
      totalCpmk: cpmkList.length,
      unmapped: rows.reduce((acc, r) => acc + r.unmapped, 0),
      bobotBelumPas: rows.filter((r) => r.cpmkCount > 0 && r.totalBobot !== 100).length,
    }),
    [rows, cpmkList.length]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="RUANG KERJA DOSEN"
        title="Mata Kuliah Saya"
        description="Mata kuliah yang Anda ampu. Pilih salah satu untuk mengatur CPMK beserta CPL dan Indikator Kinerja (IK) yang diukurnya."
        badge="Dosen Pengampu"
      />

      {error ? (
        <div className="flex items-center gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Mata Kuliah Diampu" value={mkList.length} caption="Semua semester" icon={<BookOpen />} />
        <StatCard label="Total CPMK" value={stats.totalCpmk} caption="Di seluruh mata kuliah Anda" icon={<Layers />} />
        <StatCard
          label="CPMK Belum Dipetakan"
          value={stats.unmapped}
          caption="Belum punya CPL & IK"
          icon={<Network />}
          tone={stats.unmapped > 0 ? 'amber' : 'green'}
        />
        <StatCard
          label="Bobot Belum 100%"
          value={stats.bobotBelumPas}
          caption="Mata kuliah perlu dicek"
          icon={<Target />}
          tone={stats.bobotBelumPas > 0 ? 'red' : 'green'}
        />
      </div>

      <SectionCard
        title="Daftar Mata Kuliah yang Diampu"
        description={`${filtered.length} dari ${mkList.length} mata kuliah`}
        action={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode atau nama mata kuliah..."
              data-testid="search-mk-saya"
              className="h-10 w-72 rounded-[6px] border border-[#CBD5E1] bg-white pl-9 pr-3 text-sm text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B]"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" data-testid="table-mk-saya">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-[#475569]">
                <th className="px-4 py-3">Mata Kuliah</th>
                <th className="w-28 px-4 py-3 text-center">Semester</th>
                <th className="w-16 px-4 py-3 text-center">SKS</th>
                <th className="w-28 px-4 py-3 text-center">CPMK</th>
                <th className="w-44 px-4 py-3">CPL yang Diukur</th>
                <th className="w-32 px-4 py-3 text-center">Total Bobot</th>
                <th className="w-52 px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#64748B]">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#1A3A6B]" />
                    Memuat mata kuliah...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#64748B]">
                    {search
                      ? 'Tidak ada mata kuliah yang cocok dengan pencarian.'
                      : 'Anda belum terdaftar sebagai pengampu mata kuliah manapun. Hubungi Admin Prodi.'}
                  </td>
                </tr>
              ) : (
                filtered.map(({ mk, cpmkCount, cplCodes, totalBobot, unmapped }) => (
                  <tr key={mk.id} className="transition-colors hover:bg-[#F8FAFC]" data-testid={`mk-saya-row-${mk.id}`}>
                    <td className="px-4 py-3">
                      <span className="block font-mono font-bold text-[#1A3A6B]">{mk.kode}</span>
                      <span className="block font-semibold text-[#142B4A]">{mk.nama}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-[#142B4A]">{mk.semester}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-[#142B4A]">{mk.sks}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-[#142B4A]">{cpmkCount}</span>
                      {unmapped > 0 ? (
                        <span className="block text-xs font-semibold text-amber-700">{unmapped} belum dipetakan</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1A3A6B]">
                      {cplCodes.length > 0 ? cplCodes.join(', ') : <span className="font-sans italic text-[#94A3B8]">belum ada</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold ${
                          totalBobot === 100
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {totalBobot}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/kurikulum/cpmk/mk/${mk.id}`}
                        data-testid={`kelola-mk-${mk.id}`}
                        className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#142B4A]"
                      >
                        Kelola CPL &amp; CPMK
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
