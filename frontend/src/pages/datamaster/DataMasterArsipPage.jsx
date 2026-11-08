import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Archive, ArrowLeft, GitCompare } from 'lucide-react'
import { ActionButton, Badge, SectionCard } from '../../components/PageChrome'
import Modal from '../../components/Modal'
import useAuth from '../../hooks/useAuth'
import useToast from '../../hooks/useToast'
import { createArsipSemester, fetchArsipDetail, fetchArsipList } from '../../services/api'
import { getApiErrorMessage } from '../superAdminHelpers'

const JENIS = {
  publish_kurikulum: { label: 'Publish Kurikulum', tone: 'success' },
  tutup_semester: { label: 'Tutup Semester', tone: 'default' },
}

function formatTanggal(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

const fmtPemetaan = (list) => (list || []).map((m) => `${m.ik_kode} (${m.bobot}%)`).join(', ') || '—'

// ---------------------------------------------------------------------------
// Perbandingan dua arsip, dikunci dengan KODE
// ---------------------------------------------------------------------------
function flatten(data) {
  const rows = new Map()
  const put = (key, kategori, label, isi) => rows.set(key, { kategori, label, isi })
  ;(data.cpl || []).forEach((c) => {
    put(`cpl:${c.kode}`, 'CPL', c.kode, { Deskripsi: c.deskripsi, 'Target capaian': c.threshold_capaian })
    ;(c.ik || []).forEach((i) => put(`ik:${i.kode}`, 'IK', i.kode, { Deskripsi: i.deskripsi, CPL: c.kode }))
  })
  ;(data.mata_kuliah || []).forEach((m) => {
    const isiMk = { Nama: m.nama, SKS: m.sks, Semester: m.semester }
    if (m.pengampu) isiMk.Pengampu = m.pengampu.map((p) => p.nama + (p.koordinator ? ' (koordinator)' : '')).join(', ')
    if (m.bentuk_penilaian) {
      isiMk['Bentuk penilaian'] = m.bentuk_penilaian.map((b) => `${b.nama} ${b.bobot}%`).join(', ')
    }
    put(`mk:${m.kode}`, 'Mata Kuliah', `${m.kode} — ${m.nama}`, isiMk)
    ;(m.cpmk || []).forEach((c) =>
      put(`cpmk:${m.kode}:${c.kode}`, 'CPMK', `${m.kode} · ${c.kode}`, {
        Deskripsi: c.deskripsi,
        Bobot: c.bobot,
        'Pemetaan IK': fmtPemetaan(c.pemetaan_ik),
      }),
    )
  })
  return rows
}

function bandingkan(lama, baru) {
  const a = flatten(lama)
  const b = flatten(baru)
  const ditambah = []
  const dihapus = []
  const diubah = []
  b.forEach((row, key) => {
    if (!a.has(key)) ditambah.push(row)
  })
  a.forEach((row, key) => {
    if (!b.has(key)) {
      dihapus.push(row)
      return
    }
    const sesudah = b.get(key).isi
    const kolom = Object.keys({ ...row.isi, ...sesudah }).filter(
      (k) => String(row.isi[k] ?? '') !== String(sesudah[k] ?? ''),
    )
    if (kolom.length) {
      diubah.push({ ...row, kolom: kolom.map((k) => ({ nama: k, sebelum: row.isi[k], sesudah: sesudah[k] })) })
    }
  })
  return { ditambah, dihapus, diubah }
}

function PerbandinganView({ lama, baru }) {
  const { ditambah, dihapus, diubah } = useMemo(() => bandingkan(lama.data, baru.data), [lama, baru])
  const kosong = !ditambah.length && !dihapus.length && !diubah.length

  const Daftar = ({ judul, tone, items }) =>
    items.length ? (
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Badge tone={tone}>{judul}</Badge>
          <span className="text-xs text-[#64748B]">{items.length} item</span>
        </div>
        <ul className="divide-y divide-[#F2F4F7] rounded-md border border-[#E2E8F0]">
          {items.map((r) => (
            <li key={`${r.kategori}-${r.label}`} className="px-3 py-2 text-sm">
              <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]">{r.kategori}</span>
              <span className="font-semibold text-[#142B4A]">{r.label}</span>
              {r.kolom && (
                <ul className="mt-1.5 space-y-1 text-xs">
                  {r.kolom.map((k) => (
                    <li key={k.nama} className="text-[#64748B]">
                      <span className="font-medium text-[#142B4A]">{k.nama}:</span>{' '}
                      <span className="line-through">{String(k.sebelum ?? '—')}</span> →{' '}
                      <span className="font-semibold text-[#142B4A]">{String(k.sesudah ?? '—')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <div className="space-y-5" data-testid="arsip-perbandingan">
      <p className="text-xs text-[#64748B]">
        Perubahan dari <span className="font-semibold text-[#142B4A]">{lama.judul}</span> ke{' '}
        <span className="font-semibold text-[#142B4A]">{baru.judul}</span>, dicocokkan berdasarkan kode.
      </p>
      {kosong ? (
        <p className="py-6 text-center text-sm text-[#64748B]">Tidak ada perbedaan isi.</p>
      ) : (
        <>
          <Daftar judul="Ditambah" tone="success" items={ditambah} />
          <Daftar judul="Diubah" tone="warning" items={diubah} />
          <Daftar judul="Dihapus" tone="danger" items={dihapus} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Isi satu arsip
// ---------------------------------------------------------------------------
function IsiArsip({ arsip }) {
  const { data } = arsip
  const th = 'py-2 pr-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D778E]'
  const td = 'py-2 pr-4 align-top text-xs text-[#142B4A]'

  return (
    <div className="space-y-6">
      {data.kurikulum && (
        <div className="text-xs text-[#64748B]">
          Versi <span className="font-semibold text-[#142B4A]">{data.kurikulum.versi}</span>
          {data.kurikulum.tahun ? ` · Tahun ${data.kurikulum.tahun}` : ''}
          {data.kurikulum.deskripsi ? ` · ${data.kurikulum.deskripsi}` : ''}
        </div>
      )}

      {data.cpl && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-[#142B4A]">CPL & Indikator Kinerja</h4>
          <table className="w-full text-left">
            <thead><tr className="border-b border-[#E2E8F0]"><th className={th}>Kode</th><th className={th}>Deskripsi</th><th className={th}>Target</th><th className={th}>IK</th></tr></thead>
            <tbody>
              {data.cpl.map((c) => (
                <tr key={c.kode} className="border-b border-[#F2F4F7]">
                  <td className={`${td} font-semibold`}>{c.kode}</td>
                  <td className={td}>{c.deskripsi}</td>
                  <td className={td}>{c.threshold_capaian}%</td>
                  <td className={td}>{c.ik.map((i) => <div key={i.kode}><span className="font-semibold">{i.kode}</span> {i.deskripsi}</div>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-[#142B4A]">Mata Kuliah & CPMK</h4>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              <th className={th}>Mata Kuliah</th>
              {data.mata_kuliah?.[0]?.pengampu && <th className={th}>Pengampu</th>}
              <th className={th}>CPMK (bobot · pemetaan IK)</th>
              {data.mata_kuliah?.[0]?.bentuk_penilaian && <th className={th}>Bentuk Penilaian</th>}
            </tr>
          </thead>
          <tbody>
            {(data.mata_kuliah || []).map((m) => (
              <tr key={m.kode} className="border-b border-[#F2F4F7]">
                <td className={td}>
                  <div className="font-semibold">{m.kode}</div>
                  <div>{m.nama}</div>
                  <div className="text-[#64748B]">{m.sks} SKS · {m.semester}{m.kurikulum ? ` · Kurikulum ${m.kurikulum}` : ''}</div>
                </td>
                {m.pengampu && (
                  <td className={td}>{m.pengampu.map((p) => <div key={p.nama}>{p.nama}{p.koordinator ? ' (koordinator)' : ''}</div>)}</td>
                )}
                <td className={td}>
                  {m.cpmk.length ? m.cpmk.map((c) => (
                    <div key={c.kode} className="mb-1">
                      <span className="font-semibold">{c.kode}</span> · {c.bobot}% · {fmtPemetaan(c.pemetaan_ik)}
                    </div>
                  )) : '—'}
                </td>
                {m.bentuk_penilaian && (
                  <td className={td}>
                    {m.bentuk_penilaian.length ? m.bentuk_penilaian.map((b) => (
                      <div key={b.nama} className="mb-1"><span className="font-semibold">{b.nama}</span> {b.bobot}% · {fmtPemetaan(b.matriks_ik)}</div>
                    )) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.jenis_evaluasi?.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-[#142B4A]">Jenis Evaluasi & Bentuk Penilaian</h4>
          <ul className="space-y-1 text-xs text-[#142B4A]">
            {data.jenis_evaluasi.map((j) => (
              <li key={j.nama}><span className="font-semibold">{j.nama}</span>{j.bobot ? ` (${j.bobot}%)` : ''}: {j.bentuk_penilaian.join(', ') || '—'}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Halaman
// ---------------------------------------------------------------------------
export default function DataMasterArsipPage() {
  const { data: dm } = useOutletContext()
  const { user, activeRole } = useAuth()
  const { pushToast } = useToast()
  const role = activeRole || user?.role
  const isDekan = role === 'dekan'
  const isAdminProdi = role === 'admin_prodi'
  const prodis = dm?.prodis || []

  const [prodiId, setProdiId] = useState('')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [aktif, setAktif] = useState(null) // arsip detail yang sedang dibuka
  const [pembanding, setPembanding] = useState(null) // arsip detail lama untuk dibandingkan
  const [openModal, setOpenModal] = useState(false)
  const [form, setForm] = useState({ semester: 'Ganjil', tahun_ajaran: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (isDekan && !prodiId) {
      setList([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchArsipList(isDekan ? { program_studi_id: Number(prodiId) } : undefined)
      setList(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal memuat arsip kurikulum'))
    } finally {
      setLoading(false)
    }
  }, [isDekan, prodiId])

  useEffect(() => {
    load()
  }, [load])

  const buka = async (id) => {
    try {
      const res = await fetchArsipDetail(id)
      setAktif(res.data)
      setPembanding(null)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal membuka arsip'), 'error')
    }
  }

  const pilihPembanding = async (id) => {
    if (!id) {
      setPembanding(null)
      return
    }
    try {
      const res = await fetchArsipDetail(id)
      setPembanding(res.data)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal membuka arsip pembanding'), 'error')
    }
  }

  const simpanSemester = async (e) => {
    e.preventDefault()
    if (!form.tahun_ajaran.trim()) return
    setSaving(true)
    try {
      await createArsipSemester({ semester: form.semester, tahun_ajaran: form.tahun_ajaran.trim() })
      pushToast(`Semester ${form.semester} ${form.tahun_ajaran.trim()} berhasil diarsipkan`)
      setOpenModal(false)
      load()
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal mengarsipkan semester'), 'error')
    } finally {
      setSaving(false)
    }
  }

  // ---- Tampilan detail satu arsip ----
  if (aktif) {
    const sejenis = list.filter((a) => a.jenis === aktif.jenis && a.id !== aktif.id)
    return (
      <SectionCard
        title={aktif.judul}
        description={`${JENIS[aktif.jenis]?.label || aktif.jenis} · diarsipkan ${formatTanggal(aktif.created_at)}${aktif.dibuat_oleh_nama ? ` oleh ${aktif.dibuat_oleh_nama}` : ''}`}
        action={
          <ActionButton variant="secondary" onClick={() => setAktif(null)} data-testid="arsip-kembali">
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </ActionButton>
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <GitCompare className="h-4 w-4 text-[#1A3A6B]" />
          <span className="text-xs font-semibold text-[#142B4A]">Bandingkan dengan arsip sebelumnya:</span>
          <select
            aria-label="Arsip pembanding"
            value={pembanding?.id || ''}
            onChange={(e) => pilihPembanding(e.target.value)}
            disabled={!sejenis.length}
            className="h-8 rounded-md border border-[#CBD5E1] bg-white px-2 text-xs text-[#142B4A] disabled:opacity-50"
            data-testid="arsip-pilih-pembanding"
          >
            <option value="">{sejenis.length ? 'Tidak dibandingkan' : 'Belum ada arsip sejenis lain'}</option>
            {sejenis.map((a) => <option key={a.id} value={a.id}>{a.judul}</option>)}
          </select>
        </div>
        {pembanding ? <PerbandinganView lama={pembanding} baru={aktif} /> : <IsiArsip arsip={aktif} />}
      </SectionCard>
    )
  }

  // ---- Daftar arsip ----
  return (
    <>
      <SectionCard
        title="Arsip Kurikulum"
        description="Data yang sudah fix dipakai. Arsip dibuat otomatis saat versi kurikulum dipublish, dan oleh Admin Prodi saat menutup semester. Koreksi salah input di halaman kerja tidak mengubah arsip."
        action={
          isAdminProdi ? (
            <ActionButton onClick={() => setOpenModal(true)} data-testid="btn-arsipkan-semester">
              <Archive className="h-4 w-4" />
              Arsipkan Semester
            </ActionButton>
          ) : null
        }
      >
        {isDekan && (
          <select
            aria-label="Program studi"
            value={prodiId}
            onChange={(e) => setProdiId(e.target.value)}
            className="mb-4 h-9 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#142B4A]"
            data-testid="arsip-filter-prodi"
          >
            <option value="">Pilih program studi</option>
            {prodis.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        )}

        {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        {isDekan && !prodiId ? (
          <p className="py-10 text-center text-sm text-[#64748B]">Pilih program studi untuk melihat arsipnya.</p>
        ) : loading ? (
          <p className="py-10 text-center text-xs text-[#64748B]">Memuat arsip...</p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Archive className="h-8 w-8 text-[#94A3B8]" />
            <p className="mt-2 text-sm font-semibold text-[#142B4A]">Belum ada arsip</p>
            <p className="mt-1 max-w-sm text-xs text-[#64748B]">
              Arsip pertama terbentuk saat versi kurikulum dipublish atau saat Admin Prodi mengarsipkan semester.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm" data-testid="table-arsip">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[10px] uppercase tracking-[0.12em] text-[#6D778E]">
                <th className="py-2 pr-4 font-semibold">Arsip</th>
                <th className="py-2 pr-4 font-semibold">Jenis</th>
                <th className="py-2 pr-4 font-semibold">Isi</th>
                <th className="py-2 pr-4 font-semibold">Diarsipkan</th>
                <th className="py-2 font-semibold" aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const r = a.ringkasan || {}
                const isi = [
                  r.cpl != null && `${r.cpl} CPL`,
                  r.ik != null && `${r.ik} IK`,
                  `${r.mata_kuliah ?? 0} MK`,
                  `${r.cpmk ?? 0} CPMK`,
                ].filter(Boolean).join(' · ')
                return (
                  <tr key={a.id} className="border-b border-[#F2F4F7]">
                    <td className="py-2.5 pr-4 font-semibold text-[#142B4A]">{a.judul}</td>
                    <td className="py-2.5 pr-4"><Badge tone={JENIS[a.jenis]?.tone}>{JENIS[a.jenis]?.label || a.jenis}</Badge></td>
                    <td className="py-2.5 pr-4 text-xs text-[#64748B]">{isi}</td>
                    <td className="py-2.5 pr-4 text-xs text-[#64748B]">
                      {formatTanggal(a.created_at)}
                      {a.dibuat_oleh_nama ? <div>{a.dibuat_oleh_nama}</div> : null}
                    </td>
                    <td className="py-2.5 text-right">
                      <ActionButton variant="secondary" onClick={() => buka(a.id)} data-testid={`arsip-buka-${a.id}`}>
                        Lihat
                      </ActionButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </SectionCard>

      <Modal open={openModal} title="Arsipkan Semester" onClose={() => setOpenModal(false)}>
        <form onSubmit={simpanSemester} className="space-y-4">
          <p className="text-xs leading-relaxed text-[#64748B]">
            Simpan data mata kuliah semester ini (pengampu, CPMK, pemetaan IK, bobot bentuk penilaian) ke Data Master.
            Lakukan setelah semester selesai. Satu semester hanya bisa diarsipkan sekali.
          </p>
          <label className="block text-xs font-semibold text-[#142B4A]">
            Semester
            <select
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm"
              data-testid="arsip-input-semester"
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-[#142B4A]">
            Tahun ajaran
            <input
              required
              placeholder="2025/2026"
              value={form.tahun_ajaran}
              onChange={(e) => setForm({ ...form, tahun_ajaran: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm"
              data-testid="arsip-input-tahun-ajaran"
            />
          </label>
          <div className="flex justify-end gap-2">
            <ActionButton variant="secondary" onClick={() => setOpenModal(false)}>Batal</ActionButton>
            <ActionButton type="submit" disabled={saving} data-testid="arsip-submit-semester">
              {saving ? 'Mengarsipkan...' : 'Arsipkan'}
            </ActionButton>
          </div>
        </form>
      </Modal>
    </>
  )
}
