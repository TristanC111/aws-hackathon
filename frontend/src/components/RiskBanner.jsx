import { AlertTriangle, Info, ExternalLink } from 'lucide-react'

const config = {
  high: {
    icon:        AlertTriangle,
    border:      'border-red-400',
    bg:          'bg-red-50',
    label:       'Legal Review Recommended',
    labelColor:  'text-red-700',
    bodyColor:   'text-red-600',
    iconColor:   'text-red-500',
    dot:         'bg-red-400',
  },
  medium: {
    icon:        Info,
    border:      'border-amber-400',
    bg:          'bg-amber-50',
    label:       'Read Carefully',
    labelColor:  'text-amber-700',
    bodyColor:   'text-amber-600',
    iconColor:   'text-amber-500',
    dot:         'bg-amber-400',
  },
  low: null, // not rendered
}

export default function RiskBanner({ riskLevel = 'low', riskReason, showLegalAidLink = false }) {
  const c = config[riskLevel]
  if (!c || (!riskReason && riskLevel === 'low')) return null

  const Icon = c.icon

  return (
    <div className={`flex gap-3 rounded-2xl border-l-4 ${c.border} ${c.bg} px-4 py-3.5`}>
      <Icon size={18} className={`shrink-0 mt-0.5 ${c.iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold uppercase tracking-wide ${c.labelColor}`}>
          {c.label}
        </p>
        {riskReason && (
          <p className={`text-sm mt-1 leading-relaxed ${c.bodyColor}`}>{riskReason}</p>
        )}
        {riskLevel === 'high' && showLegalAidLink && (
          <a
            href="#legal-aid"
            className={`inline-flex items-center gap-1 text-xs font-semibold mt-2 underline underline-offset-2 ${c.labelColor}`}
          >
            Find free legal help <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  )
}
