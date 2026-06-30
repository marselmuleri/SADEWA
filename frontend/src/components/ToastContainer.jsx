export default function ToastContainer({ toasts = [] }) {
  return (
    <div className="fixed top-4 right-4 z-[60] space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`px-4 py-2 rounded shadow text-white text-sm ${t.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
