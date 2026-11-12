import React from 'react'
import { Link } from 'react-router-dom'

const VARIANT_STYLES = {
  primary:
    'border border-[#1A3A6B] bg-white text-[#1A3A6B] hover:bg-[#1A3A6B] hover:text-white',
  'primary-solid':
    'border border-[#1A3A6B] bg-[#1A3A6B] text-white hover:bg-[#142B4A]',
  secondary:
    'border border-[#CBD5E1] bg-white text-[#142B4A] hover:border-[#1A3A6B] hover:text-[#1A3A6B]',
  danger:
    'border border-red-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-300',
  success:
    'border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400',
}

const BASE_BUTTON_CLASSES =
  'inline-flex h-7 items-center justify-center gap-1.5 rounded-[4px] px-2.5 text-xs font-semibold whitespace-nowrap transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed'

/**
 * Container grup tombol aksi dalam sel tabel.
 * Menjamin semua tombol aksi berada dalam 1 baris, rata kanan, tanpa membungkus.
 */
export function TableActions({ children, className = '', ...props }) {
  return (
    <div
      className={`flex items-center justify-end gap-1.5 flex-nowrap whitespace-nowrap ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Header sel Aksi tabel (`<th>`) dengan lebar menyesuaikan konten (shrink-to-fit)
 * dan whitespace-nowrap agar tidak tertekan kolom deskripsi.
 */
export function TableActionHeader({
  children = 'Aksi',
  className = '',
  ...props
}) {
  return (
    <th
      className={`w-px whitespace-nowrap px-4 py-3 text-right ${className}`}
      {...props}
    >
      {children}
    </th>
  )
}

/**
 * Sel Aksi tabel (`<td>`) dengan lebar menyesuaikan konten dan align-top
 * agar sejajar dengan baris pertama teks kolom deskripsi.
 */
export function TableActionCell({ children, className = '', ...props }) {
  return (
    <td
      className={`w-px whitespace-nowrap px-4 py-3 text-right align-top ${className}`}
      {...props}
    >
      <TableActions>{children}</TableActions>
    </td>
  )
}

/**
 * Tombol aksi berukuran seragam untuk tabel.
 * Mendukung Pola (a): teks label responsif (tersembunyi pada layar sangat sempit,
 * tetap ada aria-label dan title tooltip).
 */
export function TableActionButton({
  variant = 'secondary',
  icon: Icon,
  label,
  children,
  responsive = true,
  title,
  'aria-label': ariaLabel,
  className = '',
  type = 'button',
  ...props
}) {
  const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES.secondary
  const resolvedTitle =
    title || (typeof label === 'string' ? label : undefined)
  const resolvedAria =
    ariaLabel || (typeof label === 'string' ? label : undefined)

  return (
    <button
      type={type}
      title={resolvedTitle}
      aria-label={resolvedAria}
      className={`${BASE_BUTTON_CLASSES} ${variantClass} ${className}`}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {label && (
        <span className={responsive ? 'hidden sm:inline' : undefined}>
          {label}
        </span>
      )}
      {children}
    </button>
  )
}

/**
 * Tautan aksi berukuran seragam (React Router Link) untuk tabel.
 */
export function TableActionLink({
  to,
  variant = 'secondary',
  icon: Icon,
  label,
  children,
  responsive = true,
  title,
  'aria-label': ariaLabel,
  className = '',
  ...props
}) {
  const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES.secondary
  const resolvedTitle =
    title || (typeof label === 'string' ? label : undefined)
  const resolvedAria =
    ariaLabel || (typeof label === 'string' ? label : undefined)

  return (
    <Link
      to={to}
      title={resolvedTitle}
      aria-label={resolvedAria}
      className={`${BASE_BUTTON_CLASSES} ${variantClass} ${className}`}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {label && (
        <span className={responsive ? 'hidden sm:inline' : undefined}>
          {label}
        </span>
      )}
      {children}
    </Link>
  )
}

export default TableActions
