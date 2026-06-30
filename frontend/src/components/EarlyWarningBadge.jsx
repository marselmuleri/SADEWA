export default function EarlyWarningBadge({ isWarning }) {
  if (!isWarning) return null
  return <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">Early Warning</span>
}
