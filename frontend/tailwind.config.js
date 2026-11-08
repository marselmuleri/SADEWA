/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1A3A6B',
        primaryDark: '#142B4A',
        secondary: '#6D778E',
        tertiary: '#F4A300',
        success: '#10B981',
        danger: '#EF4444',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        border: '#E2E8F0',
        muted: '#F2F4F7',
      },
      // Animasi tampilan proses AI (components/AiLoadingStage.jsx). Dimatikan otomatis
      // oleh aturan prefers-reduced-motion di index.css.
      keyframes: {
        'sel-isi': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'baris-tulis': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        kilau: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'bar-naik': {
          '0%, 100%': { transform: 'scaleY(0.45)' },
          '50%': { transform: 'scaleY(1)' },
        },
        denyut: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        'sorot-pudar': {
          '0%': { boxShadow: '0 0 0 3px rgba(244, 163, 0, 0.55)' },
          '100%': { boxShadow: '0 0 0 3px rgba(244, 163, 0, 0)' },
        },
      },
      animation: {
        'sel-isi': 'sel-isi 420ms ease-out both',
        'baris-tulis': 'baris-tulis 900ms ease-out both',
        kilau: 'kilau 2.4s linear infinite',
        'bar-naik': 'bar-naik 2.6s ease-in-out infinite',
        denyut: 'denyut 1.6s ease-in-out infinite',
        'sorot-pudar': 'sorot-pudar 2.4s ease-out both',
      },
    },
  },
  plugins: [],
}
