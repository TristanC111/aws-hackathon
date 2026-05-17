export default function ProgressBar({ percent = 0, label }) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-xs font-medium text-warm-600 uppercase tracking-wide">{label}</span>
          <span className="text-xs font-semibold text-brand-500">{clamped}%</span>
        </div>
      )}
      <div className="h-1.5 w-full bg-warm-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
