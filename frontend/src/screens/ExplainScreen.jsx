import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText, AlertTriangle, ArrowRight } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import RiskBanner from '../components/RiskBanner'
import ProgressBar from '../components/ProgressBar'

export default function ExplainScreen() {
  const navigate = useNavigate()
  const { session } = useSession()
  const [activeIndex, setActiveIndex] = useState(0)

  const { sections, documentTitle, highRiskCount } = session

  if (!sections || sections.length === 0) {
    navigate('/')
    return null
  }

  const section = sections[activeIndex]
  const totalSections = sections.length
  const progress = Math.round(((activeIndex + 1) / totalSections) * 100)

  function prev() { setActiveIndex(i => Math.max(0, i - 1)) }
  function next() { setActiveIndex(i => Math.min(totalSections - 1, i + 1)) }

  const riskDot = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-green-400' }

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">

      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-white border-b border-warm-200 px-4 sm:px-6 py-3 shadow-warm-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center h-9 w-9 rounded-xl hover:bg-warm-100 transition-colors shrink-0"
            aria-label="Back"
          >
            <ChevronLeft size={20} className="text-warm-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-warm-300 truncate mb-1 font-medium">{documentTitle}</p>
            <ProgressBar percent={progress} />
          </div>
          <span className="text-xs font-semibold text-warm-600 shrink-0 bg-warm-100 rounded-lg px-2.5 py-1">
            {activeIndex + 1} / {totalSections}
          </span>
        </div>
      </header>

      {/* High-risk alert bar */}
      {highRiskCount > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 sm:px-6 py-2.5 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{highRiskCount} section{highRiskCount !== 1 ? 's' : ''}</span>{' '}
            in this document need legal review before you submit.
          </p>
        </div>
      )}

      {/* Section pill nav */}
      <div className="overflow-x-auto scrollbar-hide bg-white border-b border-warm-100">
        <div className="flex gap-1.5 px-4 sm:px-6 py-2.5 min-w-max max-w-6xl mx-auto">
          {sections.map((s, i) => (
            <button
              key={s.sectionId}
              onClick={() => setActiveIndex(i)}
              className={
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap " +
                (i === activeIndex
                  ? "bg-brand-500 text-white shadow-warm-sm"
                  : "bg-warm-100 text-warm-600 hover:bg-warm-200")
              }
            >
              <span className={"h-1.5 w-1.5 rounded-full shrink-0 " + (riskDot[s.riskLevel] || 'bg-green-400')} />
              Section {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left: original */}
          <div className="rounded-3xl border border-warm-200 bg-white shadow-warm-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-warm-100 flex items-center gap-2.5 bg-warm-50">
              <FileText size={15} className="text-warm-300 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-widest text-warm-600">
                Original text
              </span>
            </div>
            <div className="p-5 lg:p-6">
              <p className="text-sm text-warm-800 leading-loose font-mono whitespace-pre-wrap">
                {section.originalText}
              </p>
            </div>
          </div>

          {/* Right: explanation */}
          <div className="flex flex-col gap-4">
            <RiskBanner riskLevel={section.riskLevel} riskReason={section.riskReason} showLegalAidLink />

            <div className="rounded-3xl border border-warm-200 bg-white shadow-warm-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-warm-100 bg-warm-50">
                <span className="text-xs font-semibold uppercase tracking-widest text-warm-600">
                  What this means
                </span>
              </div>
              <div className="p-5 lg:p-6">
                <p className="text-base text-warm-900 leading-relaxed">{section.plainExplanation}</p>
              </div>
            </div>

            {section.whyItMatters && (
              <div className="rounded-3xl border-l-4 border-brand-500 bg-brand-50 px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-1.5">
                  Why this matters
                </p>
                <p className="text-sm text-warm-800 leading-relaxed">{section.whyItMatters}</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom nav */}
      <div className="sticky bottom-0 bg-white border-t border-warm-200 shadow-warm-sm px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button
            onClick={prev}
            disabled={activeIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-warm-200 text-sm font-medium text-warm-600 hover:bg-warm-50 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={17} /> Previous
          </button>
          <div className="flex-1" />
          {activeIndex < totalSections - 1 ? (
            <button
              onClick={next}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600 transition-colors shadow-warm-sm"
            >
              Next section <ChevronRight size={17} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/form')}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600 transition-colors shadow-warm-sm"
            >
              Fill out the form <ArrowRight size={17} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
