import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, ArrowLeft, Download, RefreshCw, Search, Target, UserRound, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from '../../services/api'
import { ActionButton, Badge, SectionCard } from '../PageChrome'
import SearchableSelect from '../SearchableSelect'
import { exportToCsv } from '../../utils/csvExport'
import { getApiErrorMessage } from '../../pages/superAdminHelpers'
import { fmt, warnaCapaian } from './analitikModel'

const PER_HALAMAN = 20

const URUTAN = [
  { value: 'nim', label: 'NIM' },
  { value: 'nama', label: 'Nama' },
  { value: 'cpl_asc', label: 'Capaian CPL terendah' },
  { value: 'cpl_desc', label: 'Capaian CPL tertinggi' },
  { value: 'belum_desc', label: 'CPL belum tercapai terbanyak' },
]

const STATUS = [
  { value: '', label: 'Semua status' },
  { value: 'perhatian', label: 'Perlu perhatian' },
  { value: 'tercapai', label: 'Semua CPL tercapai' },
  { value: 'kosong', label: 'Belum ada data' },
]

function statusMahasiswa(m) {
  if (!m.jumlah_cpl) return 'kosong'
  return m.cpl_tercapai < m.jumlah_cpl ? 'perhatian' : 'tercapai'
}

function StatusBadge({ status }) {
  if (status === 'kosong') return <Badge>Belum ada data</Badge>
  if (status === 'perhatian') return <Badge tone="warning">Perlu perhatian</Badge>
  return <Badge tone="success">Tercapai</Badge>
}

function Ringkas({ label, value, caption }) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <span className="text-[11px] font-semibold uppercase text-[#64748B]">{label}</span>
      <div className="mt-2 text-2xl font-bold text-[#142B4A]">{value}</div>
      {caption ? <span className="text-[10px] text-[#94A3B8]">{caption}</span> : null}
    </div>
  )
}

// Batang nilai dengan penanda threshold.
function BarNilai({ nilai, target, pembanding }) {
  const warna = nilai == null ? '#CBD5E1' : nilai >= target ? '#1A3A6B' : '#F4A300'
  return (
    <div className="relative h-2 w-full min-w-[96px] rounded-full bg-[#E2E8F0]">
      <div className="h-2 rounded-full" style={{ width: `${Math.min(nilai || 0, 100)}%`, background: warna }} />
      {target != null && (
        <span className="absolute -top-1 h-4 w-0.5 bg-[#EF4444]" style={{ left: `${Math.min(target, 100)}%` }} title={`Target ${fmt(target)}%`} />
      )}
      {pembanding != null && (
        <span
          className="absolute -top-0.5 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-[#94A3B8] shadow"
          style={{ left: `${Math.min(pembanding, 100)}%` }}
          title={`Pembanding ${fmt(pembanding)}%`}
        />
      )}
    </div>
  )
}

function Selisih({ nilai, pembanding }) {
  if (nilai == null || pembanding == null) return <span className="text-[#94A3B8]">–</span>
  const d = nilai - pembanding
  const warna = d > 0.05 ? 'text-emerald-700' : d < -0.05 ? 'text-red-600' : 'text-[#64748B]'
  return <span className={`font-semibold ${warna}`}>{d > 0 ? '+' : ''}{fmt(d)}</span>
}

