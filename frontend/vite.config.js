import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library dipisah ke chunk sendiri: jarang berubah sehingga tetap tersimpan di cache browser
// antar-rilis, dan library grafik (recharts) hanya diunduh oleh halaman yang memakainya.
// Vite selalu memakai "/" pada id modul, juga di Windows.
const VENDOR = [
  ['vendor-react', ['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom', '@remix-run']],
  ['vendor-chart', [
    'recharts', 'recharts-scale', 'react-smooth', 'victory-vendor', 'internmap', 'decimal.js-light', 'eventemitter3',
    'lodash', 'fast-equals', 'tiny-invariant', 'clsx', 'react-is', 'prop-types', 'dom-helpers', 'react-transition-group',
  ]],
  ['vendor-http', ['axios']],
  ['vendor-icons', ['lucide-react']],
]

function chunkVendor(id) {
  const i = id.lastIndexOf('/node_modules/')
  if (i === -1) return undefined
  const sisa = id.slice(i + '/node_modules/'.length)
  const paket = sisa.startsWith('@') ? sisa.split('/').slice(0, 2).join('/') : sisa.split('/')[0]
  if (paket.startsWith('d3-')) return 'vendor-chart'
  const cocok = VENDOR.find(([, daftar]) => daftar.some((p) => paket === p || paket.startsWith(`${p}/`)))
  return cocok ? cocok[0] : undefined
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: chunkVendor,
      },
    },
  },
})
