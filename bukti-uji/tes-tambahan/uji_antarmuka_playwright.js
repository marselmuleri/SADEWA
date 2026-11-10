// Uji antarmuka headless SADEWA: login per peran, buka halaman utama, ukur waktu muat,
// catat error konsol, simpan tangkapan layar. Pemakaian: node uji_antarmuka_playwright.js <folder_output>
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = 'http://127.0.0.1:5173';
const ULANG = 3;
// Catatan: 'networkidle' baru tercapai setelah 500 ms tanpa aktivitas jaringan, jadi angka ini
// selalu memuat jeda tunggu tersebut. Angka 'h1' = waktu sampai judul halaman tampil.
const PERAN = [
  { peran: 'Super Admin', email: 'superadmin@sadewa.ac.id', halaman: ['/super-admin/fakultas', '/super-admin/prodi', '/super-admin/users'] },
  { peran: 'Admin Prodi', email: 'adminprodi@sadewa.ac.id', halaman: ['/dashboard', '/kurikulum/cpl', '/kurikulum/pemetaan', '/kurikulum/mata-kuliah', '/mahasiswa', '/aturan-penilaian'] },
  { peran: 'Dosen', email: 'dosen@sadewa.ac.id', halaman: ['/dashboard', '/mata-kuliah-saya', '/penilaian', '/penilaian/1/hasil', '/analisis', '/dokumen', '/portofolio'] },
  { peran: 'Kaprodi', email: 'kaprodi@sadewa.ac.id', halaman: ['/dashboard', '/analisis', '/dokumen'] },
  { peran: 'Dekan', email: 'dekan@sadewa.ac.id', halaman: ['/dashboard', '/analisis'] },
];
(async () => {
  const browser = await chromium.launch();
  const hasil = { browser: 'Chromium ' + browser.version(), viewport: '1366x768', ulang: ULANG, peran: [] };
  for (const p of PERAN) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)));
    const r = { peran: p.peran, login: null, halaman: [] };
    let t0 = Date.now();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', p.email);
    await page.fill('input[type="password"]', 'password123');
    await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {}), page.click('button[type="submit"]')]);
    await page.waitForLoadState('networkidle');
    r.login = { berhasil: !page.url().includes('/login'), url_akhir: new URL(page.url()).pathname, ms: Date.now() - t0 };
    const slugPeran = p.peran.toLowerCase().replace(/ /g, '-');
    await page.screenshot({ path: `${OUT}/ui-${slugPeran}-setelah-login.png` });
    for (const h of p.halaman) {
      const waktu = [], waktuH1 = [];
      let urlAkhir = '';
      for (let i = 0; i < ULANG; i++) {
        t0 = Date.now();
        await page.goto(BASE + h, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.locator('h1').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
        waktuH1.push(Date.now() - t0);
        await page.waitForLoadState('networkidle');
        waktu.push(Date.now() - t0);
        urlAkhir = new URL(page.url()).pathname;
      }
      const slug = h.replace(/[\/:]+/g, '-').replace(/^-/, '');
      await page.screenshot({ path: `${OUT}/ui-${slugPeran}-${slug}.png` });
      const judul = (await page.locator('h1').first().textContent({ timeout: 2000 }).catch(() => '')) || '';
      r.halaman.push({ halaman: h, url_akhir: urlAkhir, judul_h1: judul.trim().slice(0, 80), ms_h1: waktuH1, rata2_h1_ms: Math.round(waktuH1.reduce((a, b) => a + b, 0) / waktuH1.length), maks_h1_ms: Math.max(...waktuH1), ms_networkidle: waktu, rata2_ms: Math.round(waktu.reduce((a, b) => a + b, 0) / waktu.length), maks_ms: Math.max(...waktu) });
    }
    r.error_konsol = errs;
    hasil.peran.push(r);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(`${OUT}/antarmuka-playwright.json`, JSON.stringify(hasil, null, 2));
  console.log(JSON.stringify(hasil, null, 1));
})();
