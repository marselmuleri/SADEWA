import { Building2, AlertCircle } from 'lucide-react'
import { useDekanScope } from '../context/DekanScopeContext'

export default function ProdiSelector({ className = '' }) {
  const {
    isDekan,
    prodiList,
    selectedProdiId,
    setSelectedProdiId,
    loadingProdi,
    prodiError,
  } = useDekanScope()

  if (!isDekan) return null

  return (
    <div
      data-testid="dekan-prodi-selector-wrapper"
      className={`rounded-[6px] border border-[#CBD5E1] bg-white p-3.5 shadow-sm ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#1A3A6B]/10 text-[#1A3A6B]">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6D778E]">
              Lingkup Pengawasan Dekan
            </div>
            <div className="text-xs font-semibold text-[#142B4A]">
              Pilih Program Studi di Fakultas Anda
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {loadingProdi ? (
            <div className="text-xs text-[#64748B] italic">Memuat prodi...</div>
          ) : prodiList.length === 0 ? (
            <div className="text-xs text-[#D97706] font-medium flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Tidak ada program studi terdaftar di fakultas ini</span>
            </div>
          ) : (
            <div className="w-full sm:w-72">
              <select
                value={selectedProdiId || ''}
                onChange={(e) => setSelectedProdiId(e.target.value)}
                data-testid="dekan-prodi-selector"
                className="h-9 w-full rounded-[6px] border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#142B4A] shadow-sm transition-colors focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B] cursor-pointer"
              >
                <option value="" disabled>
                  -- Pilih Program Studi --
                </option>
                {prodiList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} ({p.kode})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {prodiError && (
        <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{prodiError}</span>
        </div>
      )}
    </div>
  )
}
