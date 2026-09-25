export default function Modal({ open, title, children, onClose, size = 'max-w-lg' }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4 backdrop-blur-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${size} overflow-hidden rounded-[8px] border border-[#E2E8F0] bg-white shadow-md animate-[fadeUp_200ms_ease]`}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5 bg-[#F8FAFC]">
          <h3 className="text-sm font-bold text-[#142B4A]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="rounded-[4px] p-1 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#142B4A] transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
