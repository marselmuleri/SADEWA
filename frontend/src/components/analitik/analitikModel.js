// Perhitungan Analitik OBE tingkat prodi di browser, dari payload GET /analitik/prodi.
// Semua fungsi murni (tanpa React) supaya mudah diuji dan dipakai ulang antar komponen.

export const TARGET_KETUNTASAN = 70 // % mahasiswa yang harus mencapai threshold agar CPL dianggap aman

export const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)

export const pctAtLeast = (arr, threshold) =>
  arr.length ? (arr.filter((v) => v >= threshold).length / arr.length) * 100 : null

export const stdev = (arr) => {
  if (arr.length < 2) return null
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1))
}

// Bulatkan 1 desimal sebelum membandingkan, supaya status konsisten dengan angka yang ditampilkan.
export const r1 = (v) => (v === null || v === undefined ? v : Math.round(v * 10) / 10)

export const fmt = (v, digits = 1) => (v === null || v === undefined || Number.isNaN(v) ? '–' : Number(v).toFixed(digits))

// Warna sel heatmap/peta berdasarkan jarak nilai ke target.
export function warnaCapaian(value, target) {
  if (value === null || value === undefined) return { bg: '#F2F4F7', fg: '#94A3B8' }
  if (value >= target + 10) return { bg: '#047857', fg: '#FFFFFF' }
  if (value >= target) return { bg: '#A7F3D0', fg: '#064E3B' }
  if (value >= target - 10) return { bg: '#FDE68A', fg: '#78350F' }
  return { bg: '#FCA5A5', fg: '#7F1D1D' }
}

export function buildModel(data) {
  if (!data) return null
  const cpl = data.cpl || []
  const ik = data.ik || []
  const mk = data.mata_kuliah || []
  const cpmk = data.cpmk || []
  const ambangCpmk = data.ambang_cpmk ?? 70
  const cplById = new Map(cpl.map((c) => [c.cpl_id, c]))
  const ikById = new Map(ik.map((i) => [i.ik_id, i]))
  const mkById = new Map(mk.map((m) => [m.mk_id, m]))
  const angkatanSet = new Set()

  // nilai[id][angkatan] = [...] untuk satu level
  const indeks = (rows, idKey) => {
    const out = new Map()
    ;(rows || []).forEach((row) => {
      if (!out.has(row[idKey])) out.set(row[idKey], new Map())
      out.get(row[idKey]).set(row.angkatan, row.nilai || [])
      if (row.angkatan !== null && row.angkatan !== undefined) angkatanSet.add(row.angkatan)
    })
    return out
  }

  // Level yang bisa dianalisis per angkatan: CPL dan CPMK, dengan baris yang seragam.
  const level = {
    cpl: {
      label: 'CPL',
      rows: cpl.map((c) => ({ id: c.cpl_id, kode: c.kode, deskripsi: c.deskripsi, threshold: c.threshold })),
      nilai: indeks(data.capaian_cpl, 'cpl_id'),
    },
    cpmk: {
      label: 'CPMK',
      rows: cpmk.map((c) => ({
        id: c.cpmk_id,
        kode: mk.length > 1 ? `${mkById.get(c.mk_id)?.kode || ''} · ${c.kode}` : c.kode,
        deskripsi: c.deskripsi,
        threshold: ambangCpmk,
      })),
      nilai: indeks(data.capaian_cpmk, 'cpmk_id'),
    },
  }
  const angkatan = Array.from(angkatanSet).sort((a, b) => a - b)

  const valuesL = (lv, id, angk = 'all') => {
    const m = level[lv].nilai.get(id)
    if (!m) return []
    if (angk === 'all') return Array.from(m.values()).flat()
    return m.get(angk) || []
  }
  const statsL = (lv, id, angk = 'all', threshold) => {
    const v = valuesL(lv, id, angk)
    const th = threshold ?? level[lv].rows.find((r) => r.id === id)?.threshold ?? 70
    return { n: v.length, mean: mean(v), pct: pctAtLeast(v, th), sd: stdev(v) }
  }
  // Selisih rata-rata antara dua angkatan terakhir yang punya data.
  const trenL = (lv, id) => {
    const ada = angkatan.filter((a) => valuesL(lv, id, a).length > 0)
    if (ada.length < 2) return null
    const [lama, baru] = ada.slice(-2)
    return { dari: lama, ke: baru, delta: mean(valuesL(lv, id, baru)) - mean(valuesL(lv, id, lama)) }
  }

  // Peta kurikulum: sel[cplId][mkId]
  const peta = new Map()
  ;(data.capaian_cpl_mk || []).forEach((s) => {
    if (!peta.has(s.cpl_id)) peta.set(s.cpl_id, new Map())
    peta.get(s.cpl_id).set(s.mk_id, s)
  })

  return {
    raw: data,
    scope: data.scope || 'prodi', // 'prodi' | 'mata_kuliah'
    cpl, ik, mk, cpmk, cplById, ikById, mkById, angkatan, peta, ambangCpmk, level,
    valuesL, statsL, trenL,
    // Pintasan level CPL (dipakai papan prioritas & temuan)
    values: (id, angk) => valuesL('cpl', id, angk),
    stats: (id, angk, th) => statsL('cpl', id, angk, th),
    tren: (id) => trenL('cpl', id),
  }
}

