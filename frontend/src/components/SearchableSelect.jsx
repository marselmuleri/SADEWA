import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'

const PANEL_MAX_HEIGHT = 340

const normalize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

// Skor kecocokan: 0 = label/nama diawali kata kunci, 1 = setiap kata kunci menjadi awalan
// salah satu kata (mis. "sis ken" → "Sistem Kendali"). -1 = tidak cocok.
function matchScore(option, query) {
  const haystack = normalize(`${option.label} ${option.searchText || ''}`)
  if (haystack.startsWith(query) || normalize(option.searchText).startsWith(query)) return 0
  const words = haystack.split(/[\s\-–·(),/.]+/).filter(Boolean)
  const terms = query.split(/\s+/).filter(Boolean)
  if (terms.every((term) => words.some((word) => word.startsWith(term)))) return 1
  return -1
}

// Ukuran bawaan hanya dipakai bila pemanggil tidak menentukan sendiri,
// karena urutan kelas Tailwind yang bentrok tidak bisa diandalkan.
function sizeDefaults(custom) {
  const parts = []
  if (!/(^|\s)px-/.test(custom)) parts.push('px-3')
  if (!/(^|\s)(py-|h-)/.test(custom)) parts.push('py-2')
  if (!/(^|\s)text-(xs|sm|base|lg)(\s|$)/.test(custom)) parts.push('text-sm')
  return parts.join(' ')
}

/**
 * Dropdown yang bisa dicari. Setiap huruf yang diketik langsung menyaring daftar.
 *
 * options: [{ value, label, description?, searchText?, disabled? }]
 * onChange menerima value (bukan event).
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Ketik untuk mencari...',
  emptyText = 'Tidak ada hasil yang cocok',
  disabled = false,
  className = '',
  buttonClassName = '',
  'data-testid': testId,
  id,
  'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState(null)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()

  // Panel dirender ke <body> agar tidak terpotong oleh modal/kartu yang overflow-hidden.
  useLayoutEffect(() => {
    if (!open) return undefined
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < PANEL_MAX_HEIGHT && rect.top > spaceBelow
      setPosition({
        left: rect.left,
        width: Math.max(rect.width, 240),
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const selected = options.find((opt) => String(opt.value) === String(value ?? ''))

  const filtered = useMemo(() => {
    const q = normalize(query)
    if (!q) return options
    return options
      .map((opt, index) => ({ opt, index, score: matchScore(opt, q) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .map((item) => item.opt)
  }, [options, query])

  useEffect(() => {
    if (!open) return undefined
    const handleClickOutside = (event) => {
      const insideRoot = rootRef.current?.contains(event.target)
      const insidePanel = panelRef.current?.contains(event.target)
      if (!insideRoot && !insidePanel) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      const selectedIndex = options.findIndex((opt) => String(opt.value) === String(value ?? ''))
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const choose = (opt) => {
    if (!opt || opt.disabled) return
    onChange?.(opt.value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(filtered[activeIndex])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-testid={testId}
        className={`flex w-full items-center justify-between gap-2 rounded-[6px] border border-[#CBD5E1] bg-white text-left text-[#142B4A] transition-colors focus:border-[#1A3A6B] focus:outline-none focus:ring-1 focus:ring-[#1A3A6B] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8] ${sizeDefaults(buttonClassName)} ${buttonClassName}`}
      >
        <span className={`truncate ${selected ? '' : 'text-[#94A3B8]'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && position ? createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', left: position.left, width: position.width, top: position.top, bottom: position.bottom }}
          className="z-[90] overflow-hidden rounded-[6px] border border-[#CBD5E1] bg-white shadow-lg"
        >
          <div className="relative border-b border-[#E2E8F0] p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              data-testid={testId ? `${testId}-search` : undefined}
              className="h-9 w-full rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] pl-8 pr-3 text-sm text-[#142B4A] placeholder:text-[#94A3B8] focus:border-[#1A3A6B] focus:bg-white focus:outline-none"
            />
          </div>

          <ul ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-[#64748B]">{emptyText}</li>
            ) : (
              filtered.map((opt, index) => {
                const isSelected = String(opt.value) === String(value ?? '')
                const isActive = index === activeIndex
                return (
                  <li
                    key={`${opt.value}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(opt)}
                    className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-sm ${
                      opt.disabled ? 'cursor-not-allowed text-[#94A3B8]' : 'text-[#142B4A]'
                    } ${isActive && !opt.disabled ? 'bg-[#EEF3FA]' : ''}`}
                  >
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 text-[#1A3A6B] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="min-w-0">
                      <span className={`block ${isSelected ? 'font-semibold' : ''}`}>{opt.label}</span>
                      {opt.description ? (
                        <span className="block text-xs text-[#64748B]">{opt.description}</span>
                      ) : null}
                    </span>
                  </li>
                )
              })
            )}
          </ul>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
