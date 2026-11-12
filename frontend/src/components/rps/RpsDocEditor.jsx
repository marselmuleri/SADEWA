import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Lock, Plus, Trash2 } from 'lucide-react'
import { ActionButton } from '../PageChrome'
import ConfirmDialog from '../ConfirmDialog'
import useToast from '../../hooks/useToast'
import api from '../../services/api'
import { getApiErrorMessage } from '../../pages/superAdminHelpers'
import { UJIAN, normalisasiRps } from '../../utils/rpsExport'

// Editor RPS berbentuk dokumen: tabel Kontrak Kuliah & RPS sama dengan hasil cetak,
// setiap sel isian bisa langsung diketik. Identitas dari data SADEWA dikunci.

const keBaris = (list) => (Array.isArray(list) ? list.join('\n') : '')
const dariBaris = (s) => String(s || '').split('\n').map((x) => x.replace(/^\s*(?:[-•●*]|\d+[.)])\s+/, '').trim()).filter(Boolean)
const angkaCpmk = (kode) => String(kode || '').replace(/^CPMK\s*/i, '')
const semesterAkademik = (s) => (String(s || '').toLowerCase() === 'genap' ? 'Genap' : 'Gasal')
const tanpaAwalan = (nama, awalan) => String(nama || '').trim().replace(new RegExp(`^${awalan}\\s+`, 'i'), '')

const kuliahKosong = () => ({
  jenis: 'kuliah', kemampuan_akhir: '', bahan_kajian_judul: '', bahan_kajian: '', metode: '', waktu: '',
  pengalaman_belajar: '', target_cpmk: [], kriteria_indikator: '', bobot: '',
})

// Textarea yang tingginya mengikuti isi, tanpa bingkai, agar terasa seperti mengetik di dokumen.
function Isian({ value, onChange, placeholder, className = '', multiline = true, bold = false, center = false, ...rest }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !multiline) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, multiline])
  const kelas = `block w-full resize-none rounded-[2px] border border-transparent bg-[#FFFBEB] px-1 py-0.5 leading-snug text-black placeholder:italic placeholder:text-[#94A3B8] hover:border-[#F4A300]/60 focus:border-[#1A3A6B] focus:bg-white focus:outline-none ${bold ? 'font-bold' : ''} ${center ? 'text-center' : ''} ${className}`
  return multiline ? (
    <textarea ref={ref} rows={1} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={kelas} {...rest} />
  ) : (
    <input value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={kelas} {...rest} />
  )
}

function Terkunci({ children, title = 'Diambil dari data SADEWA (Data Master), tidak diubah di sini' }) {
  return (
    <span className="inline-flex items-start gap-1 text-black" title={title}>
      <span>{children}</span>
      <Lock className="mt-0.5 h-3 w-3 shrink-0 text-[#94A3B8]" aria-label="Terkunci" />
    </span>
  )
}

// Pilih CPMK dengan klik; kode yang tidak ada di daftar CPMK ditandai merah.
function PilihCpmk({ daftar, value, onChange, ringkas = false }) {
  const terdaftar = new Set(daftar.map((c) => c.kode))
  const asing = value.filter((k) => !terdaftar.has(k))
  const toggle = (kode) => onChange(value.includes(kode) ? value.filter((k) => k !== kode) : [...value, kode].sort(
    (a, b) => daftar.findIndex((c) => c.kode === a) - daftar.findIndex((c) => c.kode === b),
  ))
  if (!daftar.length && !asing.length) return <span className="text-[11px] italic text-[#94A3B8]">Isi daftar CPMK dulu</span>
  return (
    <div className="flex flex-wrap gap-1">
      {daftar.map((c) => {
        const aktif = value.includes(c.kode)
        return (
          <button
            key={c.kode}
            type="button"
            title={c.deskripsi}
            aria-pressed={aktif}
            onClick={() => toggle(c.kode)}
            className={`rounded-[3px] border px-1 py-px font-sans text-[10px] font-semibold tabular-nums transition-colors ${
              aktif ? 'border-[#1A3A6B] bg-[#1A3A6B] text-white' : 'border-[#CBD5E1] bg-white text-[#94A3B8] hover:border-[#1A3A6B] hover:text-[#1A3A6B]'
            }`}
          >
            {ringkas ? angkaCpmk(c.kode) : c.kode}
          </button>
        )
      })}
      {asing.map((k) => (
        <button
          key={k}
          type="button"
          title="CPMK ini tidak ada di daftar CPMK. Klik untuk menghapus."
          onClick={() => toggle(k)}
          className="rounded-[3px] border border-red-300 bg-red-50 px-1 py-px font-sans text-[10px] font-semibold text-red-700 line-through"
        >
          {ringkas ? angkaCpmk(k) : k}
        </button>
      ))}
    </div>
  )
}

