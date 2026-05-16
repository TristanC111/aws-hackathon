import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Mic, MicOff, CheckCircle, SkipForward, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSession } from '../context/SessionContext'
import { getFieldSuggestion, saveSession } from '../api/client'
import useVoiceInput from '../hooks/useVoiceInput'
import ProgressBar from '../components/ProgressBar'
import Spinner from '../components/Spinner'

export default function FormFillScreen() {
  const navigate = useNavigate()
  const { session, dispatch } = useSession()

  const [fields, setFields] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false)
  const [started, setStarted] = useState(false)

  const { isListening, isSupported, transcript, start, stop } = useVoiceInput({
    onResult: (text) => setUserInput(text),
  })

  useEffect(() => {
    if (!session.sessionId) {
      navigate('/')
      return
    }
    if (session.fields && session.fields.length > 0) {
      setFields(session.fields)
    } else {
      import('../api/client').then(({ MOCK_FORM_FIELDS }) => {
        setFields(MOCK_FORM_FIELDS || [])
      })
    }
  }, [session.sessionId])

  useEffect(() => {
    if (fields.length > 0 && started) {
      fetchSuggestion()
    }
  }, [currentIndex, fields, started])

  async function fetchSuggestion() {
    if (!fields[currentIndex]) return
    setIsFetchingSuggestion(true)
    setSuggestion(null)
    try {
      const field = fields[currentIndex]
      const result = await getFieldSuggestion({
        sessionId: session.sessionId,
        language: session.language,
        fieldId: field.fieldId,
        fieldLabel: field.fieldLabel,
        fieldDescription: field.fieldDescription,
        conversationHistory: session.answers,
      })
      setSuggestion(result)
    } catch {
      // suggestion failed silently, user can type manually
    } finally {
      setIsFetchingSuggestion(false)
    }
  }

  async function confirmAnswer(value) {
    if (!value.trim()) {
      toast.error('Please enter an answer before confirming.')
      return
    }
    const field = fields[currentIndex]
    const answer = {
      fieldId: field.fieldId,
      fieldLabel: field.fieldLabel,
      userAnswer: value.trim(),
      confirmed: true,
    }
    dispatch({ type: 'SAVE_ANSWER', payload: answer })

    try {
      await saveSession(session.sessionId, [...session.answers, answer])
    } catch {
      // non-blocking
    }

    if (currentIndex < fields.length - 1) {
      setCurrentIndex(i => i + 1)
      setUserInput('')
      setSuggestion(null)
    } else {
      navigate('/review')
    }
  }

  function skipField() {
    if (currentIndex < fields.length - 1) {
      setCurrentIndex(i => i + 1)
      setUserInput('')
      setSuggestion(null)
    } else {
      navigate('/review')
    }
  }

  if (!session.sessionId) return null

  const progress = fields.length > 0 ? Math.round((currentIndex / fields.length) * 100) : 0
  const field = fields[currentIndex]

  // Intro screen
  if (!started) {
    return (
      <div className="min-h-screen bg-warm-50 flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-warm-200 shadow-warm-sm px-4 sm:px-6 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button
              onClick={() => navigate('/explain')}
              className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-warm-100 transition-colors"
            >
              <ChevronLeft size={20} className="text-warm-600" />
            </button>
            <span className="font-serif font-semibold text-warm-900">Fill out the form</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
          <div className="w-full max-w-md text-center animate-fade-up">
            <div className="w-20 h-20 rounded-3xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl leading-none">&#9999;&#65039;</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-warm-900 mb-3">
              Time to fill this out.
            </h2>
            <p className="text-warm-600 leading-relaxed mb-2">
              I will ask you one question at a time and suggest an answer based on what you have already told me.
            </p>
            <p className="text-warm-600 leading-relaxed mb-8">
              Nothing gets saved until you confirm it. You are always in control.
            </p>
            <div className="flex flex-col gap-3 text-sm text-warm-600 bg-white border border-warm-200 rounded-2xl px-5 py-4 mb-8 text-left shadow-warm-sm">
              <div className="flex items-start gap-3">
                <span className="text-brand-500 font-bold mt-0.5">1.</span>
                <p>I suggest an answer. You can accept it or type your own.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-brand-500 font-bold mt-0.5">2.</span>
                <p>You confirm before anything is recorded.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-brand-500 font-bold mt-0.5">3.</span>
                <p>You can skip any question you want to come back to later.</p>
              </div>
            </div>
            <button
              onClick={() => { setStarted(true); fetchSuggestion() }}
              className="w-full rounded-2xl bg-brand-500 py-4 text-base font-semibold text-white hover:bg-brand-600 active:scale-[0.98] transition-all shadow-warm flex items-center justify-center gap-2"
            >
              Let's go <ArrowRight size={18} />
            </button>
          </div>
        </main>
      </div>
    )
  }

  // Q&A screen
  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">

      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-white border-b border-warm-200 shadow-warm-sm px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/explain')}
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-warm-100 transition-colors shrink-0"
          >
            <ChevronLeft size={20} className="text-warm-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-warm-300 mb-1 font-medium">
              Question {currentIndex + 1} of {fields.length}
            </p>
            <ProgressBar percent={progress} />
          </div>
          <span className="text-xs font-semibold text-warm-600 shrink-0 bg-warm-100 rounded-lg px-2.5 py-1">
            {progress}%
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-6 max-w-2xl mx-auto w-full flex flex-col gap-5 animate-fade-in">

        {field && (
          <>
            {/* Question card */}
            <div className="rounded-3xl bg-white border border-warm-200 shadow-warm-sm overflow-hidden">
              <div className="px-5 pt-5 pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-2">
                  {field.fieldLabel}
                </p>
                <p className="text-lg sm:text-xl font-serif font-semibold text-warm-900 leading-snug">
                  {field.plainLabel || field.fieldLabel}
                </p>
                {field.fieldDescription && (
                  <p className="text-sm text-warm-600 mt-2 leading-relaxed">
                    {field.fieldDescription}
                  </p>
                )}
              </div>
            </div>

            {/* AI suggestion */}
            {isFetchingSuggestion && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-brand-50 border border-brand-100">
                <Spinner size={16} className="text-brand-400" />
                <p className="text-sm text-brand-600">Thinking of a suggestion...</p>
              </div>
            )}

            {suggestion && !isFetchingSuggestion && (
              <div className="rounded-2xl bg-brand-50 border border-brand-200 px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-400 mb-2">
                  My suggestion
                </p>
                <p className="text-sm text-warm-800 leading-relaxed mb-3">{suggestion.reasoning}</p>
                <button
                  onClick={() => {
                    setUserInput(suggestion.suggestedValue)
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-600 active:scale-[0.97] transition-all shadow-warm-sm"
                >
                  Use this: <span className="font-bold">{suggestion.suggestedValue}</span>
                </button>
              </div>
            )}

            {/* Input area */}
            <div className="rounded-3xl bg-white border border-warm-200 shadow-warm-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-warm-100 bg-warm-50 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-warm-600">
                  Your answer
                </span>
                {isSupported && (
                  <button
                    onMouseDown={start}
                    onMouseUp={stop}
                    onTouchStart={start}
                    onTouchEnd={stop}
                    className={
                      "relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all " +
                      (isListening
                        ? "bg-brand-500 text-white"
                        : "bg-warm-100 text-warm-600 hover:bg-warm-200")
                    }
                  >
                    {isListening && (
                      <span className="absolute inset-0 rounded-xl bg-brand-400 animate-ping opacity-30" />
                    )}
                    {isListening ? <Mic size={13} /> : <MicOff size={13} />}
                    {isListening ? 'Listening...' : 'Hold to speak'}
                  </button>
                )}
              </div>
              <div className="p-5">
                <textarea
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={3}
                  className="w-full resize-none bg-transparent text-warm-900 placeholder-warm-300 text-base outline-none leading-relaxed"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={skipField}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-warm-200 text-sm font-medium text-warm-600 hover:bg-warm-100 transition-colors"
              >
                <SkipForward size={15} /> Skip
              </button>
              <button
                onClick={() => confirmAnswer(userInput)}
                disabled={!userInput.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-forest-500 py-3 text-base font-semibold text-white hover:bg-forest-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-warm"
              >
                <CheckCircle size={18} /> Confirm
              </button>
            </div>

            {/* Completed answers */}
            {session.answers.length > 0 && (
              <div className="rounded-2xl border border-warm-100 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-warm-100 bg-warm-50">
                  <p className="text-xs font-semibold uppercase tracking-widest text-warm-400">
                    Saved so far ({session.answers.length})
                  </p>
                </div>
                <ul className="divide-y divide-warm-100">
                  {session.answers.map(a => (
                    <li key={a.fieldId} className="px-4 py-3 flex items-start gap-3">
                      <CheckCircle size={14} className="text-forest-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-warm-300">
                          {a.fieldLabel}
                        </p>
                        <p className="text-sm text-warm-900 mt-0.5 truncate">{a.userAnswer}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>

      {/* Done button if all fields answered */}
      {session.answers.length === fields.length && fields.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-warm-200 shadow-warm-sm px-4 sm:px-6 py-3">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => navigate('/review')}
              className="w-full rounded-2xl bg-brand-500 py-4 text-base font-semibold text-white hover:bg-brand-600 active:scale-[0.98] transition-all shadow-warm flex items-center justify-center gap-2"
            >
              Review my answers <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