// ---------------------------------------------------------------------------
// Papan prioritas: item CPL / IK / CPMK yang perlu dievaluasi, diurutkan skor
// ---------------------------------------------------------------------------
export function daftarPrioritas(model, target = TARGET_KETUNTASAN) {
  if (!model) return []
  const items = []

  model.cpl.forEach((c) => {
    const st = model.stats(c.cpl_id)
    if (!st.n) return
    const s = { ...st, mean: r1(st.mean), pct: r1(st.pct) }
    const t = model.tren(c.cpl_id)
    const alasan = []
    if (s.mean < c.threshold) alasan.push(`rata-rata ${fmt(s.mean)}% di bawah target ${fmt(c.threshold, 0)}%`)
    if (s.pct < target) alasan.push(`hanya ${fmt(s.pct, 0)}% mahasiswa mencapai target`)
    if (t && t.delta <= -5) alasan.push(`turun ${fmt(Math.abs(t.delta))} poin dari angkatan ${t.dari} ke ${t.ke}`)
    if (!alasan.length) return
    const skor = Math.max(0, c.threshold - s.mean) + Math.max(0, target - s.pct) * 0.5 + Math.max(0, -(t?.delta || 0))
    items.push({
      id: `cpl-${c.cpl_id}`, level: 'CPL', kode: c.kode, deskripsi: c.deskripsi, nilai: s.mean, pct: s.pct, n: s.n,
      target: c.threshold, alasan, skor, tingkat: s.mean < c.threshold - 10 || s.pct < 50 ? 'kritis' : 'perhatian',
      cplId: c.cpl_id,
    })
  })

  model.ik.forEach((ikRaw) => {
    if (!ikRaw.jumlah_mahasiswa) return
    const i = { ...ikRaw, rata_rata: r1(ikRaw.rata_rata), persen_tercapai: r1(ikRaw.persen_tercapai) }
    const cpl = model.cplById.get(i.cpl_id)
    const th = cpl?.threshold ?? 70
    const alasan = []
    if (i.rata_rata < th) alasan.push(`rata-rata ${fmt(i.rata_rata)}% di bawah target ${fmt(th, 0)}%`)
    if (i.persen_tercapai < target) alasan.push(`hanya ${fmt(i.persen_tercapai, 0)}% mahasiswa mencapai target`)
    if (!alasan.length) return
    const lemahDi = (i.per_mk || [])
      .filter((p) => p.jumlah_mahasiswa)
      .sort((a, b) => a.rata_rata - b.rata_rata)[0]
    if (lemahDi && r1(lemahDi.rata_rata) < th) {
      alasan.push(`terendah di ${model.mkById.get(lemahDi.mk_id)?.kode || 'MK'} (${fmt(lemahDi.rata_rata)}%)`)
    }
    items.push({
      id: `ik-${i.ik_id}`, level: 'IK', kode: i.kode, deskripsi: i.deskripsi, nilai: i.rata_rata, pct: i.persen_tercapai,
      n: i.jumlah_mahasiswa, target: th, alasan,
      skor: Math.max(0, th - i.rata_rata) + Math.max(0, target - i.persen_tercapai) * 0.5,
      tingkat: i.rata_rata < th - 10 || i.persen_tercapai < 50 ? 'kritis' : 'perhatian',
      cplId: i.cpl_id, ikId: i.ik_id, induk: cpl?.kode,
    })
  })

  model.cpmk.forEach((cRaw) => {
    if (!cRaw.jumlah_mahasiswa) return
    const c = { ...cRaw, rata_rata: r1(cRaw.rata_rata) }
    const th = model.ambangCpmk
    const pct = r1((c.jumlah_tercapai / c.jumlah_mahasiswa) * 100)
    const alasan = []
    if (c.rata_rata < th) alasan.push(`rata-rata ${fmt(c.rata_rata)}% di bawah ambang ${fmt(th, 0)}%`)
    if (pct < target) alasan.push(`ketuntasan ${fmt(pct, 0)}% (${c.jumlah_tercapai}/${c.jumlah_mahasiswa})`)
    if (!alasan.length) return
    const mk = model.mkById.get(c.mk_id)
    items.push({
      id: `cpmk-${c.cpmk_id}`, level: 'CPMK', kode: c.kode, deskripsi: c.deskripsi, nilai: c.rata_rata, pct,
      n: c.jumlah_mahasiswa, target: th, alasan,
      skor: Math.max(0, th - c.rata_rata) + Math.max(0, target - pct) * 0.5,
      tingkat: c.rata_rata < th - 10 || pct < 50 ? 'kritis' : 'perhatian',
      induk: mk ? `${mk.kode} — ${mk.nama}` : null, mkId: c.mk_id,
    })
  })

  return items.sort((a, b) => b.skor - a.skor)
}

