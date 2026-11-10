// Uji sign out: login sebagai Dosen, klik tombol "Keluar", periksa URL dan token di localStorage.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', 'dosen@sadewa.ac.id'); await p.fill('input[type="password"]', 'password123');
  await p.click('button[type="submit"]'); await p.waitForURL(u => !u.pathname.startsWith('/login'));
  const adaSebelum = await p.evaluate(() => Object.keys(localStorage).filter(k => /token/i.test(k)).length);
  await p.getByRole('button', { name: /Keluar/i }).first().click();
  const konfirmasi = p.getByRole('button', { name: /^(Keluar|Ya, Keluar|Ya)$/i });
  if (await konfirmasi.count() > 1) await konfirmasi.last().click().catch(() => {});
  await p.waitForURL(u => u.pathname.startsWith('/login'), { timeout: 10000 }).catch(() => {});
  const urlAkhir = new URL(p.url()).pathname;
  const adaSesudah = await p.evaluate(() => Object.keys(localStorage).filter(k => /token/i.test(k)).length);
  await p.goto('http://127.0.0.1:5173/dashboard', { waitUntil: 'networkidle' });
  const urlSetelahBukaDashboard = new URL(p.url()).pathname;
  console.log(JSON.stringify({ kunci_token_sebelum: adaSebelum, url_setelah_keluar: urlAkhir, kunci_token_sesudah: adaSesudah, buka_dashboard_tanpa_sesi_diarahkan_ke: urlSetelahBukaDashboard }));
  await b.close();
})();
