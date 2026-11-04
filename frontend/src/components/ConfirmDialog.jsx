import Modal from './Modal'
import { AlertTriangle, Loader2 } from 'lucide-react'

export default function ConfirmDialog({
  open,
  title = 'Konfirmasi Hapus',
  message = 'Apakah Anda yakin ingin menghapus data ini?',
  warning = null,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  isDestructive = true,
  loading = false,
  confirmTestId = 'confirm-dialog-submit',
}) {
  if (!open) return null

  return (
    <Modal open={open} title={title} onClose={loading ? () => {} : onCancel} size="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              isDestructive ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-[#142B4A]">{message}</p>
            {warning && (
              <div className="rounded-[6px] border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 leading-relaxed">
                {warning}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            data-testid="confirm-dialog-cancel"
            className="rounded-[6px] border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#1A3A6B] hover:text-[#1A3A6B] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            data-testid={confirmTestId}
            className={`inline-flex items-center gap-1.5 rounded-[6px] px-3.5 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#1A3A6B] hover:bg-[#142B4A]'
            }`}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
