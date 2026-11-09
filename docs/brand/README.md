# Logo SADEWA

Simbol: huruf **S** dibelah dua di dalam lingkaran biru. Busur atas (putih) berujung **target capaian**, busur bawah (emas) memuat **grafik data**. Maknanya: siklus perbaikan berkelanjutan OBE, dari data menuju capaian pembelajaran.

## Warna

| Nama | Hex | Token tailwind |
| --- | --- | --- |
| Biru SADEWA | `#1A3A6B` | `primary` |
| Emas capaian | `#F4A300` | `tertiary` |
| Teks gelap | `#142B4A` | `primaryDark` |
| Putih | `#FFFFFF` | `surface` |

Wordmark: Plus Jakarta Sans ExtraBold (sudah diubah jadi kurva, tidak perlu memasang font).

## File

| Folder | Isi | Pakai untuk |
| --- | --- | --- |
| `lengkap/` | Simbol + SADEWA + kepanjangan (SVG, PNG ±2000 px) | Sampul skripsi, poster, slide sidang |
| `horizontal/` | Simbol + SADEWA + "OBE · Universitas Diponegoro" | Header dokumen, kop laporan, slide |
| `ikon/` | Simbol saja (SVG, PNG 512 & 2000 px) | Ikon, foto profil, stiker |

Akhiran nama file: tanpa akhiran = latar terang · `-latar-gelap` = latar biru/gelap · `-hitam` = cetak satu warna · `-putih` = satu warna di latar gelap.

## Aturan pakai

- Ruang kosong di sekeliling logo minimal setinggi huruf S pada wordmark.
- Ukuran minimum: simbol 16 px (favicon memakai versi sederhana), logo horizontal lebar 120 px.
- Jangan mengubah warna, meregangkan, memutar, atau menambah efek bayangan/gradasi.
- Jika tampil bersama lambang resmi Universitas Diponegoro, letakkan berdampingan dengan pemisah, jangan digabung.

## Di aplikasi (frontend)

Komponen ada di `frontend/src/components/brand/SadewaLogo.jsx`:

- `SadewaMark` — simbol; `variant="color" | "onDark" | "mono"`, detail menyesuaikan ukuran otomatis.
- `SadewaWordmark` — tulisan SADEWA, warna mengikuti `className` (`text-*`).
- `SadewaLogo` — simbol + wordmark, `layout="horizontal" | "stacked"`.
- `SadewaLoader` — simbol beranimasi untuk proses memuat.
- `SplashScreen` — layar muat penuh.

Favicon, ikon PWA, dan manifest ada di `frontend/public/`.