// ---------------------------------------------------------------------------
// Kartu temuan otomatis (deterministik, dari data; bukan AI)
// ---------------------------------------------------------------------------
export function daftarTemuan(model) {
  if (!model) return []
  const out = []
  const cplData = model.cpl.map((c) => ({ c, s: model.stats(c.cpl_id), t: model.tren(c.cpl_id) })).filter((x) => x.s.n)

  if (cplData.length) {
    const terendah = [...cplData].sort((a, b) => a.s.mean - b.s.mean)[0]
    const iks = model.ik.filter((i) => i.cpl_id === terendah.c.cpl_id && i.jumlah_mahasiswa).sort((a, b) => a.rata_rata - b.rata_rata)
    out.push({
      id: 'cpl-terendah',
      tingkat: terendah.s.mean < terendah.c.threshold ? 'kritis' : 'info',
      judul: `${terendah.c.kode} paling rendah`,
      isi: `Rata-rata ${fmt(terendah.s.mean)}% (target ${fmt(terendah.c.threshold, 0)}%), ${fmt(terendah.s.pct, 0)}% mahasiswa mencapai target.${
        iks[0] ? ` Indikator terlemah: ${iks[0].kode} (${fmt(iks[0].rata_rata)}%).` : ''
      }`,
      aksi: { tab: 'drilldown', cplId: terendah.c.cpl_id, label: 'Buka drill-down' },
    })

    const turun = cplData.filter((x) => x.t && x.t.delta <= -3).sort((a, b) => a.t.delta - b.t.delta)[0]
    if (turun) {
      out.push({
        id: 'penurunan',
        tingkat: turun.t.delta <= -5 ? 'kritis' : 'perhatian',
        judul: `${turun.c.kode} menurun`,
        isi: `Turun ${fmt(Math.abs(turun.t.delta))} poin dari angkatan ${turun.t.dari} ke ${turun.t.ke}. Periksa perubahan pembelajaran atau asesmen di antara dua angkatan ini.`,
        aksi: { tab: 'perbandingan', label: 'Bandingkan angkatan' },
      })
    }

    const naik = cplData.filter((x) => x.t && x.t.delta >= 3).sort((a, b) => b.t.delta - a.t.delta)[0]
    if (naik) {
      out.push({
        id: 'kenaikan',
        tingkat: 'positif',
        judul: `${naik.c.kode} membaik`,
        isi: `Naik ${fmt(naik.t.delta)} poin dari angkatan ${naik.t.dari} ke ${naik.t.ke}. Praktik pembelajarannya layak dipertahankan.`,
        aksi: { tab: 'perbandingan', label: 'Bandingkan angkatan' },
      })
    }

    const lebar = cplData.filter((x) => x.s.sd !== null && x.s.n >= 5).sort((a, b) => b.s.sd - a.s.sd)[0]
    if (lebar && lebar.s.sd >= 12) {
      out.push({
        id: 'sebaran',
        tingkat: 'perhatian',
        judul: `Kesenjangan lebar di ${lebar.c.kode}`,
        isi: `Simpangan baku ${fmt(lebar.s.sd)} poin: capaian mahasiswa sangat beragam. Rata-rata bisa menutupi kelompok yang tertinggal.`,
        aksi: { tab: 'simulator', label: 'Lihat sebaran' },
      })
    }
  }

  const cpmkLemah = model.cpmk
    .filter((c) => c.jumlah_mahasiswa)
    .map((c) => ({ c, pct: (c.jumlah_tercapai / c.jumlah_mahasiswa) * 100 }))
    .sort((a, b) => a.pct - b.pct)[0]
  if (cpmkLemah && cpmkLemah.pct < TARGET_KETUNTASAN) {
    const mk = model.mkById.get(cpmkLemah.c.mk_id)
    out.push({
      id: 'cpmk-lemah',
      tingkat: cpmkLemah.pct < 50 ? 'kritis' : 'perhatian',
      judul: `${cpmkLemah.c.kode} (${mk?.kode || 'MK'}) ketuntasan terendah`,
      isi: `Hanya ${fmt(cpmkLemah.pct, 0)}% mahasiswa mencapai ${fmt(model.ambangCpmk, 0)}% (rata-rata ${fmt(cpmkLemah.c.rata_rata)}%). Kandidat revisi CPMK atau asesmennya.`,
      aksi: { tab: 'ringkasan', label: 'Lihat di papan prioritas' },
    })
  }

  // CPMK yang paling menurun antar dua angkatan terakhir
  const cpmkTurun = model.level.cpmk.rows
    .map((r) => ({ r, t: model.trenL('cpmk', r.id) }))
    .filter((x) => x.t && x.t.delta <= -3)
    .sort((a, b) => a.t.delta - b.t.delta)[0]
  if (cpmkTurun) {
    out.push({
      id: 'cpmk-turun',
      tingkat: cpmkTurun.t.delta <= -5 ? 'kritis' : 'perhatian',
      judul: `${cpmkTurun.r.kode} menurun`,
      isi: `Rata-rata CPMK turun ${fmt(Math.abs(cpmkTurun.t.delta))} poin dari angkatan ${cpmkTurun.t.dari} ke ${cpmkTurun.t.ke}.`,
      aksi: { tab: 'perbandingan', label: 'Bandingkan angkatan' },
    })
  }

  // Temuan cakupan kurikulum hanya relevan untuk seluruh prodi
  if (model.scope === 'mata_kuliah') {
    const urutMk = { kritis: 0, perhatian: 1, info: 2, positif: 3 }
    return out.sort((a, b) => urutMk[a.tingkat] - urutMk[b.tingkat])
  }

  // Risiko kurikulum: CPL yang didukung sedikit mata kuliah
  const dukungan = model.cpl.map((c) => ({ c, jumlah: model.peta.get(c.cpl_id)?.size || 0 }))
  const tanpa = dukungan.filter((d) => d.jumlah === 0)
  const tunggal = dukungan.filter((d) => d.jumlah === 1)
  if (tanpa.length) {
    out.push({
      id: 'cpl-tanpa-mk',
      tingkat: 'kritis',
      judul: `${tanpa.length} CPL tanpa mata kuliah pendukung`,
      isi: `${tanpa.map((d) => d.c.kode).join(', ')} tidak dipetakan ke CPMK mana pun, sehingga tidak pernah terukur.`,
      aksi: { tab: 'peta', label: 'Buka peta kurikulum' },
    })
  }
  if (tunggal.length) {
    out.push({
      id: 'cpl-satu-mk',
      tingkat: 'perhatian',
      judul: `${tunggal.length} CPL hanya bergantung pada 1 mata kuliah`,
      isi: `${tunggal.map((d) => d.c.kode).join(', ')}: capaiannya sepenuhnya ditentukan satu mata kuliah. Pertimbangkan menambah mata kuliah pendukung.`,
      aksi: { tab: 'peta', label: 'Buka peta kurikulum' },
    })
  }

  // Sel peta dengan capaian terendah (MK yang menahan capaian suatu CPL)
  const sel = (model.raw.capaian_cpl_mk || []).filter((s) => s.jumlah_mahasiswa && s.rata_rata !== null)
  const terlemah = sel.sort((a, b) => a.rata_rata - b.rata_rata)[0]
  if (terlemah) {
    const c = model.cplById.get(terlemah.cpl_id)
    const m = model.mkById.get(terlemah.mk_id)
    if (c && m && terlemah.rata_rata < c.threshold) {
      out.push({
        id: 'mk-penahan',
        tingkat: 'perhatian',
        judul: `${m.kode} menahan capaian ${c.kode}`,
        isi: `Capaian ${c.kode} di ${m.nama} hanya ${fmt(terlemah.rata_rata)}% dengan bobot kontribusi ${fmt(terlemah.bobot_cp, 0)}.`,
        aksi: { tab: 'peta', label: 'Buka peta kurikulum' },
      })
    }
  }

  const kosong = model.cpl.filter((c) => !model.values(c.cpl_id).length && (model.peta.get(c.cpl_id)?.size || 0) > 0)
  if (kosong.length) {
    out.push({
      id: 'cpl-tanpa-data',
      tingkat: 'info',
      judul: `${kosong.length} CPL belum punya data capaian`,
      isi: `${kosong.map((c) => c.kode).join(', ')} sudah dipetakan, tetapi mata kuliahnya belum dikalkulasi.`,
      aksi: null,
    })
  }

  const urut = { kritis: 0, perhatian: 1, info: 2, positif: 3 }
  return out.sort((a, b) => urut[a.tingkat] - urut[b.tingkat])
}
