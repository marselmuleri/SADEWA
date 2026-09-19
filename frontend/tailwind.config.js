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
    },
  },
  plugins: [],
}
