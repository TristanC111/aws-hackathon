import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Lock, Search, ChevronDown, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSession } from '../context/SessionContext'
import { uploadDocument, analyzeDocument } from '../api/client'
import { PRIORITY_LANGUAGES, ALL_LANGUAGES } from '../data/languages'
import Spinner from '../components/Spinner'

export default function UploadScreen() {
  const navigate = useNavigate()
  const { dispatch } = useSession()

  const [selectedFile, setSelectedFile] = useState(null)
  const [language, setLanguage] = useState(PRIORITY_LANGUAGES[0])
  const [langSearch, setLangSearch] = useState('')
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [fillMode, setFillMode] = useState('guided')

  const filteredLanguages = langSearch
    ? ALL_LANGUAGES.filter(
        l =>
          l.english.toLowerCase().includes(langSearch.toLowerCase()) ||
          l.name.toLowerCase().includes(langSearch.toLowerCase())
      )
    : PRIORITY_LANGUAGES

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error('Please upload a PDF file under 5MB.')
      return
    }
    if (accepted.length > 0) {
      setSelectedFile(accepted[0])
      const url = URL.createObjectURL(accepted[0])
      dispatch({ type: 'SET_PDF_URL', payload: url })
    }
  }, [dispatch])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  })

  async function handleSubmit() {
    if (!selectedFile) {
      toast.error('Please select a PDF document first.')
      return
    }
    setIsLoading(true)
    dispatch({ type: 'SET_LANGUAGE', payload: { code: language.code, name: language.english } })
    dispatch({ type: 'SET_FILL_MODE', payload: fillMode })
    try {
      setLoadingStep('Uploading...')
      dispatch({ type: 'UPLOAD_START' })
      const uploadRes = await uploadDocument(selectedFile, language.code)
      dispatch({ type: 'UPLOAD_SUCCESS', payload: { sessionId: uploadRes.sessionId } })
      setLoadingStep('Reading your document...')
      const analyzeRes = await analyzeDocument(uploadRes.sessionId, language.code)
      dispatch({ type: 'ANALYZE_SUCCESS', payload: analyzeRes })
      navigate(fillMode === 'direct' ? '/direct' : '/explain')
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  const features = [
    { icon: '📄', title: 'Reads the document for you', desc: 'Each section explained like a person talking to you, not a government form.' },
    { icon: '🌍', title: 'Works in your language', desc: 'Arabic, Somali, Ukrainian, Spanish, and 70+ more.' },
    { icon: '🤝', title: 'Helps you fill it out', desc: 'Suggests answers one field at a time. You approve each one before it is saved.' },
  ]

  return (
    <div className="min-h-screen bg-mesh flex flex-col">

      {/* Header — full width on all screen sizes */}
      <header className="w-full px-6 pt-6 pb-4 animate-fade-in">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-500 shadow-warm-sm shrink-0">
            <span className="font-serif font-bold text-white text-sm">R</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="font-serif font-bold text-lg text-warm-900">Refuge</span>
            <span className="font-serif font-bold text-lg text-brand-500">Aid</span>
          </div>
        </div>
      </header>

      {/* Main — stacked on mobile, two-column on desktop */}
      <main className="flex-1 px-5 sm:px-8 lg:px-10 pb-12">
        <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-[1fr_1fr] lg:gap-20 lg:items-start">

          {/* ── LEFT: Hero + features (sticky on desktop) ── */}
          <div className="lg:sticky lg:top-10 lg:pt-8">
            <div className="mt-6 lg:mt-0 animate-fade-up">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px w-8 bg-brand-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-brand-500">
                  Document assistant
                </span>
              </div>
              <h1 className="font-serif text-[34px] sm:text-[40px] lg:text-[46px] font-bold text-warm-900 leading-tight">
                Your documents,<br />in your language.
              </h1>
              <p className="mt-4 text-warm-600 text-base lg:text-lg leading-relaxed max-w-md">
                Upload any immigration form. We will read every section and explain what it actually says, in your language. Then walk you through filling it out.
              </p>
            </div>

            {/* Feature list — shown below form on mobile, in left col on desktop */}
            <div className="hidden lg:flex flex-col gap-3 mt-10 animate-fade-up delay-200">
              {features.map(item => (
                <div
                  key={item.title}
                  className="flex items-start gap-4 rounded-2xl bg-white/70 border border-warm-200 px-4 py-4 shadow-warm-sm"
                >
                  <span className="text-xl mt-0.5 leading-none shrink-0">{item.icon}</span>
                  <div>
                    <p className="font-semibold text-warm-900 text-sm">{item.title}</p>
                    <p className="text-xs text-warm-600 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Trust badge — desktop only, under features */}
            <div className="hidden lg:flex items-center gap-2 mt-6 animate-fade-up delay-300">
              <Lock size={13} className="text-warm-300 shrink-0" />
              <p className="text-sm text-warm-600">No account needed. Nothing is stored once you leave.</p>
            </div>
          </div>

          {/* ── RIGHT: Form ── */}
          <div className="mt-8 lg:mt-0 lg:pt-8 flex flex-col gap-4 animate-fade-up delay-100">

            {/* Language selector */}
            <div className="relative">
              <label className="block text-xs font-semibold uppercase tracking-wide text-warm-600 mb-2">
                Your language
              </label>
              <button
                type="button"
                onClick={() => setShowLangDropdown(v => !v)}
                className="flex w-full items-center justify-between rounded-2xl border border-warm-200 bg-white px-4 py-3.5 text-left shadow-warm-sm hover:border-brand-300 hover:shadow-warm transition-all"
              >
                <span className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{language.flag}</span>
                  <span>
                    <span className="font-semibold text-warm-900">{language.name}</span>
                    <span className="text-warm-300 mx-1.5">·</span>
                    <span className="text-warm-600 text-sm">{language.english}</span>
                  </span>
                </span>
                <ChevronDown
                  size={17}
                  className={"text-warm-300 transition-transform duration-200 " + (showLangDropdown ? 'rotate-180' : '')}
                />
              </button>

              {showLangDropdown && (
                <div className="absolute z-50 mt-1.5 w-full rounded-2xl border border-warm-200 bg-white shadow-warm-lg overflow-hidden animate-fade-in">
                  <div className="p-2.5 border-b border-warm-100">
                    <div className="flex items-center gap-2 rounded-xl bg-warm-50 border border-warm-200 px-3 py-2">
                      <Search size={14} className="text-warm-300 shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search language..."
                        value={langSearch}
                        onChange={e => setLangSearch(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none text-warm-900 placeholder-warm-300"
                      />
                    </div>
                  </div>
                  <ul className="max-h-56 overflow-y-auto">
                    {filteredLanguages.map(l => (
                      <li key={l.code}>
                        <button
                          type="button"
                          onClick={() => { setLanguage(l); setShowLangDropdown(false); setLangSearch('') }}
                          className="flex w-full items-center gap-3 px-4 py-3 hover:bg-brand-50 text-left transition-colors"
                        >
                          <span className="text-xl leading-none">{l.flag}</span>
                          <span className="font-medium text-warm-900">{l.name}</span>
                          <span className="text-warm-300 text-sm ml-auto">{l.english}</span>
                        </button>
                      </li>
                    ))}
                    {filteredLanguages.length === 0 && (
                      <li className="px-4 py-4 text-sm text-warm-300 text-center">No language found</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Mode toggle */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-warm-600 mb-2">
                How would you like to fill it out?
              </label>
              <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-warm-100 p-1.5">
                <button
                  type="button"
                  onClick={() => setFillMode('guided')}
                  className={
                    "flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-left transition-all " +
                    (fillMode === 'guided'
                      ? 'bg-white shadow-warm-sm text-warm-900'
                      : 'text-warm-400 hover:text-warm-600')
                  }
                >
                  <span className="text-lg leading-none">🧭</span>
                  <span className="text-xs font-semibold">Guided</span>
                  <span className="text-[10px] text-warm-400 leading-tight text-center">Step by step Q&amp;A</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFillMode('direct')}
                  className={
                    "flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-left transition-all " +
                    (fillMode === 'direct'
                      ? 'bg-white shadow-warm-sm text-warm-900'
                      : 'text-warm-400 hover:text-warm-600')
                  }
                >
                  <span className="text-lg leading-none">📋</span>
                  <span className="text-xs font-semibold">Direct</span>
                  <span className="text-[10px] text-warm-400 leading-tight text-center">Fill the form directly</span>
                </button>
              </div>
            </div>

            {/* Drop zone */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-warm-600 mb-2">
                Your document
              </label>
              <div
                {...getRootProps()}
                className={"relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 sm:p-12 text-center cursor-pointer transition-all duration-200 " +
                  (isDragActive
                    ? 'border-brand-400 bg-brand-50 scale-[1.01]'
                    : selectedFile
                    ? 'border-forest-500 bg-forest-50'
                    : 'border-warm-200 bg-white hover:border-brand-300 hover:bg-brand-50 hover:shadow-warm-sm')}
              >
                <input {...getInputProps()} />
                {selectedFile ? (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 border border-forest-100 mb-4">
                      <FileText size={26} className="text-forest-500" />
                    </div>
                    <p className="font-semibold text-warm-900 text-base">{selectedFile.name}</p>
                    <p className="text-sm text-warm-300 mt-1">{(selectedFile.size / 1024).toFixed(0)} KB · tap to change</p>
                  </>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warm-100 mb-4">
                      <Upload size={26} className="text-warm-300" />
                    </div>
                    <p className="font-semibold text-warm-900 text-base">
                      {isDragActive ? 'Drop it here' : 'Upload your document'}
                    </p>
                    <p className="text-sm text-warm-300 mt-1.5">Drag and drop or tap to choose · PDF only · Max 5 MB</p>
                  </>
                )}
              </div>
            </div>

            {/* Trust — mobile only (desktop version is in left column) */}
            <div className="flex items-center gap-2 lg:hidden">
              <Lock size={13} className="text-warm-300 shrink-0" />
              <p className="text-sm text-warm-600">No account needed. Nothing is stored once you leave.</p>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isLoading || !selectedFile}
              className="w-full rounded-2xl bg-brand-500 py-4 text-base font-semibold text-white shadow-warm hover:bg-brand-600 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-2.5"
            >
              {isLoading ? (
                <><Spinner size={19} className="text-white" /><span>{loadingStep}</span></>
              ) : (
                <>Explain this document <ArrowRight size={18} /></>
              )}
            </button>

            {/* Feature list — mobile only */}
            <div className="lg:hidden flex flex-col gap-2 mt-4">
              {features.map(item => (
                <div
                  key={item.title}
                  className="flex items-start gap-3.5 rounded-2xl bg-white border border-warm-200 px-4 py-3.5 shadow-warm-sm"
                >
                  <span className="text-xl mt-0.5 leading-none shrink-0">{item.icon}</span>
                  <div>
                    <p className="font-semibold text-warm-900 text-sm">{item.title}</p>
                    <p className="text-xs text-warm-600 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-5 py-5 border-t border-warm-200 text-center">
        <p className="text-xs text-warm-300 leading-relaxed">
          RefugeAid explains documents. It is not a lawyer and does not give legal advice.
          For serious legal questions, talk to a legal professional.
        </p>
      </footer>
    </div>
  )
}
