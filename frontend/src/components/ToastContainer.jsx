export default function ToastContainer({ toasts = [] }) {
  return (
    <div className="fixed right-4 top-4 z-[80] space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-md border px-4 py-3 text-sm shadow-sm ${t.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