export default function AnalitikMahasiswa({ isDosen = false, programStudiId = null, courses = [] }) {
  const [mkFilter, setMkFilter] = useState('')
  const [daftar, setDaftar] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [cari, setCari] = useState('')
  const [angkatan, setAngkatan] = useState('')
  const [status, setStatus] = useState('')
  const [urut, setUrut] = useState('nim')
  const [halaman, setHalaman] = useState(1)

  const [terpilihId, setTerpilihId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [errorDetail, setErrorDetail] = useState(null)
  const detailRef = useRef(null)

  const params = useMemo(() => {
    const p = {}
    if (programStudiId) p.program_studi_id = Number(programStudiId)
    if (mkFilter) p.mata_kuliah_id = Number(mkFilter)
    return p
  }, [programStudiId, mkFilter])

  const muatDaftar = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/analitik/mahasiswa', { params })
      setDaftar(Array.isArray(res.data?.mahasiswa) ? res.data.mahasiswa : [])
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat daftar mahasiswa'))
      setDaftar([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setTerpilihId(null)
    setDetail(null)
    setHalaman(1)
    muatDaftar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const muatDetail = async (id) => {
    setLoadingDetail(true)
    setErrorDetail(null)
    try {
      const res = await api.get(`/analitik/mahasiswa/${id}`, { params })
      setDetail(res.data)
    } catch (err) {
      setErrorDetail(getApiErrorMessage(err, 'Gagal memuat analitik mahasiswa'))
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    if (!terpilihId) return
    muatDetail(terpilihId)
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terpilihId])

  const angkatanList = useMemo(
    () => [...new Set(daftar.map((m) => m.angkatan).filter((a) => a != null))].sort((a, b) => b - a),
    [daftar],
  )

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase()
    const rows = daftar.filter((m) => {
      if (angkatan && String(m.angkatan) !== String(angkatan)) return false
      if (status && statusMahasiswa(m) !== status) return false
      if (q && !`${m.nim} ${m.nama}`.toLowerCase().includes(q)) return false
      return true
    })
    const nilai = (m, kosong) => (m.rata_rata_cpl == null ? kosong : m.rata_rata_cpl)
    const pembanding = {
      nim: (a, b) => String(a.nim).localeCompare(String(b.nim)),
      nama: (a, b) => String(a.nama).localeCompare(String(b.nama)),
      cpl_asc: (a, b) => nilai(a, Infinity) - nilai(b, Infinity),
      cpl_desc: (a, b) => nilai(b, -Infinity) - nilai(a, -Infinity),
      belum_desc: (a, b) => (b.jumlah_cpl - b.cpl_tercapai) - (a.jumlah_cpl - a.cpl_tercapai),
    }[urut]
    return [...rows].sort(pembanding)
  }, [daftar, cari, angkatan, status, urut])

  useEffect(() => setHalaman(1), [cari, angkatan, status, urut])

  const jumlahHalaman = Math.max(1, Math.ceil(tersaring.length / PER_HALAMAN))
  const barisHalaman = tersaring.slice((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN)

  const statistik = useMemo(() => {
    const berdata = tersaring.filter((m) => m.jumlah_cpl > 0)
    const rata = berdata.length ? berdata.reduce((s, m) => s + m.rata_rata_cpl, 0) / berdata.length : null
    return {
      total: tersaring.length,
      rata,
      perhatian: tersaring.filter((m) => statusMahasiswa(m) === 'perhatian').length,
      kosong: tersaring.length - berdata.length,
    }
  }, [tersaring])

  const exportDaftar = () =>
    exportToCsv(
      'Analitik_Per_Mahasiswa',
      [
        { key: 'nim', label: 'NIM' },
        { key: 'nama', label: 'Nama' },
        { key: 'angkatan', label: 'Angkatan' },
        { key: 'jumlah_mk', label: 'Jumlah MK' },
        { key: 'rata_rata_cpl', label: 'Rata-rata CPL (%)' },
        { key: 'cpl', label: 'CPL Tercapai' },
        { key: 'rata_rata_cpmk', label: 'Rata-rata CPMK (%)' },
        { key: 'cpmk', label: 'CPMK Tercapai' },
        { key: 'rata_rata_nilai_akhir', label: 'Rata-rata Nilai Akhir' },
        { key: 'status', label: 'Status' },
      ],
      tersaring.map((m) => ({
        ...m,
        rata_rata_cpl: fmt(m.rata_rata_cpl),
        rata_rata_cpmk: fmt(m.rata_rata_cpmk),
        rata_rata_nilai_akhir: fmt(m.rata_rata_nilai_akhir),
        cpl: `${m.cpl_tercapai}/${m.jumlah_cpl}`,
        cpmk: `${m.cpmk_tercapai}/${m.jumlah_cpmk}`,
        status: STATUS.find((s) => s.value === statusMahasiswa(m))?.label,
      })),
    )

  const mkOptions = [
    { value: '', label: isDosen ? `Semua mata kuliah yang diampu (${courses.length})` : `Semua Mata Kuliah (${courses.length})` },
    ...courses.map((c) => ({
      value: c.id,
      label: `${c.kode} - ${c.nama}`,
      description: `${c.sks} SKS · Semester ${c.semester}`,
      searchText: c.nama,
    })),
  ]

  return (
    <div className="space-y-6">
      <SectionCard
        title="Daftar Mahasiswa"
        description={
          isDosen
            ? 'Mahasiswa peserta mata kuliah yang Anda ampu. Capaian dihitung hanya dari mata kuliah tersebut.'
            : 'Seluruh mahasiswa aktif program studi. Persempit ke peserta satu mata kuliah bila perlu.'
        }
        action={
          <ActionButton variant="secondary" onClick={exportDaftar} disabled={tersaring.length === 0} data-testid="btn-export-mahasiswa-csv">
            <Download className="h-4 w-4" />
            Export CSV
          </ActionButton>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_0.7fr_0.9fr_0.9fr]">
          <label className="relative block">
            <span className="sr-only">Cari mahasiswa</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari NIM atau nama..."
              className="h-10 w-full rounded-md border border-[#CBD5E1] bg-white pl-9 pr-3 text-xs text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
              data-testid="input-cari-mahasiswa"
            />
          </label>
          <SearchableSelect
            value={mkFilter}
            onChange={(val) => setMkFilter(String(val))}
            buttonClassName="h-10 text-xs font-semibold"
            data-testid="select-mk-mahasiswa"
            aria-label="Cakupan mata kuliah"
            searchPlaceholder="Cari kode atau nama mata kuliah..."
            options={mkOptions}
          />
          <select
            value={angkatan}
            onChange={(e) => setAngkatan(e.target.value)}
            aria-label="Angkatan"
            className="h-10 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
            data-testid="select-angkatan-mahasiswa"
          >
            <option value="">Semua angkatan</option>
            {angkatanList.map((a) => <option key={a} value={a}>Angkatan {a}</option>)}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Status capaian"
            className="h-10 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
            data-testid="select-status-mahasiswa"
          >
            {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            value={urut}
            onChange={(e) => setUrut(e.target.value)}
            aria-label="Urutkan"
            className="h-10 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#142B4A] focus:border-[#1A3A6B] focus:outline-none"
            data-testid="select-urut-mahasiswa"
          >
            {URUTAN.map((u) => <option key={u.value} value={u.value}>Urut: {u.label}</option>)}
          </select>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Ringkas label="Mahasiswa" value={statistik.total} caption="Sesuai filter" />
          <Ringkas label="Rata-rata CPL" value={statistik.rata == null ? '–' : `${fmt(statistik.rata)}%`} caption="Mahasiswa yang punya capaian" />
          <Ringkas label="Perlu perhatian" value={statistik.perhatian} caption="Ada CPL di bawah target" />
          <Ringkas label="Belum ada data" value={statistik.kosong} caption="Belum ada capaian CPL" />
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-[#F8FAFC]" />)}
            </div>
          ) : error ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
              <span className="flex items-center gap-2"><AlertCircle className="h-5 w-5 shrink-0" />{error}</span>
              <ActionButton variant="secondary" onClick={muatDaftar}><RefreshCw className="h-4 w-4" />Coba lagi</ActionButton>
            </div>
          ) : tersaring.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#CBD5E1] py-10 text-center text-xs text-[#64748B]">
              <Users className="mx-auto mb-2 h-8 w-8 text-[#94A3B8]" />
              {daftar.length === 0 ? 'Belum ada mahasiswa dalam cakupan ini.' : 'Tidak ada mahasiswa yang cocok dengan filter.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" data-testid="table-mahasiswa-analitik">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
                      <th className="pb-3 pr-3">NIM</th>
                      <th className="pb-3 pr-3">Nama</th>
                      <th className="pb-3 pr-3">Angkatan</th>
                      <th className="pb-3 pr-3 text-right">MK</th>
                      <th className="pb-3 pr-3">Rata-rata CPL</th>
                      <th className="pb-3 pr-3 text-right">CPL Tercapai</th>
                      <th className="pb-3 pr-3 text-right">CPMK Tercapai</th>
                      <th className="pb-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F4F7]">
                    {barisHalaman.map((m) => {
                      const aktif = m.mahasiswa_id === terpilihId
                      return (
                        <tr
                          key={m.mahasiswa_id}
                          onClick={() => setTerpilihId(m.mahasiswa_id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTerpilihId(m.mahasiswa_id) } }}
                          tabIndex={0}
                          aria-selected={aktif}
                          data-testid={`row-mahasiswa-${m.nim}`}
                          className={`cursor-pointer transition-colors focus:outline-none focus-visible:bg-[#EEF2F8] ${aktif ? 'bg-[#EEF2F8]' : 'hover:bg-[#F8FAFC]'}`}
                        >
                          <td className="py-3 pr-3 font-mono text-xs font-semibold text-[#142B4A]">{m.nim}</td>
                          <td className="py-3 pr-3 text-xs font-semibold text-[#142B4A]">{m.nama}</td>
                          <td className="py-3 pr-3 text-xs text-[#64748B]">{m.angkatan ?? '–'}</td>
                          <td className="py-3 pr-3 text-right text-xs text-[#64748B]">{m.jumlah_mk}</td>
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="w-12 text-xs font-bold text-[#142B4A]">{m.rata_rata_cpl == null ? '–' : `${fmt(m.rata_rata_cpl)}%`}</span>
                              <div className="w-24"><BarNilai nilai={m.rata_rata_cpl} /></div>
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-right text-xs text-[#142B4A]">{m.jumlah_cpl ? `${m.cpl_tercapai}/${m.jumlah_cpl}` : '–'}</td>
                          <td className="py-3 pr-3 text-right text-xs text-[#142B4A]">{m.jumlah_cpmk ? `${m.cpmk_tercapai}/${m.jumlah_cpmk}` : '–'}</td>
                          <td className="py-3 text-right"><StatusBadge status={statusMahasiswa(m)} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {jumlahHalaman > 1 && (
                <div className="mt-4 flex items-center justify-between text-xs text-[#64748B]">
                  <span>
                    {(halaman - 1) * PER_HALAMAN + 1}–{Math.min(halaman * PER_HALAMAN, tersaring.length)} dari {tersaring.length} mahasiswa
                  </span>
                  <div className="flex items-center gap-2">
                    <ActionButton variant="secondary" disabled={halaman <= 1} onClick={() => setHalaman((h) => h - 1)}>Sebelumnya</ActionButton>
                    <span className="font-semibold text-[#142B4A]">{halaman} / {jumlahHalaman}</span>
                    <ActionButton variant="secondary" disabled={halaman >= jumlahHalaman} onClick={() => setHalaman((h) => h + 1)}>Berikutnya</ActionButton>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SectionCard>

      <div ref={detailRef} className="scroll-mt-6">
        {!terpilihId ? (
          !loading && daftar.length > 0 && (
            <div className="rounded-lg border border-dashed border-[#94A3B8] bg-white p-10 text-center">
              <UserRound className="mx-auto h-9 w-9 text-[#64748B]" />
              <h3 className="mt-3 text-sm font-bold text-[#142B4A]">Pilih mahasiswa</h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-[#64748B]">
                Klik salah satu baris di atas untuk melihat capaian CPL, IK, dan CPMK mahasiswa tersebut beserta pembandingnya.
              </p>
            </div>
          )
        ) : loadingDetail ? (
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-12 text-center text-xs text-[#64748B]">
            <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-[#1A3A6B]" />
            Memuat analitik mahasiswa...
          </div>
        ) : errorDetail ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            <span className="flex items-center gap-2"><AlertCircle className="h-5 w-5 shrink-0" />{errorDetail}</span>
            <ActionButton variant="secondary" onClick={() => muatDetail(terpilihId)}><RefreshCw className="h-4 w-4" />Coba lagi</ActionButton>
          </div>
        ) : detail ? (
          <DetailMahasiswa detail={detail} isDosen={isDosen} onTutup={() => setTerpilihId(null)} />
        ) : null}
      </div>
    </div>
  )
}

function DetailMahasiswa({ detail, isDosen, onTutup }) {
  const { mahasiswa: m, cpl, ik, cpmk, mata_kuliah: mkList, ambang_cpmk: ambang } = detail
  const mkById = useMemo(() => Object.fromEntries(mkList.map((x) => [x.mk_id, x])), [mkList])

  const cplTercapai = cpl.filter((c) => c.tercapai).length
  const cpmkTercapai = cpmk.filter((c) => c.tercapai).length
  const rataCpl = cpl.length ? cpl.reduce((s, c) => s + c.nilai, 0) / cpl.length : null
  const nilaiAkhir = mkList.filter((x) => x.nilai_akhir != null)
  const rataNa = nilaiAkhir.length ? nilaiAkhir.reduce((s, x) => s + x.nilai_akhir, 0) / nilaiAkhir.length : null

  const chartData = cpl.map((c) => ({
    name: c.kode,
    Mahasiswa: c.nilai,
    'Rata-rata angkatan': c.rata_rata_angkatan,
    target: c.threshold,
  }))

  // Fokus perbaikan: IK terlemah (di bawah target), diurutkan dari selisih terbesar.
  const fokus = useMemo(
    () => ik.filter((i) => !i.tercapai).sort((a, b) => (a.nilai - a.threshold) - (b.nilai - b.threshold)).slice(0, 5),
    [ik],
  )

  const exportDetail = () =>
    exportToCsv(
      `Analitik_${m.nim}`,
      [
        { key: 'level', label: 'Level' },
        { key: 'kode', label: 'Kode' },
        { key: 'mk', label: 'Mata Kuliah' },
        { key: 'nilai', label: 'Capaian (%)' },
        { key: 'target', label: 'Target (%)' },
        { key: 'pembanding', label: 'Pembanding (%)' },
        { key: 'status', label: 'Status' },
      ],
      [
        ...cpl.map((c) => ({ level: 'CPL', kode: c.kode, mk: '', nilai: fmt(c.nilai), target: fmt(c.threshold), pembanding: fmt(c.rata_rata_angkatan), status: c.tercapai ? 'Tercapai' : 'Belum tercapai' })),
        ...ik.map((i) => ({ level: 'IK', kode: i.kode, mk: mkById[i.mk_id]?.kode || '', nilai: fmt(i.nilai), target: fmt(i.threshold), pembanding: fmt(i.rata_rata_kelas), status: i.tercapai ? 'Tercapai' : 'Belum tercapai' })),
        ...cpmk.map((c) => ({ level: 'CPMK', kode: c.kode, mk: mkById[c.mk_id]?.kode || '', nilai: fmt(c.nilai), target: fmt(ambang), pembanding: fmt(c.rata_rata_kelas), status: c.tercapai ? 'Tercapai' : 'Belum tercapai' })),
      ],
    )

  return (
    <div className="space-y-6" data-testid="detail-analitik-mahasiswa">
      <div className="rounded-lg border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#EEF2F8] p-2.5 text-[#1A3A6B]"><UserRound className="h-6 w-6" /></div>
            <div>
              <h3 className="text-lg font-bold text-[#142B4A]">{m.nama}</h3>
              <p className="mt-0.5 text-xs text-[#64748B]">
                <span className="font-mono font-semibold">{m.nim}</span>
                {m.angkatan ? ` · Angkatan ${m.angkatan}` : ''}
                {m.semester_aktif ? ` · Semester ${m.semester_aktif}` : ''}
                {m.status_akademik ? ` · ${m.status_akademik}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="secondary" onClick={exportDetail}><Download className="h-4 w-4" />Export CSV</ActionButton>
            <ActionButton variant="secondary" onClick={onTutup} data-testid="btn-tutup-detail-mahasiswa"><ArrowLeft className="h-4 w-4" />Kembali ke daftar</ActionButton>
          </div>
        </div>
        {isDosen && (
          <p className="mt-3 rounded-md bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#64748B]">
            Capaian dihitung hanya dari mata kuliah yang Anda ampu. Capaian CPL gabungan dari seluruh mata kuliah merupakan wewenang Kaprodi.
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Ringkas label="CPL tercapai" value={cpl.length ? `${cplTercapai}/${cpl.length}` : '–'} caption="Dibanding target tiap CPL" />
          <Ringkas label="Rata-rata CPL" value={rataCpl == null ? '–' : `${fmt(rataCpl)}%`} caption="Skala 0–100" />
          <Ringkas label="CPMK tercapai" value={cpmk.length ? `${cpmkTercapai}/${cpmk.length}` : '–'} caption={`Ambang ${fmt(ambang)}%`} />
          <Ringkas label="Rata-rata nilai akhir" value={rataNa == null ? '–' : fmt(rataNa)} caption={`${mkList.length} mata kuliah`} />
        </div>
      </div>

      {cpl.length === 0 && cpmk.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Mahasiswa ini belum memiliki capaian yang dihitung. Pastikan nilai sudah diinput dan kalkulasi dijalankan di halaman
            <span className="font-semibold"> Penilaian</span>.
          </span>
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <SectionCard
              title="Profil Capaian CPL"
              description={isDosen ? 'Capaian CPL dari mata kuliah yang Anda ampu, dibanding rata-rata mahasiswa seangkatan di mata kuliah yang sama.' : 'Capaian CPL gabungan lintas mata kuliah, dibanding rata-rata mahasiswa seangkatan.'}
            >
              {cpl.length === 0 ? (
                <p className="py-10 text-center text-xs text-[#64748B]">Belum ada capaian CPL.</p>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ left: -16, right: 8, top: 8, bottom: 4 }}>
                      <CartesianGrid stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v, n) => [v == null ? '–' : `${Number(v).toFixed(1)}%`, n]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Mahasiswa" fill="#1A3A6B" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Rata-rata angkatan" fill="#94A3B8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Fokus Perbaikan" description="Indikator kinerja dengan jarak terbesar di bawah target.">
              {fokus.length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
                  <Target className="mt-0.5 h-4 w-4 shrink-0" />
                  Semua indikator kinerja yang diukur sudah mencapai target.
                </div>
              ) : (
                <ul className="space-y-3">
                  {fokus.map((i) => (
                    <li key={`${i.ik_id}-${i.mk_id}`} className="rounded-lg border border-l-4 border-[#E2E8F0] border-l-[#F4A300] bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#142B4A]">
                          <AlertTriangle className="h-3.5 w-3.5 text-[#D97706]" />
                          {i.kode}
                          {i.cpl_kode ? <span className="font-medium text-[#64748B]">· {i.cpl_kode}</span> : null}
                        </span>
                        <span className="text-xs font-bold text-[#B45309]">{fmt(i.nilai)}% / {fmt(i.threshold)}%</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#64748B]">{i.deskripsi || '-'}</p>
                      <p className="mt-1 text-[11px] text-[#64748B]">
                        {mkById[i.mk_id]?.kode} · rata-rata kelas {fmt(i.rata_rata_kelas)}%
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {cpl.length > 0 && (
            <SectionCard title="Rincian CPL" description="Batang = capaian mahasiswa, garis merah = target, titik abu-abu = rata-rata angkatan.">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" data-testid="table-cpl-mahasiswa">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D778E]">
                      <th className="pb-3 pr-3">CPL</th>
                      <th className="pb-3 pr-3">Capaian</th>
                      <th className="pb-3 pr-3 text-right">Angkatan</th>
                      <th className="pb-3 pr-3 text-right">Selisih</th>
                      <th className="pb-3 pr-3 text-right">Peringkat</th>
                      <th className="pb-3 pr-3">Kontribusi MK</th>
                      <th className="pb-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F4F7]">
                    {cpl.map((c) => (
                      <tr key={c.cpl_id}>
                        <td className="max-w-xs py-3 pr-3">
                          <div className="text-xs font-bold text-[#142B4A]">{c.kode}</div>
                          <div className="line-clamp-1 text-[11px] text-[#64748B]">{c.deskripsi}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="w-12 text-xs font-bold text-[#142B4A]">{fmt(c.nilai)}%</span>
                            <div className="w-32"><BarNilai nilai={c.nilai} target={c.threshold} pembanding={c.rata_rata_angkatan} /></div>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right text-xs text-[#64748B]">{fmt(c.rata_rata_angkatan)}%</td>
                        <td className="py-3 pr-3 text-right text-xs"><Selisih nilai={c.nilai} pembanding={c.rata_rata_angkatan} /></td>
                        <td className="py-3 pr-3 text-right text-xs text-[#64748B]">
                          {c.peringkat_angkatan ? `${c.peringkat_angkatan} / ${c.jumlah_angkatan}` : '–'}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {c.per_mk.map((p) => {
                              const w = warnaCapaian(p.nilai, c.threshold)
                              return (
                                <span key={p.mk_id} className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: w.bg, color: w.fg }} title={mkById[p.mk_id]?.nama}>
                                  {mkById[p.mk_id]?.kode || `MK ${p.mk_id}`}: {fmt(p.nilai)}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <Badge tone={c.tercapai ? 'success' : 'warning'}>{c.tercapai ? 'Tercapai' : 'Belum tercapai'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Rincian per Mata Kuliah" description="Capaian CPMK dan IK mahasiswa pada setiap mata kuliah, dibanding rata-rata kelas.">
            <div className="space-y-4">
              {mkList.map((mk) => {
                const cpmkMk = cpmk.filter((c) => c.mk_id === mk.mk_id)
                const ikMk = ik.filter((i) => i.mk_id === mk.mk_id)
                return (
                  <details key={mk.mk_id} className="group rounded-lg border border-[#E2E8F0] bg-white" open={mkList.length <= 2}>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <div className="text-xs font-bold text-[#142B4A]">{mk.kode} · {mk.nama}</div>
                        <div className="text-[11px] text-[#64748B]">
                          {mk.sks} SKS · Semester {mk.semester}{mk.tahun_ajaran ? ` ${mk.tahun_ajaran}` : ''}{mk.kelas ? ` · Kelas ${mk.kelas}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#64748B]">Nilai akhir</span>
                        <span className="text-sm font-bold text-[#142B4A]">{mk.nilai_akhir == null ? '–' : fmt(mk.nilai_akhir)}</span>
                        {mk.nilai_huruf ? <Badge>{mk.nilai_huruf}</Badge> : null}
                        <span className="text-[11px] text-[#94A3B8] group-open:hidden">Lihat rincian</span>
                      </div>
                    </summary>
                    <div className="grid gap-6 border-t border-[#F2F4F7] p-4 lg:grid-cols-2">
                      <TabelCapaian judul="CPMK" baris={cpmkMk.map((c) => ({ key: c.cpmk_id, kode: c.kode, deskripsi: c.deskripsi, nilai: c.nilai, target: ambang, pembanding: c.rata_rata_kelas, tercapai: c.tercapai }))} />
                      <TabelCapaian judul="Indikator Kinerja" baris={ikMk.map((i) => ({ key: i.ik_id, kode: i.kode, deskripsi: i.deskripsi, nilai: i.nilai, target: i.threshold, pembanding: i.rata_rata_kelas, tercapai: i.tercapai }))} />
                    </div>
                  </details>
                )
              })}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}

function TabelCapaian({ judul, baris }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#142B4A]">{judul}</h4>
      {baris.length === 0 ? (
        <p className="text-xs text-[#64748B]">Belum ada data.</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">
              <th className="pb-2 pr-2">Kode</th>
              <th className="pb-2 pr-2">Capaian</th>
              <th className="pb-2 pr-2 text-right">Kelas</th>
              <th className="pb-2 text-right">Selisih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2F4F7]">
            {baris.map((b) => (
              <tr key={b.key} title={b.deskripsi || ''}>
                <td className="py-2 pr-2 font-bold text-[#142B4A]">
                  <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${b.tercapai ? 'bg-emerald-500' : 'bg-[#F4A300]'}`} />
                  {b.kode}
                </td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="w-11 font-semibold text-[#142B4A]">{fmt(b.nilai)}%</span>
                    <div className="w-24"><BarNilai nilai={b.nilai} target={b.target} pembanding={b.pembanding} /></div>
                  </div>
                </td>
                <td className="py-2 pr-2 text-right text-[#64748B]">{fmt(b.pembanding)}%</td>
                <td className="py-2 text-right"><Selisih nilai={b.nilai} pembanding={b.pembanding} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
