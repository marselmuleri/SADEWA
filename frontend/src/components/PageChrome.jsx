export function PageHeader({ eyebrow, title, description, actions, badge }) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl space-y-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-0.5 w-12 bg-[#F4A300]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D778E]">{eyebrow}</span>
          {badge ? <span className="rounded-full border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#142B4A]">{badge}</span> : null}
        </div>
        <h1 className="text-[31px] font-semibold tracking-tight text-[#142B4A]">{title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-[#64748B]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}

export function SectionCard({ title, description, children, className = '', action }) {
  return (
    <section className={`rounded-lg border border-[#E2E8F0] bg-white ${className}`}>
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] px-5 py-4">
          <div>
            {title ? <h2 className="text-[17px] font-semibold text-[#142B4A]">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-[#64748B]">{description}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

// Warna `accent` lama (kelas teks) dipetakan ke nada kartu agar makna warnanya tetap
// (mis. merah untuk laporan ditolak). Tanpa accent, warna kartu bergiliran (lihat index.css).
function toneFromAccent(accent) {
  if (!accent) return undefined
  if (/DC2626|EF4444|red-/i.test(accent)) return 'red'
  if (/F4A300|D97706|amber-/i.test(accent)) return 'amber'
  if (/10B981|047857|emerald-|green-/i.test(accent)) return 'green'
  if (/64748B|slate-/i.test(accent)) return 'slate'
  return undefined
}

export function StatCard({ label, value, caption, icon, accent, tone }) {
  const cardTone = tone || toneFromAccent(accent)
  return (
    <article
      data-tone={cardTone}
      className="stat-card rounded-lg p-5 shadow-sm transition-transform hover:-translate-y-px hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#334155]">{label}</p>
          <div className="stat-card-nilai mt-3 text-[32px] font-bold tracking-tight">{value}</div>
          {caption ? <p className="mt-2 text-sm font-medium text-[#475569]">{caption}</p> : null}
        </div>
        {icon ? (
          <div className="stat-card-ikon shrink-0 rounded-lg p-2.5 shadow-sm [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
        ) : null}
      </div>
    </article>
  )
}

export function Badge({ children, tone = 'default' }) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-[#E2E8F0] bg-[#F2F4F7] text-[#142B4A]'

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>{children}</span>
}

export function ActionButton({ children, variant = 'primary', className = '', type = 'button', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A3A6B] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
  const styles =
    variant === 'secondary'
      ? 'border border-[#CBD5E1] bg-white text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B]'
      : variant === 'ghost'
        ? 'border border-transparent bg-transparent text-[#142B4A] hover:bg-[#F8FAFC]'
        : 'bg-[#1A3A6B] text-white hover:bg-[#142B4A]'

  return (
    <button type={type} className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  )
}
