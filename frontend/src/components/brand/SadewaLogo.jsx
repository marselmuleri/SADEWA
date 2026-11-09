// Identitas visual SADEWA (konsep "S siklus OBE dalam lingkaran").
// Sumber tunggal untuk logo di aplikasi: sidebar, login, layar muat, chatbot.
// Aset statis (favicon, ikon PWA, file untuk dokumen) ada di /public dan docs/brand.

// Geometri simbol, viewBox 0 0 200 200. Huruf S dibelah dua (siklus perbaikan OBE):
// busur atas berujung target capaian, busur bawah memuat grafik data.
const BUSUR_ATAS = 'M133.8 53.7A36 36 0 1 0 87.7 99.8'
const BUSUR_BAWAH = 'M112.3 104.2A36 36 0 1 1 66.2 150.3'
const POSISI_ISI = 'translate(100 100) scale(0.8) translate(-100 -102)'
const BATANG = [
  { x: 84, y: 140, h: 14 },
  { x: 96, y: 132, h: 22 },
  { x: 108, y: 124, h: 30 },
]
// Bar statistik versi tebal untuk ukuran kecil (< 56 px) supaya tetap terlihat.
const BATANG_TEBAL = [
  { x: 83, y: 140, h: 11 },
  { x: 96, y: 133, h: 18 },
  { x: 109, y: 126, h: 25 },
]

// Warna mengikuti token tailwind: primary #1A3A6B, tertiary #F4A300.
const PALET = {
  color: { bg: '#1A3A6B', atas: '#FFFFFF', bawah: '#F4A300', isi: '#FFFFFF', target: '#F4A300', titik: '#1A3A6B' },
  onDark: { bg: '#FFFFFF', atas: '#1A3A6B', bawah: '#F4A300', isi: '#1A3A6B', target: '#F4A300', titik: '#1A3A6B' },
  mono: { bg: 'currentColor', atas: '#FFFFFF', bawah: '#FFFFFF', isi: '#FFFFFF', target: '#FFFFFF', titik: 'currentColor' },
}

/**
 * Simbol SADEWA.
 * variant: 'color' (latar terang) | 'onDark' (latar biru/gelap) | 'mono' (ikut currentColor)
 * Huruf S, bar statistik, dan target capaian selalu tampil. Di bawah 56 px garis dan bar
 * dipertebal, sedangkan titik kecil (ujung bawah S, pusat target) dihilangkan agar tidak blur.
 */
export function SadewaMark({ size = 40, variant = 'color', detail, title, className = '' }) {
  const p = PALET[variant] || PALET.color
  const level = detail || (size >= 56 ? 'full' : 'small')
  const tebal = level === 'full' ? 22 : 28
  const batang = level === 'full' ? BATANG : BATANG_TEBAL
  return (
    <svg
      width={size}
      height={size}
      viewBox="10 10 180 180"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <circle cx="100" cy="100" r="90" fill={p.bg} />
      <g transform={POSISI_ISI}>
        <path d={BUSUR_ATAS} fill="none" stroke={p.atas} strokeWidth={tebal} strokeLinecap="round" />
        <path d={BUSUR_BAWAH} fill="none" stroke={p.bawah} strokeWidth={tebal} strokeLinecap="round" />
        {batang.map((b) => (
          <rect key={b.x} x={b.x} y={b.y} width={level === 'full' ? 8 : 9} height={b.h} rx="2" fill={p.isi} />
        ))}
        {level === 'full' ? <circle cx="66.2" cy="150.3" r="14" fill={p.isi} /> : null}
        <circle cx="133.8" cy="53.7" r="21" fill={p.target} />
        {level === 'full' ? <circle cx="133.8" cy="53.7" r="9" fill={p.titik} /> : null}
      </g>
    </svg>
  )
}

