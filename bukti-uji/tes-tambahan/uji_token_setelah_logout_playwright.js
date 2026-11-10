// Uji token setelah sign out: token disalin sebelum klik "Keluar", lalu dipakai lagi ke GET /auth/me.
// Token tidak dicetak; yang dicatat hanya kode status HTTP.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', 'dosen@sadewa.ac.id'); await p.fill('input[type="password"]', 'password123');
  await p.click('button[type="submit"]'); await p.waitForURL(u => !u.pathname.startsWith('/login'));
  const token = await p.evaluate(() => localStorage.getItem('token'));
  const cek = async () => (await p.request.get('http://127.0.0.1:8000/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + token } })).status();
  const sebelum = await cek();
  await p.getByRole('button', { name: /Keluar/i }).first().click();
  const konfirmasi = p.getByRole('button', { name: /^(Keluar|Ya, Keluar|Ya)$/i });
  if (await konfirmasi.count() > 1) await konfirmasi.last().click().catch(() => {});
  await p.waitForURL(u => u.pathname.startsWith('/login'), { timeout: 10000 }).catch(() => {});
  const sesudah = await cek();
  console.log(JSON.stringify({ status_me_sebelum_keluar: sebelum, url_setelah_keluar: new URL(p.url()).pathname, status_me_dengan_token_lama_setelah_keluar: sesudah }));
  await b.close();
})();
