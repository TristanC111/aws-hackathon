import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Download, Edit2, AlertTriangle, CheckCircle, Globe, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSession } from '../context/SessionContext'
import { generateDraft } from '../api/client'
import { getLegalAidByLanguage } from '../data/legalAid'
import LegalAidCard from '../components/LegalAidCard'
import Spinner from '../components/Spinner'

export default function ReviewScreen() {
  const navigate = useNavigate()
  const { session, dispatch } = useSession()
  const [isGenerating, setIsGenerating] = useState(false)
  const [draftResult, setDraftResult] = useState(null)

  if (!session.sessionId) {
    navigate('/')
    return null
  }

  const legalAidOrgs = getLegalAidByLanguage(session.language).slice(0, 3)
  const flaggedSections = session.sections.filter(s => s.riskLevel === 'high')

  async function handleGenerateDraft() {
    setIsGenerating(true)
    try {
      const result = await generateDraft(session.sessionId, session.language)
      setDraftResult(result)
      dispatch({ type: 'SET_COMPLETE' })
      toast.success('Your draft is ready!')
    } catch {
      toast.error('Could not generate your draft. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const answersPanel = (
    <>
      {/* Answers list */}
      <div className="rounded-3xl border border-warm-200 bg-white shadow-warm-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-warm-100 flex items-center justify-between">
          <h3 className="font-serif font-semibold text-warm-900">Your answers</h3>
          <span className="text-xs font-medium text-warm-300 bg-warm-100 rounded-lg px-2.5 py-1">
            {session.answers.length} completed
          </span>
        </div>

        {session.answers.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-warm-300 mb-2">No answers saved yet.</p>
            <button
              className="text-sm font-medium text-brand-500 hover:text-brand-600 underline underline-offset-2"
              onClick={() => navigate('/form')}
            >
              Go back and fill out the form
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-warm-100">
            {session.answers.map(answer => (
              <li key={answer.fieldId} className="px-5 py-3.5 flex items-start gap-3">
                <CheckCircle size={16} className="text-forest-500 shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-warm-300">
                    {answer.fieldLabel}
                  </p>
                  <p className="text-base text-warm-900 mt-0.5">{answer.userAnswer}</p>
                </div>
                <button
                  onClick={() => navigate('/form')}
                  className="shrink-0 flex items-center gap-1 text-xs text-warm-300 hover:text-brand-500 transition-colors"
                >
                  <Edit2 size={12} /> Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Flagged sections */}
      {flaggedSections.length > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-amber-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">
              Sections that need legal advice
            </p>
          </div>
          <ul className="divide-y divide-amber-100">
            {flaggedSections.map(s => (
              <li key={s.sectionId} className="px-5 py-3.5">
                <p className="text-sm font-semibold text-amber-800">{s.riskReason}</p>
                <p className="text-xs text-amber-600 mt-0.5 leading-relaxed line-clamp-2">
                  {s.plainExplanation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )

  const legalPanel = (
    <div id="legal-aid">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-warm-200" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-warm-300 px-2">
          Free legal help
        </p>
        <div className="h-px flex-1 bg-warm-200" />
      </div>
      <h3 className="font-serif font-semibold text-warm-900 mb-3">Organizations near you</h3>

      {legalAidOrgs.length > 0 ? (
        <div className="flex flex-col gap-3">
          {legalAidOrgs.map(org => (
            <LegalAidCard key={org.name} org={org} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-warm-200 bg-white p-4 shadow-warm-sm">
          <p className="text-sm text-warm-600 mb-2">Search for free immigration legal aid:</p>
          <a
            href="https://www.immigrationadvocates.org/nonprofit/legaldirectory/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors"
          >
            <Globe size={15} /> Immigration Advocates Network
          </a>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-warm-200 shadow-warm-sm px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/form')}
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-warm-100 transition-colors"
          >
            <ChevronLeft size={20} className="text-warm-600" />
          </button>
          <span className="font-serif font-semibold text-warm-900">Review and Download</span>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full animate-fade-up">

        {/* Desktop: two-column; Mobile: single column */}
        <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:gap-8 lg:items-start flex flex-col gap-5">

          {/* Left / main column */}
          <div className="flex flex-col gap-5">

            {/* Celebration header */}
            <div className="rounded-3xl bg-forest-500 text-white px-6 py-7 overflow-hidden relative">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
              <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/5" />
              <div className="relative flex items-center gap-5 sm:gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                  <span className="text-3xl leading-none">&#127881;</span>
                </div>
                <div>
                  <h2 className="font-serif text-2xl font-bold mb-1">Almost there!</h2>
                  <p className="text-sm text-white/70 leading-relaxed">
                    Review your answers, then download your completed draft to submit yourself.
                  </p>
                </div>
              </div>
            </div>

            {/* High-risk warning */}
            {flaggedSections.length > 0 && (
              <div className="rounded-2xl border-l-4 border-red-400 bg-red-50 px-4 py-4 flex gap-3">
                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">
                    {flaggedSections.length} section{flaggedSections.length !== 1 ? 's' : ''} need legal review
                  </p>
                  <p className="text-xs text-red-600 mt-1 leading-relaxed">
                    Talk to a legal advisor about the highlighted sections before submitting.
                  </p>
                </div>
              </div>
            )}

            {answersPanel}

            {/* Generate / Download */}
            {draftResult ? (
              <a
                href={draftResult.downloadUrl}
                download="refugeaid-draft.pdf"
                className="flex items-center justify-center gap-2.5 w-full rounded-2xl bg-forest-500 py-4 text-base font-semibold text-white hover:bg-forest-600 active:scale-[0.98] transition-all shadow-warm"
              >
                <Download size={19} /> Download my draft PDF
              </a>
            ) : (
              <button
                onClick={handleGenerateDraft}
                disabled={isGenerating || session.answers.length === 0}
                className="w-full rounded-2xl bg-brand-500 py-4 text-base font-semibold text-white hover:bg-brand-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-warm flex items-center justify-center gap-2.5"
              >
                {isGenerating ? (
                  <><Spinner size={18} className="text-white" /> Creating your draft...</>
                ) : (
                  <><Download size={19} /> Generate and download draft PDF</>
                )}
              </button>
            )}

            <p className="text-xs text-center text-warm-300 -mt-2 leading-relaxed">
              This is a draft only. You submit it yourself. RefugeAid does not file on your behalf.
            </p>

            {/* Legal aid — mobile only */}
            <div className="lg:hidden">
              {legalPanel}
            </div>

            {/* Start over */}
            <button
              onClick={() => { dispatch({ type: 'RESET' }); navigate('/') }}
              className="flex items-center justify-center gap-1.5 text-sm text-warm-300 hover:text-warm-600 transition-colors py-2 mx-auto"
            >
              <RotateCcw size={13} /> Start over with a new document
            </button>
          </div>

          {/* Right column — desktop only, sticky legal aid */}
          <div className="hidden lg:block lg:sticky lg:top-24">
            {legalPanel}
          </div>
        </div>
      </main>
    </div>
  )
}