// Wordmark "SADEWA" (Plus Jakarta Sans ExtraBold) sudah diubah jadi kurva:
// tampil sama di semua perangkat tanpa memuat font tambahan.
const WORDMARK = 'M33.7 1.2000000000000002Q26.700000000000003 1.2000000000000002 20.55 -1.35Q14.4 -3.9000000000000004 9.95 -8.600000000000001Q5.5 -13.3 3.3000000000000003 -19.700000000000003L16.0 -25.400000000000002Q18.8 -19.3 23.75 -15.8Q28.700000000000003 -12.3 34.7 -12.3Q37.9 -12.3 40.2 -13.3Q42.5 -14.3 43.8 -16.05Q45.1 -17.8 45.1 -20.200000000000003Q45.1 -22.8 43.5 -24.65Q41.900000000000006 -26.5 38.5 -27.6L23.900000000000002 -32.4Q15.0 -35.300000000000004 10.5 -40.650000000000006Q6.0 -46.0 6.0 -53.5Q6.0 -60.1 9.25 -65.10000000000001Q12.5 -70.10000000000001 18.35 -72.9Q24.200000000000003 -75.7 31.8 -75.7Q38.5 -75.7 44.2 -73.4Q49.900000000000006 -71.10000000000001 54.050000000000004 -66.9Q58.2 -62.7 60.300000000000004 -56.800000000000004L47.7 -51.1Q45.6 -56.300000000000004 41.400000000000006 -59.25Q37.2 -62.2 31.8 -62.2Q28.700000000000003 -62.2 26.300000000000004 -61.2Q23.900000000000002 -60.2 22.6 -58.35Q21.3 -56.5 21.3 -54.1Q21.3 -51.5 23.0 -49.55Q24.700000000000003 -47.6 28.1 -46.5L42.400000000000006 -41.900000000000006Q51.400000000000006 -39.0 55.85000000000001 -33.8Q60.300000000000004 -28.6 60.300000000000004 -21.1Q60.300000000000004 -14.600000000000001 56.900000000000006 -9.55Q53.5 -4.5 47.55 -1.65Q41.6 1.2000000000000002 33.7 1.2000000000000002Z M75.8 0.0 101.0 -74.5H121.60000000000001L146.8 0.0H129.9L124.9 -15.200000000000001H97.60000000000001L92.60000000000001 0.0ZM101.9 -28.700000000000003H120.60000000000001L111.30000000000001 -57.400000000000006Z M164.5 0.0V-74.5H188.8Q200.9 -74.5 209.8 -69.7Q218.70000000000002 -64.9 223.60000000000002 -56.5Q228.5 -48.1 228.5 -37.300000000000004Q228.5 -26.5 223.60000000000002 -18.05Q218.70000000000002 -9.600000000000001 209.8 -4.800000000000001Q200.9 0.0 188.8 0.0ZM180.0 -13.5H189.20000000000002Q196.5 -13.5 201.8 -16.450000000000003Q207.10000000000002 -19.400000000000002 210.05 -24.75Q213.0 -30.1 213.0 -37.300000000000004Q213.0 -44.6 210.05 -49.900000000000006Q207.10000000000002 -55.2 201.8 -58.1Q196.5 -61.0 189.20000000000002 -61.0H180.0Z M248.4 0.0V-74.5H298.5V-61.0H263.90000000000003V-44.1H296.5V-30.6H263.90000000000003V-13.5H298.5V0.0Z M331.30000000000007 0.0 311.80000000000007 -74.5H328.6L341.1 -21.400000000000002L354.30000000000007 -74.5H370.30000000000007L383.50000000000006 -21.400000000000002L396.00000000000006 -74.5H412.80000000000007L393.30000000000007 0.0H375.30000000000007L362.30000000000007 -50.0L349.30000000000007 0.0Z M425.00000000000006 0.0 450.20000000000005 -74.5H470.80000000000007L496.00000000000006 0.0H479.1L474.1 -15.200000000000001H446.8L441.8 0.0ZM451.1 -28.700000000000003H469.80000000000007L460.50000000000006 -57.400000000000006Z'