function AksiBaris({ onNaik, onTurun, onHapus, onSisip, labelSisip = 'Sisipkan baris di bawah' }) {
  const tombol = 'rounded-[3px] p-1 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#1A3A6B] disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <div className="flex flex-col items-center gap-0.5 font-sans">
      <button type="button" className={tombol} onClick={onNaik} disabled={!onNaik} aria-label="Naikkan" title="Naikkan"><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" className={tombol} onClick={onTurun} disabled={!onTurun} aria-label="Turunkan" title="Turunkan"><ArrowDown className="h-3.5 w-3.5" /></button>
      {onSisip && <button type="button" className={tombol} onClick={onSisip} aria-label={labelSisip} title={labelSisip}><Plus className="h-3.5 w-3.5" /></button>}
      <button type="button" className={`${tombol} hover:!text-red-600`} onClick={onHapus} aria-label="Hapus baris" title="Hapus baris"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  )
}

function TambahBaris({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 inline-flex items-center gap-1 rounded-[4px] border border-dashed border-[#94A3B8] px-2 py-1 font-sans text-xs font-semibold text-[#1A3A6B] hover:border-[#1A3A6B] hover:bg-[#F8FAFC]"
    >
      <Plus className="h-3.5 w-3.5" /> {children}
    </button>
  )
}

const pindah = (list, i, arah) => {
  const j = i + arah
  if (j < 0 || j >= list.length) return list
  const baru = [...list]
  ;[baru[i], baru[j]] = [baru[j], baru[i]]
  return baru
}

export default function RpsDocEditor({ rps, identitas, onCancel, onSaved }) {
  const { pushToast } = useToast()
  const idt = identitas || {}
  const [awal] = useState(() => normalisasiRps(rps.konten))
  const [meta, setMeta] = useState({ tahun_ajaran: rps.tahun_ajaran || '', semester: rps.semester || 'Ganjil' })
  const [doc, setDoc] = useState(() => ({
    semester_kurikulum: awal.semester_kurikulum,
    kode_mk: awal.kode_mk,
    deskripsi_mk: awal.deskripsi_mk,
    cpl: awal.cpl,
    cpmk: awal.cpmk,
    penilaian: awal.penilaian.map((p) => ({ ...p, rincian: keBaris(p.rincian), bobot: p.bobot ?? '' })),
    pertemuan: awal.pertemuan.map((p) =>
      p.jenis === 'kuliah'
        ? { ...kuliahKosong(), ...p, pengalaman_belajar: keBaris(p.pengalaman_belajar), kriteria_indikator: keBaris(p.kriteria_indikator), bobot: p.bobot ?? '' }
        : { jenis: p.jenis },
    ),
    referensi: keBaris(awal.referensi),
  }))
  const [berubah, setBerubah] = useState(false)
  const [konfirmasiBatal, setKonfirmasiBatal] = useState(false)
  const [saving, setSaving] = useState(false)

  const ubahDoc = (fn) => {
    setDoc((d) => fn(d))
    setBerubah(true)
  }
  const set = (field, value) => ubahDoc((d) => ({ ...d, [field]: value }))
  const setItem = (key, i, field, value) =>
    ubahDoc((d) => ({ ...d, [key]: d[key].map((item, idx) => (idx === i ? { ...item, [field]: value } : item)) }))
  const hapus = (key, i) => ubahDoc((d) => ({ ...d, [key]: d[key].filter((_, idx) => idx !== i) }))
  const sisip = (key, i, item) => ubahDoc((d) => ({ ...d, [key]: [...d[key].slice(0, i + 1), item, ...d[key].slice(i + 1)] }))
  const geser = (key, i, arah) => ubahDoc((d) => ({ ...d, [key]: pindah(d[key], i, arah) }))

  // Mengganti kode CPMK ikut memperbarui semua rujukannya; menghapus CPMK ikut melepas rujukannya.
  const gantiKodeCpmk = (i, kodeBaru) =>
    ubahDoc((d) => {
      const lama = d.cpmk[i].kode
      const ganti = (list) => list.map((k) => (k === lama ? kodeBaru : k))
      return {
        ...d,
        cpmk: d.cpmk.map((c, idx) => (idx === i ? { ...c, kode: kodeBaru } : c)),
        penilaian: d.penilaian.map((p) => ({ ...p, cpmk: ganti(p.cpmk) })),
        pertemuan: d.pertemuan.map((p) => (p.jenis === 'kuliah' ? { ...p, target_cpmk: ganti(p.target_cpmk) } : p)),
      }
    })
  const hapusCpmk = (i) =>
    ubahDoc((d) => {
      const kode = d.cpmk[i].kode
      const buang = (list) => list.filter((k) => k !== kode)
      return {
        ...d,
        cpmk: d.cpmk.filter((_, idx) => idx !== i),
        penilaian: d.penilaian.map((p) => ({ ...p, cpmk: buang(p.cpmk) })),
        pertemuan: d.pertemuan.map((p) => (p.jenis === 'kuliah' ? { ...p, target_cpmk: buang(p.target_cpmk) } : p)),
      }
    })

  const totalBobot = doc.penilaian.reduce((s, p) => s + (Number(p.bobot) || 0), 0)
  const bobotUjian = (jenis) => doc.penilaian.find((p) => p.komponen.trim().toUpperCase() === jenis)?.bobot
  const daftarCpmkValid = doc.cpmk.filter((c) => c.kode.trim())

  // Daftar periksa: hal yang membuat dokumen belum lengkap. Tidak memblokir simpan.
  const masalah = useMemo(() => {
    const out = []
    if (totalBobot !== 100) out.push(`Total bobot Tabel Penilaian ${totalBobot}%, seharusnya 100%.`)
    for (const j of ['UTS', 'UAS']) {
      if (!doc.penilaian.some((p) => p.komponen.trim().toUpperCase() === j)) out.push(`Tabel Penilaian belum punya komponen "${j}".`)
      if (!doc.pertemuan.some((p) => p.jenis === j)) out.push(`Rencana mingguan belum punya baris ${UJIAN[j].toLowerCase()}.`)
    }
    const kode = new Set(doc.cpmk.map((c) => c.kode))
    const asing = new Set()
    doc.penilaian.forEach((p) => p.cpmk.forEach((k) => !kode.has(k) && asing.add(k)))
    doc.pertemuan.forEach((p) => p.jenis === 'kuliah' && p.target_cpmk.forEach((k) => !kode.has(k) && asing.add(k)))
    if (asing.size) out.push(`Merujuk CPMK yang tidak ada di daftar: ${[...asing].join(', ')}.`)
    const tanpaCpmk = doc.pertemuan.map((p, i) => (p.jenis === 'kuliah' && !p.target_cpmk.length ? i + 1 : null)).filter(Boolean)
    if (tanpaCpmk.length) out.push(`Pertemuan ${tanpaCpmk.join(', ')} belum punya Target CPMK.`)
    const kosong = doc.pertemuan
      .map((p, i) => (p.jenis === 'kuliah' && (!p.kemampuan_akhir.trim() || !(p.bahan_kajian_judul.trim() || p.bahan_kajian.trim())) ? i + 1 : null))
      .filter(Boolean)
    if (kosong.length) out.push(`Pertemuan ${kosong.join(', ')} belum lengkap (kemampuan akhir / bahan kajian).`)
    if (!doc.cpl.length) out.push('Daftar CPL masih kosong.')
    if (!doc.cpmk.length) out.push('Daftar CPMK masih kosong.')
    return out
  }, [doc, totalBobot])

  const simpan = async () => {
    setSaving(true)
    try {
      const penilaian = doc.penilaian.map((p) => ({
        poin: p.poin.trim(), komponen: p.komponen.trim(), rincian: dariBaris(p.rincian),
        bobot: p.bobot === '' ? null : Number(p.bobot), cpmk: p.cpmk,
      }))
      const bobotDari = (j) => penilaian.find((p) => p.komponen.toUpperCase() === j)?.bobot ?? null
      const payload = {
        format: 2,
        kode_mk: doc.kode_mk || idt.kode || '',
        semester_kurikulum: doc.semester_kurikulum.trim(),
        deskripsi_mk: doc.deskripsi_mk.trim(),
        cpl: doc.cpl.map((c) => ({ kode: c.kode.trim(), deskripsi: c.deskripsi.trim(), label: c.label.trim().replace(/^\(|\)$/g, '').toUpperCase() })),
        cpmk: doc.cpmk.map((c) => ({ kode: c.kode.trim(), deskripsi: c.deskripsi.trim() })),
        penilaian,
        // Nomor pertemuan mengikuti urutan baris
        pertemuan: doc.pertemuan.map((p, i) =>
          p.jenis === 'kuliah'
            ? {
                minggu: i + 1, jenis: 'kuliah',
                kemampuan_akhir: p.kemampuan_akhir.trim(), bahan_kajian_judul: p.bahan_kajian_judul.trim().replace(/:$/, ''),
                bahan_kajian: p.bahan_kajian.trim(), metode: p.metode.trim(), waktu: p.waktu.trim(),
                pengalaman_belajar: dariBaris(p.pengalaman_belajar), target_cpmk: p.target_cpmk,
                kriteria_indikator: dariBaris(p.kriteria_indikator), bobot: p.bobot === '' ? null : Number(p.bobot),
              }
            : { minggu: i + 1, jenis: p.jenis, bobot: bobotDari(p.jenis) },
        ),
        referensi: dariBaris(doc.referensi),
      }
      const res = await api.put(`/rps/${rps.id}`, { konten: payload, ...meta })
      pushToast('Perubahan RPS berhasil disimpan')
      setBerubah(false)
      onSaved(res.data)
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Gagal menyimpan RPS'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const batal = () => (berubah ? setKonfirmasiBatal(true) : onCancel())

  const td = 'border border-black px-1.5 py-1 align-top'
  const th = 'border border-black px-1.5 py-1 text-center align-middle font-bold'
  const lembar = 'mx-auto min-w-[1040px] max-w-[1180px] bg-white px-8 py-7 shadow-[0_1px_3px_rgba(15,23,42,.18)]'
  const fakultas = tanpaAwalan(idt.fakultas, 'Fakultas')
  const dosen = idt.dosen?.length ? idt.dosen : ['(belum ada dosen pengampu)']
  const kodeMk = idt.kode || doc.kode_mk

  return (
    <div data-testid={`rps-editor-${rps.id}`}>
      {/* Bilah atas: tetap terlihat saat menggulir */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0 text-xs text-[#64748B]">
          <p className="text-sm font-semibold text-[#142B4A]">Edit Kontrak Kuliah &amp; RPS</p>
          <p>
            Klik sel berwarna <span className="rounded-[2px] bg-[#FFFBEB] px-1 text-[#142B4A]">krem</span> untuk mengubah isi.
            Bagian bertanda <Lock className="inline h-3 w-3" /> diambil dari data SADEWA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {berubah && <span className="text-xs font-semibold text-amber-700">Belum disimpan</span>}
          <ActionButton variant="secondary" onClick={batal} disabled={saving}>Batal</ActionButton>
          <ActionButton onClick={simpan} disabled={saving} data-testid={`rps-simpan-${rps.id}`}>
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </ActionButton>
        </div>
      </div>

      {/* Daftar periksa */}
      <div
        className={`mb-4 rounded-[6px] border p-3 text-xs ${masalah.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
        role="status"
      >
        {masalah.length ? (
          <>
            <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> Perlu dicek sebelum dipakai ({masalah.length})</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-6">{masalah.map((m) => <li key={m}>{m}</li>)}</ul>
          </>
        ) : (
          <p className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="h-4 w-4" /> Dokumen lengkap dan bobot penilaian sudah 100%.</p>
        )}
      </div>

      <div className="-mx-4 overflow-x-auto bg-[#E2E8F0] px-4 py-5 font-['Times_New_Roman',Times,serif] text-[13px] text-black">
        {/* ===== Halaman 1: KONTRAK KULIAH ===== */}
        <div className={lembar}>
          <p className="mb-4 text-center text-[15px] font-bold">KONTRAK KULIAH</p>
          <table className="mb-4 text-[14px]">
            <tbody>
              <tr><td className="w-36 py-0.5 align-top">Fakultas / Prodi</td><td className="w-4 align-top">:</td><td><Terkunci>{fakultas} / {idt.program_studi}</Terkunci></td></tr>
              <tr>
                <td className="py-0.5 align-top">Tahun Akademik</td><td className="align-top">:</td>
                <td>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    Semester
                    <select
                      aria-label="Semester"
                      value={meta.semester}
                      onChange={(e) => { setMeta({ ...meta, semester: e.target.value }); setBerubah(true) }}
                      className="rounded-[2px] border border-transparent bg-[#FFFBEB] px-1 hover:border-[#F4A300]/60 focus:border-[#1A3A6B] focus:outline-none"
                    >
                      <option value="Ganjil">{semesterAkademik('Ganjil')}</option>
                      <option value="Genap">{semesterAkademik('Genap')}</option>
                    </select>
                    <span className="w-28">
                      <Isian multiline={false} aria-label="Tahun akademik" placeholder="2026/2027" value={meta.tahun_ajaran}
                        onChange={(v) => { setMeta({ ...meta, tahun_ajaran: v }); setBerubah(true) }} />
                    </span>
                  </span>
                </td>
              </tr>
              <tr><td className="py-0.5 align-top">Mata Kuliah</td><td className="align-top">:</td><td><Terkunci>{kodeMk}- {idt.nama} ({idt.sks} sks)</Terkunci></td></tr>
              <tr>
                <td className="py-0.5 align-top">Dosen</td><td className="align-top">:</td>
                <td><Terkunci title="Dosen pengampu diatur di Data Master mata kuliah">{dosen.map((n, i) => <span key={n} className="block">{i + 1}. {n}</span>)}</Terkunci></td>
              </tr>
            </tbody>
          </table>

          <p className="mb-1.5 text-[14px] font-bold">Tabel Penilaian Mata Kuliah</p>
          <div className="flex gap-1">
            <table className="w-full border-collapse text-[14px]">
              <colgroup><col style={{ width: '5%' }} /><col style={{ width: '20%' }} /><col style={{ width: '36%' }} /><col style={{ width: '10%' }} /><col style={{ width: '29%' }} /></colgroup>
              <thead>
                <tr><th className={th}>No.</th><th className={th}>Poin Evaluasi</th><th className={th}>Komponen Evaluasi</th><th className={th}>Bobot (%)</th><th className={th}>Komponen CPMK yang Dinilai</th></tr>
              </thead>
              <tbody>
                {doc.penilaian.map((p, i) => (
                  <tr key={i} className="group">
                    <td className={`${td} text-center align-middle`} title="Baris dengan Poin Evaluasi sama dengan baris di atasnya digabung di dokumen">
                      {i > 0 && p.poin.trim() && p.poin.trim() === doc.penilaian[i - 1].poin.trim()
                        ? <span className="font-sans text-[10px] text-[#94A3B8]">(gabung)</span>
                        : `${doc.penilaian.slice(0, i + 1).filter((x, j) => j === 0 || !x.poin.trim() || x.poin.trim() !== doc.penilaian[j - 1].poin.trim()).length}.`}
                    </td>
                    <td className={`${td} align-middle`}>
                      <Isian aria-label="Poin evaluasi" placeholder="mis. Kognitif / Pengetahuan" value={p.poin} onChange={(v) => setItem('penilaian', i, 'poin', v)} />
                    </td>
                    <td className={td}>
                      <Isian aria-label="Komponen evaluasi" placeholder="mis. Tugas atau UTS" value={p.komponen} onChange={(v) => setItem('penilaian', i, 'komponen', v)} />
                      <Isian
                        aria-label="Rincian komponen"
                        className="mt-1 text-[13px]"
                        placeholder="Rincian bernomor, satu per baris (boleh kosong)"
                        value={p.rincian}
                        onChange={(v) => setItem('penilaian', i, 'rincian', v)}
                      />
                    </td>
                    <td className={`${td} align-middle`}>
                      <Isian multiline={false} type="number" min="0" max="100" center aria-label="Bobot" value={p.bobot} onChange={(v) => setItem('penilaian', i, 'bobot', v)} />
                    </td>
                    <td className={`${td} align-middle`}>
                      <PilihCpmk daftar={daftarCpmkValid} value={p.cpmk} onChange={(v) => setItem('penilaian', i, 'cpmk', v)} />
                    </td>
                    <td className="w-8 border-0 pl-1 align-middle">
                      <AksiBaris
                        onNaik={i > 0 ? () => geser('penilaian', i, -1) : null}
                        onTurun={i < doc.penilaian.length - 1 ? () => geser('penilaian', i, 1) : null}
                        onHapus={() => hapus('penilaian', i)}
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className={`${td} text-center`} colSpan={3}>Jumlah</td>
                  <td className={`${td} text-center font-bold ${totalBobot === 100 ? '' : 'bg-red-50 text-red-700'}`}>{totalBobot}</td>
                  <td className={`${td} font-sans text-[11px] ${totalBobot === 100 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {totalBobot === 100 ? 'Sudah 100%' : `Kurang/lebih ${100 - totalBobot}%`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <TambahBaris onClick={() => ubahDoc((d) => ({ ...d, penilaian: [...d.penilaian, { poin: '', komponen: '', rincian: '', bobot: '', cpmk: [] }] }))}>
            Tambah komponen penilaian
          </TambahBaris>
          <p className="mt-1 font-sans text-[11px] text-[#64748B]">
            Baris berurutan dengan Poin Evaluasi yang sama akan digabung di dokumen. Bobot UTS/UAS di rencana mingguan mengikuti komponen bernama &quot;UTS&quot; dan &quot;UAS&quot;.
          </p>
        </div>

        {/* ===== Halaman 2: RENCANA PEMBELAJARAN SEMESTER ===== */}
        <div className={`${lembar} mt-5`}>
          <table className="w-full border-collapse border-x-[3px] border-t-[3px] border-black">
            <colgroup><col style={{ width: '13%' }} /><col style={{ width: '41%' }} /><col style={{ width: '46%' }} /></colgroup>
            <tbody>
              <tr>
                <td className={`${td} text-center align-middle font-sans text-[10px] text-[#94A3B8]`} rowSpan={2}>Logo universitas</td>
                <td className={`${td} text-center font-bold`} colSpan={2}>RENCANA PEMBELAJARAN SEMESTER</td>
              </tr>
              <tr>
                <td className={`${td} font-bold`}><Terkunci>Program Studi: {tanpaAwalan(idt.program_studi, '(S1|S2|S3|D3|D4)').toUpperCase()}</Terkunci></td>
                <td className={`${td} font-bold`}><Terkunci>Fakultas: {fakultas.toUpperCase()}</Terkunci></td>
              </tr>
            </tbody>
          </table>

          <table className="-mt-px w-full border-collapse border-x-[3px] border-black">
            <colgroup><col style={{ width: '22.5%' }} /><col style={{ width: '12%' }} /><col style={{ width: '13%' }} /><col style={{ width: '8%' }} /><col style={{ width: '44.5%' }} /></colgroup>
            <tbody>
              <tr>
                <td className={`${td} font-bold`}>Mata Kuliah:</td>
                <td className={td}><Terkunci>{idt.nama}</Terkunci></td>
                <td className={td}><b>Kode:</b><br /><Terkunci>{kodeMk}</Terkunci></td>
                <td className={td}><b>SKS:</b><br /><Terkunci>{idt.sks}</Terkunci></td>
                <td className={td}>
                  <b>Sem:</b>
                  <span className="block w-20"><Isian multiline={false} aria-label="Semester ke" placeholder="mis. 3" value={doc.semester_kurikulum} onChange={(v) => set('semester_kurikulum', v)} /></span>
                </td>
              </tr>
              <tr>
                <td className={`${td} font-bold`}>Dosen Pengampu:</td>
                <td className={td} colSpan={4}><Terkunci title="Dosen pengampu diatur di Data Master mata kuliah">{dosen.map((n, i) => <span key={n} className="block">{i + 1}. {n}</span>)}</Terkunci></td>
              </tr>

              {doc.cpl.map((c, i) => (
                <tr key={`cpl-${i}`}>
                  {i === 0 && <td className={`${td} font-bold`} rowSpan={doc.cpl.length}>Capaian Pembelajaran Lulusan</td>}
                  <td className={td} colSpan={4}>
                    <div className="flex items-start gap-1">
                      <span className="w-20 shrink-0"><Isian multiline={false} aria-label="Kode CPL" placeholder="CPL 2" value={c.kode} onChange={(v) => setItem('cpl', i, 'kode', v)} /></span>
                      <span className="pt-0.5">:</span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <Isian aria-label="Deskripsi CPL" className="text-justify" placeholder="Deskripsi CPL" value={c.deskripsi} onChange={(v) => setItem('cpl', i, 'deskripsi', v)} />
                        <span className="flex items-center gap-1">
                          <span className="font-bold">(</span>
                          <span className="w-72"><Isian multiline={false} bold aria-label="Label CPL" placeholder="LABEL CPL, mis. ENGINEERING DESIGN" value={c.label} onChange={(v) => setItem('cpl', i, 'label', v.toUpperCase())} /></span>
                          <span className="font-bold">)</span>
                        </span>
                      </div>
                      <AksiBaris
                        onNaik={i > 0 ? () => geser('cpl', i, -1) : null}
                        onTurun={i < doc.cpl.length - 1 ? () => geser('cpl', i, 1) : null}
                        onSisip={() => sisip('cpl', i, { kode: '', deskripsi: '', label: '' })}
                        labelSisip="Tambah CPL di bawah"
                        onHapus={() => hapus('cpl', i)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {!doc.cpl.length && (
                <tr><td className={`${td} font-bold`}>Capaian Pembelajaran Lulusan</td><td className={td} colSpan={4}>
                  <TambahBaris onClick={() => set('cpl', [{ kode: '', deskripsi: '', label: '' }])}>Tambah CPL</TambahBaris>
                </td></tr>
              )}

              {doc.cpmk.map((c, i) => (
                <tr key={`cpmk-${i}`}>
                  {i === 0 && <td className={`${td} font-bold`} rowSpan={doc.cpmk.length}>Capaian Pembelajaran Mata Kuliah:</td>}
                  <td className={td} colSpan={4}>
                    <div className="flex items-start gap-1">
                      <span className="w-24 shrink-0"><Isian multiline={false} aria-label="Kode CPMK" placeholder="CPMK 2.1" value={c.kode} onChange={(v) => gantiKodeCpmk(i, v)} /></span>
                      <span className="pt-0.5">:</span>
                      <div className="min-w-0 flex-1"><Isian aria-label="Deskripsi CPMK" className="text-justify" placeholder="Mahasiswa mampu ..." value={c.deskripsi} onChange={(v) => setItem('cpmk', i, 'deskripsi', v)} /></div>
                      <AksiBaris
                        onNaik={i > 0 ? () => geser('cpmk', i, -1) : null}
                        onTurun={i < doc.cpmk.length - 1 ? () => geser('cpmk', i, 1) : null}
                        onSisip={() => sisip('cpmk', i, { kode: '', deskripsi: '' })}
                        labelSisip="Tambah CPMK di bawah"
                        onHapus={() => hapusCpmk(i)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {!doc.cpmk.length && (
                <tr><td className={`${td} font-bold`}>Capaian Pembelajaran Mata Kuliah:</td><td className={td} colSpan={4}>
                  <TambahBaris onClick={() => set('cpmk', [{ kode: '', deskripsi: '' }])}>Tambah CPMK</TambahBaris>
                </td></tr>
              )}

              <tr>
                <td className={`${td} font-bold`}>Deskripsi Singkat Mata Kuliah:</td>
                <td className={td} colSpan={4}>
                  <Isian aria-label="Deskripsi singkat mata kuliah" className="text-justify" value={doc.deskripsi_mk} onChange={(v) => set('deskripsi_mk', v)} />
                </td>
              </tr>
            </tbody>
          </table>

          {/* Rencana mingguan: kolom 1-8 seperti dokumen; kolom aksi di luar bingkai */}
          <table className="-mt-px w-full border-collapse">
            <colgroup>
              <col style={{ width: '5%' }} /><col style={{ width: '14.5%' }} /><col style={{ width: '15%' }} /><col style={{ width: '8%' }} />
              <col style={{ width: '6.5%' }} /><col style={{ width: '16%' }} /><col style={{ width: '9%' }} /><col style={{ width: '18%' }} />
              <col style={{ width: '5.5%' }} /><col style={{ width: '32px' }} />
            </colgroup>
            <thead className="text-[12px]">
              <tr className="border-x-[3px] border-t-[3px] border-black">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => <th key={n} className={`${th} border-b-[3px]`}>{n}</th>)}
                <th className={`${th} border-b-[3px]`} colSpan={2}>8</th>
                <th className="border-0" />
              </tr>
              <tr>
                <th className={`${th} border-l-[3px]`} rowSpan={2}>Perte-<br />muan</th>
                <th className={th} rowSpan={2}>Kemampuan Akhir Tiap Tahapan Pembelajaran</th>
                <th className={th} rowSpan={2}>Bahan Kajian/ Pokok Bahasan</th>
                <th className={th} rowSpan={2}>Metode Pembela-<br />jaran</th>
                <th className={th} rowSpan={2}>Waktu (menit)</th>
                <th className={th} rowSpan={2}>Pengalaman Belajar Mahasiswa</th>
                <th className={th} rowSpan={2}>Target CPMK</th>
                <th className={`${th} border-r-[3px]`} colSpan={2}>Penilaian</th>
                <th className="border-0" rowSpan={2} />
              </tr>
              <tr>
                <th className={th}>Kriteria &amp; Indikator</th>
                <th className={`${th} border-r-[3px]`}>Bobot (%)</th>
              </tr>
            </thead>
            <tbody className="text-[12px]">
              {doc.pertemuan.map((p, i) => {
                const aksi = (
                  <td className="border-0 pl-1 align-top">
                    <AksiBaris
                      onNaik={i > 0 ? () => geser('pertemuan', i, -1) : null}
                      onTurun={i < doc.pertemuan.length - 1 ? () => geser('pertemuan', i, 1) : null}
                      onSisip={() => sisip('pertemuan', i, kuliahKosong())}
                      labelSisip="Sisipkan pertemuan di bawah"
                      onHapus={() => hapus('pertemuan', i)}
                    />
                  </td>
                )
                if (p.jenis !== 'kuliah') {
                  return (
                    <tr key={i}>
                      <td className={`${td} border-l-[3px] text-center`}>{i + 1}</td>
                      <td className={`${td} text-center align-middle font-bold`} colSpan={7}>
                        <select
                          aria-label={`Jenis pertemuan ${i + 1}`}
                          value={p.jenis}
                          onChange={(e) => ubahDoc((d) => ({ ...d, pertemuan: d.pertemuan.map((x, idx) => (idx === i ? (e.target.value === 'kuliah' ? kuliahKosong() : { jenis: e.target.value }) : x)) }))}
                          className="rounded-[2px] border border-transparent bg-[#FFFBEB] px-1 text-center font-bold hover:border-[#F4A300]/60 focus:border-[#1A3A6B] focus:outline-none"
                        >
                          <option value="UTS">{UJIAN.UTS}</option>
                          <option value="UAS">{UJIAN.UAS}</option>
                          <option value="kuliah">(ubah jadi pertemuan kuliah)</option>
                        </select>
                      </td>
                      <td className={`${td} border-r-[3px] text-center align-middle`} title="Mengikuti bobot komponen di Tabel Penilaian">
                        {bobotUjian(p.jenis) || <span className="font-sans text-[10px] text-red-600">belum ada</span>}
                      </td>
                      {aksi}
                    </tr>
                  )
                }
                return (
                  <tr key={i}>
                    <td className={`${td} border-l-[3px] text-center`}>
                      {i + 1}
                      <select
                        aria-label={`Jenis pertemuan ${i + 1}`}
                        value="kuliah"
                        onChange={(e) => ubahDoc((d) => ({ ...d, pertemuan: d.pertemuan.map((x, idx) => (idx === i ? { jenis: e.target.value } : x)) }))}
                        className="mt-1 w-full rounded-[2px] border border-[#E2E8F0] bg-white font-sans text-[9px] text-[#64748B]"
                        title="Ubah menjadi baris ujian"
                      >
                        <option value="kuliah">Kuliah</option>
                        <option value="UTS">UTS</option>
                        <option value="UAS">UAS</option>
                      </select>
                    </td>
                    <td className={td}><Isian aria-label={`Kemampuan akhir pertemuan ${i + 1}`} placeholder="Mahasiswa mampu ... (C3)" value={p.kemampuan_akhir} onChange={(v) => setItem('pertemuan', i, 'kemampuan_akhir', v)} /></td>
                    <td className={td}>
                      <Isian bold aria-label={`Pokok bahasan pertemuan ${i + 1}`} placeholder="Judul pokok bahasan" value={p.bahan_kajian_judul} onChange={(v) => setItem('pertemuan', i, 'bahan_kajian_judul', v)} />
                      <Isian className="mt-1" aria-label={`Rincian bahan kajian pertemuan ${i + 1}`} placeholder="Rincian sub-pokok bahasan" value={p.bahan_kajian} onChange={(v) => setItem('pertemuan', i, 'bahan_kajian', v)} />
                    </td>
                    <td className={td}><Isian aria-label={`Metode pertemuan ${i + 1}`} placeholder="Case Method, Praktikum" value={p.metode} onChange={(v) => setItem('pertemuan', i, 'metode', v)} /></td>
                    <td className={td}><Isian center aria-label={`Waktu pertemuan ${i + 1}`} placeholder="2 x 50 menit" value={p.waktu} onChange={(v) => setItem('pertemuan', i, 'waktu', v)} /></td>
                    <td className={td}>
                      <Isian aria-label={`Pengalaman belajar pertemuan ${i + 1}`} placeholder="● Satu butir per baris" value={p.pengalaman_belajar} onChange={(v) => setItem('pertemuan', i, 'pengalaman_belajar', v)} />
                    </td>
                    <td className={td}><PilihCpmk ringkas daftar={daftarCpmkValid} value={p.target_cpmk} onChange={(v) => setItem('pertemuan', i, 'target_cpmk', v)} /></td>
                    <td className={td}>
                      <Isian aria-label={`Kriteria dan indikator pertemuan ${i + 1}`} placeholder="Satu butir per baris" value={p.kriteria_indikator} onChange={(v) => setItem('pertemuan', i, 'kriteria_indikator', v)} />
                    </td>
                    <td className={`${td} border-r-[3px]`}><Isian multiline={false} type="number" center aria-label={`Bobot pertemuan ${i + 1}`} value={p.bobot} onChange={(v) => setItem('pertemuan', i, 'bobot', v)} /></td>
                    {aksi}
                  </tr>
                )
              })}
              <tr>
                <td className={`${td} border-x-[3px] text-center`} colSpan={9}>
                  <TambahBaris onClick={() => ubahDoc((d) => ({ ...d, pertemuan: [...d.pertemuan, kuliahKosong()] }))}>Tambah pertemuan di akhir</TambahBaris>
                </td>
                <td className="border-0" />
              </tr>
            </tbody>
          </table>

          <table className="-mt-px w-full border-collapse border-x-[3px] border-b-[3px] border-black">
            <colgroup><col style={{ width: '22.5%' }} /><col style={{ width: '77.5%' }} /></colgroup>
            <tbody>
              <tr>
                <td className={`${td} font-bold`}>Daftar Referensi:</td>
                <td className={td}>
                  <Isian aria-label="Daftar referensi" placeholder="Satu referensi per baris; penomoran otomatis" value={doc.referensi} onChange={(v) => set('referensi', v)} />
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 font-sans text-[11px] text-[#64748B]">
            Nomor pertemuan mengikuti urutan baris. Pengalaman belajar dan kriteria ditulis satu butir per baris; tanda ● dan &quot;-&quot; ditambahkan otomatis di dokumen.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={konfirmasiBatal}
        title="Buang perubahan?"
        message="Perubahan pada RPS ini belum disimpan dan akan hilang."
        onConfirm={() => { setKonfirmasiBatal(false); onCancel() }}
        onCancel={() => setKonfirmasiBatal(false)}
      />
    </div>
  )
}
