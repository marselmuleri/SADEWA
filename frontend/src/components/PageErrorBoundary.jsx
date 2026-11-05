import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary menangkap error rendering halaman:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleGoDashboard = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/dashboard'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-[400px] flex-col items-center justify-center rounded-[8px] border border-red-200 bg-white p-8 text-center shadow-sm"
          data-testid="error-boundary-card"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-base font-bold text-[#142B4A]">
            Terjadi Kesalahan Saat Memuat Halaman
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-[#64748B] leading-relaxed">
            {this.state.error?.message || 'Halaman mengalami kesalahan runtime yang tidak terduga.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              data-testid="btn-error-reload"
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#1A3A6B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142B4A] transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Muat ulang</span>
            </button>
            <button
              type="button"
              onClick={this.handleGoDashboard}
              data-testid="btn-error-dashboard"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:bg-[#F8FAFC] transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Kembali ke Ikhtisar</span>
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