/** Tulisan SADEWA sebagai SVG. Warna mengikuti `currentColor` (atur lewat className text-*). */
export function SadewaWordmark({ height = 20, className = '', title }) {
  const width = (height * 494) / 78
  return (
    <svg
      width={width}
      height={height}
      viewBox="3 -76 494 78"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={WORDMARK} fill="currentColor" />
    </svg>
  )
}

/**
 * Logo lengkap: simbol + SADEWA (+ keterangan opsional).
 * layout: 'horizontal' | 'stacked'; variant: 'color' | 'onDark'.
 */
export function SadewaLogo({ layout = 'horizontal', variant = 'color', size = 40, keterangan, className = '' }) {
  const warnaTeks = variant === 'onDark' ? 'text-white' : 'text-[#1A3A6B]'
  const warnaKet = variant === 'onDark' ? 'text-[#C8D3E1]' : 'text-[#64748B]'
  const stacked = layout === 'stacked'
  return (
    <div
      className={`flex ${stacked ? 'flex-col items-center text-center' : 'items-center'} gap-3 ${className}`}
      role="img"
      aria-label="SADEWA, Sistem Analisis Data Evaluasi Wawasan Akademik"
    >
      <SadewaMark size={size} variant={variant} />
      <div className={`flex flex-col ${stacked ? 'items-center' : ''} gap-1.5`}>
        <SadewaWordmark height={Math.round(size * (stacked ? 0.3 : 0.42))} className={warnaTeks} />
        {keterangan ? <span className={`text-[11px] font-medium ${warnaKet}`}>{keterangan}</span> : null}
      </div>
    </div>
  )
}

/**
 * Simbol beranimasi untuk proses memuat: S tergambar mengikuti siklus,
 * lalu target capaian muncul. Gerak dimatikan bila pengguna memilih reduced motion.
 */
export function SadewaLoader({ size = 64, variant = 'color', className = '' }) {
  const p = PALET[variant] || PALET.color
  return (
    <svg
      width={size}
      height={size}
      viewBox="10 10 180 180"
      className={`sadewa-gerak ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="100" cy="100" r="90" fill={p.bg} />
      <g transform={POSISI_ISI}>
        <g className="sadewa-siklus">
          <path className="sadewa-gambar-1" pathLength="100" d={BUSUR_ATAS} fill="none" stroke={p.atas} strokeWidth="22" strokeLinecap="round" />
          <path className="sadewa-gambar-2" pathLength="100" d={BUSUR_BAWAH} fill="none" stroke={p.bawah} strokeWidth="22" strokeLinecap="round" />
          <g className="sadewa-data">
            {BATANG.map((b) => (
              <rect key={b.x} x={b.x} y={b.y} width="8" height={b.h} rx="2" fill={p.isi} />
            ))}
            <circle cx="66.2" cy="150.3" r="14" fill={p.isi} />
          </g>
          <g className="sadewa-target">
            <circle cx="133.8" cy="53.7" r="21" fill={p.target} />
            <circle cx="133.8" cy="53.7" r="9" fill={p.titik} />
          </g>
        </g>
      </g>
    </svg>
  )
}

/** Layar muat penuh: dipakai saat sesi diperiksa atau halaman berat dimuat. */
export function SplashScreen({ pesan = 'Memuat SADEWA...', className = '' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 ${className}`}
    >
      <SadewaLoader size={88} />
      <div className="flex flex-col items-center gap-2">
        <SadewaWordmark height={20} className="text-[#1A3A6B]" />
        <span className="text-[11px] font-medium text-[#64748B]">Sistem Analisis Data Evaluasi Wawasan Akademik</span>
      </div>
      <span className="text-xs text-[#64748B]">{pesan}</span>
    </div>
  )
}

export default SadewaLogo
