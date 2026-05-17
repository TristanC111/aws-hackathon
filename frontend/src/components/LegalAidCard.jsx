import { Phone, Globe, MapPin } from 'lucide-react'

export default function LegalAidCard({ org }) {
  return (
    <div className="rounded-2xl border border-warm-200 bg-white shadow-warm-sm overflow-hidden">
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-brand-500 to-forest-500" />

      <div className="p-4">
        <h3 className="font-serif font-semibold text-warm-900 text-base leading-snug">
          {org.name}
        </h3>

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-warm-600">
            <MapPin size={14} className="shrink-0 text-warm-300" />
            <span>{org.city}, {org.country}</span>
          </div>

          {org.phone && (
            <a
              href={`tel:${org.phone}`}
              className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              <Phone size={14} className="shrink-0" />
              {org.phone}
            </a>
          )}

          {org.website && (
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              <Globe size={14} className="shrink-0" />
              {org.website.replace('https://', '')}
            </a>
          )}
        </div>

        {org.languages && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {org.languages.map(l => (
              <span
                key={l}
                className="rounded-full bg-warm-100 px-2.5 py-0.5 text-[11px] font-semibold text-warm-600 uppercase tracking-wide"
              >
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
