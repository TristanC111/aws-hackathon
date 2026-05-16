import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ArrowRight, AlertTriangle, CheckCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSession } from '../context/SessionContext'
import { saveSession } from '../api/client'
import { MOCK_FORM_FIELDS } from '../api/client'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

const RISK_COLORS = {
  high:   { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.5)',   dot: 'bg-red-400',   badge: 'bg-red-100 text-red-700 border-red-200' },
  medium: { bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.45)', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  low:    { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.40)',  dot: 'bg-green-400', badge: 'bg-green-100 text-green-700 border-green-200' },
}

export default function DirectFillScreen() {
  const navigate = useNavigate()
  const { session, dispatch } = useSession()

  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageWidth, setPageWidth] = useState(0)
  const [pageHeight, setPageHeight] = useState(0)
  const [hoveredSection, setHoveredSection] = useState(null)
  const [activeSection, setActiveSection] = useState(null) // clicked/pinned on mobile
  const [fieldValues, setFieldValues] = useState({})
  const [savedFields, setSavedFields] = useState(new Set(session.answers.map(a => a.fieldId)))
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const containerRef = useRef(null)
  const pageRef = useRef(null)

  // Responsive: measure container width and update on resize
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setPageWidth(entry.contentRect.width)
      }
    })
    ro.observe(containerRef.current)
    setPageWidth(containerRef.current.offsetWidth)
    return () => ro.disconnect()
  }, [])

  if (!session.sections || session.sections.length === 0) {
    navigate('/')
    return null
  }

  const { sections, documentTitle, pdfUrl, highRiskCount } = session
  const fields = MOCK_FORM_FIELDS

  // Sections visible on current page
  const pageSections = sections.filter(s => s.geometry?.page === pageNumber)
  const pageFields   = fields.filter(f => f.geometry?.page === pageNumber)

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages)
  }

  function onPageRenderSuccess(page) {
    setPageHeight(page.height)
  }

  function handleSectionHover(section, e) {
    setHoveredSection(section)
    if (e && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }

  function handleSectionClick(section) {
    setActiveSection(prev => prev?.sectionId === section.sectionId ? null : section)
  }

  function handleFieldChange(fieldId, value) {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }))
  }

  function saveField(field) {
    const value = fieldValues[field.fieldId] ?? (session.answers.find(a => a.fieldId === field.fieldId)?.userAnswer || '')
    if (!value.trim()) { toast.error('Please enter an answer first.'); return }
    dispatch({ type: 'SAVE_ANSWER', payload: { fieldId: field.fieldId, fieldLabel: field.fieldLabel, userAnswer: value.trim(), confirmed: true } })
    setSavedFields(prev => new Set([...prev, field.fieldId]))
    toast.success('Saved.')
  }

  const displayedSection = hoveredSection || activeSection
  const savedCount = savedFields.size
  const totalFields = fields.length
  const progress = totalFields > 0 ? Math.round((savedCount / totalFields) * 100) : 0

  return (
    <div className="min-h-screen bg-warm-100 flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-warm-200 shadow-warm-sm px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-warm-100 transition-colors shrink-0">
            <ChevronLeft size={20} className="text-warm-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-warm-400 font-medium truncate">{documentTitle}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex-1 h-1.5 rounded-full bg-warm-200 overflow-hidden max-w-48">
                <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[10px] font-semibold text-warm-400">{savedCount}/{totalFields} filled</span>
            </div>
          </div>
          {/* Page nav */}
          {numPages && numPages > 1 && (
            <div className="flex items-center gap-1.5 bg-warm-100 rounded-xl px-2 py-1.5">
              <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-warm-200 disabled:opacity-30 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-semibold text-warm-600 min-w-[52px] text-center">
                {pageNumber} / {numPages}
              </span>
              <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-warm-200 disabled:opacity-30 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          {savedCount > 0 && (
            <button onClick={() => navigate('/review')}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl px-3 py-2 transition-colors shadow-warm-sm shrink-0">
              Review <ArrowRight size={13} />
            </button>
          )}
        </div>
      </header>

      {/* Risk alert */}
      {highRiskCount > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 sm:px-6 py-2 flex items-center gap-2">
          <AlertTriangle size={13} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700">
            <span className="font-semibold">{highRiskCount} section{highRiskCount !== 1 ? 's' : ''}</span> flagged — hover the red areas for details.
          </p>
        </div>
      )}

      {/* Hint bar */}
      <div className="bg-brand-50 border-b border-brand-100 px-4 sm:px-6 py-2 flex items-center gap-2">
        <span className="text-xs text-brand-600">
          <span className="font-semibold">Hover</span> over a coloured section to see a plain-language explanation.
          <span className="hidden sm:inline"> Click to pin it. Fill in the fields directly on the document.</span>
        </span>
      </div>

      {/* Main */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-8 lg:items-start">

          {/* ── PDF viewer column ── */}
          <div>
            <div
              ref={containerRef}
              className="relative rounded-2xl overflow-hidden shadow-warm bg-white select-none"
              style={{ minHeight: 400 }}
              onMouseLeave={() => setHoveredSection(null)}
            >
              {pdfUrl ? (
                <>
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                      <div className="flex items-center justify-center h-96 text-warm-400 text-sm">
                        Loading document...
                      </div>
                    }
                    error={
                      <div className="flex items-center justify-center h-96 text-warm-400 text-sm">
                        Could not load PDF. Please go back and re-upload.
                      </div>
                    }
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth || undefined}
                      onRenderSuccess={onPageRenderSuccess}
                      renderTextLayer={true}
                      renderAnnotationLayer={false}
                    />
                  </Document>

                  {/* Section highlight overlays */}
                  {pageWidth > 0 && pageHeight > 0 && pageSections.map(section => {
                    const bb = section.geometry?.boundingBox
                    if (!bb) return null
                    const color = RISK_COLORS[section.riskLevel] || RISK_COLORS.low
                    const isHovered = hoveredSection?.sectionId === section.sectionId
                    const isActive  = activeSection?.sectionId === section.sectionId

                    return (
                      <div
                        key={section.sectionId}
                        onMouseEnter={e => handleSectionHover(section, e)}
                        onMouseMove={e => handleSectionHover(section, e)}
                        onMouseLeave={() => setHoveredSection(null)}
                        onClick={() => handleSectionClick(section)}
                        style={{
                          position: 'absolute',
                          left:   `${bb.Left * 100}%`,
                          top:    `${bb.Top * 100}%`,
                          width:  `${bb.Width * 100}%`,
                          height: `${bb.Height * 100}%`,
                          backgroundColor: isHovered || isActive ? color.bg : 'transparent',
                          border: `2px solid ${isHovered || isActive ? color.border : 'transparent'}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'background-color 0.15s, border-color 0.15s',
                          zIndex: 10,
                        }}
                      >
                        {/* Risk badge in corner */}
                        {section.riskLevel !== 'low' && (
                          <span style={{
                            position: 'absolute', top: 4, right: 6,
                            fontSize: 9, fontWeight: 700, padding: '1px 5px',
                            borderRadius: 99, letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            background: section.riskLevel === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color: section.riskLevel === 'high' ? '#b91c1c' : '#92400e',
                            border: `1px solid ${section.riskLevel === 'high' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                          }}>
                            {section.riskLevel === 'high' ? '⚠ legal review' : 'note'}
                          </span>
                        )}
                      </div>
                    )
                  })}

                  {/* Form field overlays */}
                  {pageWidth > 0 && pageHeight > 0 && pageFields.map(field => {
                    const bb = field.geometry?.boundingBox
                    if (!bb) return null
                    const isSaved = savedFields.has(field.fieldId)
                    const val = fieldValues[field.fieldId] ??
                      (session.answers.find(a => a.fieldId === field.fieldId)?.userAnswer || '')

                    return (
                      <div
                        key={field.fieldId}
                        style={{
                          position: 'absolute',
                          left:   `${bb.Left * 100}%`,
                          top:    `${bb.Top * 100}%`,
                          width:  `${bb.Width * 100}%`,
                          height: `${bb.Height * 100}%`,
                          zIndex: 20,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <input
                          type="text"
                          value={val}
                          onChange={e => handleFieldChange(field.fieldId, e.target.value)}
                          placeholder={field.fieldLabel}
                          title={field.fieldDescription}
                          style={{
                            flex: 1,
                            height: '100%',
                            background: isSaved ? 'rgba(209,250,229,0.85)' : 'rgba(255,255,255,0.90)',
                            border: `1.5px solid ${isSaved ? '#6ee7b7' : '#C05733'}`,
                            borderRadius: 4,
                            padding: '0 6px',
                            fontSize: Math.max(10, pageWidth * 0.013),
                            color: '#1C1410',
                            outline: 'none',
                            backdropFilter: 'blur(2px)',
                          }}
                          onFocus={e => { e.target.style.boxShadow = '0 0 0 2px rgba(192,87,51,0.25)' }}
                          onBlur={e => { e.target.style.boxShadow = 'none' }}
                        />
                        <button
                          onClick={() => saveField(field)}
                          style={{
                            height: '100%',
                            padding: '0 6px',
                            borderRadius: 4,
                            background: isSaved ? '#6ee7b7' : '#C05733',
                            color: '#fff',
                            border: 'none',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isSaved ? '✓' : 'Save'}
                        </button>
                      </div>
                    )
                  })}

                  {/* Floating tooltip (desktop hover) */}
                  {hoveredSection && (
                    <div
                      className="hidden lg:block pointer-events-none animate-fade-in"
                      style={{
                        position: 'absolute',
                        left: Math.min(tooltipPos.x + 14, pageWidth - 260),
                        top: tooltipPos.y + 14,
                        zIndex: 50,
                        width: 240,
                      }}
                    >
                      <div className="rounded-2xl bg-white border border-warm-200 shadow-warm-lg px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={"h-2 w-2 rounded-full shrink-0 " + (RISK_COLORS[hoveredSection.riskLevel]?.dot || 'bg-green-400')} />
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-warm-500">
                            Plain language
                          </span>
                        </div>
                        <p className="text-xs text-warm-900 leading-relaxed mb-2">
                          {hoveredSection.plainExplanation}
                        </p>
                        {hoveredSection.riskLevel !== 'low' && (
                          <div className={
                            "text-[10px] font-semibold px-2 py-1 rounded-lg border " +
                            RISK_COLORS[hoveredSection.riskLevel]?.badge
                          }>
                            {hoveredSection.riskLevel === 'high' ? '⚠ ' : ''}
                            {hoveredSection.riskReason}
                          </div>
                        )}
                        <p className="text-[10px] text-warm-300 mt-2">Click to pin this explanation →</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-96 gap-3 text-warm-400">
                  <p className="text-sm">No PDF loaded. Please go back and upload a document.</p>
                  <button onClick={() => navigate('/')} className="text-sm font-semibold text-brand-500 underline underline-offset-2">
                    Go back
                  </button>
                </div>
              )}
            </div>

            {/* Mobile: section tap → explanation inline */}
            {activeSection && (
              <div className="lg:hidden mt-4 rounded-2xl border border-warm-200 bg-white shadow-warm-sm p-4 animate-fade-up">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={"h-2 w-2 rounded-full shrink-0 " + (RISK_COLORS[activeSection.riskLevel]?.dot || 'bg-green-400')} />
                    <span className="text-xs font-semibold uppercase tracking-widest text-warm-500">Plain language</span>
                  </div>
                  <button onClick={() => setActiveSection(null)} className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-warm-100">
                    <X size={13} className="text-warm-400" />
                  </button>
                </div>
                <p className="text-sm text-warm-900 leading-relaxed mb-3">{activeSection.plainExplanation}</p>
                {activeSection.whyItMatters && (
                  <div className="rounded-xl bg-brand-50 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-400 mb-1">Why it matters</p>
                    <p className="text-xs text-warm-800 leading-relaxed">{activeSection.whyItMatters}</p>
                  </div>
                )}
              </div>
            )}

            {/* Page nav (mobile, below PDF) */}
            {numPages && numPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4 lg:hidden">
                <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}
                  className="flex items-center gap-1 text-sm font-medium text-warm-600 disabled:opacity-30 hover:text-warm-900 transition-colors">
                  <ChevronLeft size={16} /> Previous page
                </button>
                <span className="text-sm text-warm-400">{pageNumber} / {numPages}</span>
                <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}
                  className="flex items-center gap-1 text-sm font-medium text-warm-600 disabled:opacity-30 hover:text-warm-900 transition-colors">
                  Next page <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* ── Sidebar (desktop only) ── */}
          <div className="hidden lg:flex flex-col gap-4 sticky top-24">

            {/* Pinned/hovered explanation */}
            <div className="rounded-3xl border border-warm-200 bg-white shadow-warm overflow-hidden">
              <div className="px-5 py-4 border-b border-warm-100 bg-warm-50 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-warm-500">
                  {displayedSection ? 'Explanation' : 'Hover a section'}
                </span>
                {displayedSection && activeSection && (
                  <button onClick={() => setActiveSection(null)} className="ml-auto h-5 w-5 flex items-center justify-center rounded-md hover:bg-warm-200 transition-colors">
                    <X size={11} className="text-warm-400" />
                  </button>
                )}
              </div>
              <div className="p-5">
                {displayedSection ? (
                  <div className="flex flex-col gap-3 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className={"h-2 w-2 rounded-full shrink-0 " + (RISK_COLORS[displayedSection.riskLevel]?.dot || 'bg-green-400')} />
                      <span className={
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full border " +
                        (RISK_COLORS[displayedSection.riskLevel]?.badge || '')
                      }>
                        {displayedSection.riskLevel} risk
                      </span>
                    </div>
                    <p className="text-sm text-warm-900 leading-relaxed">
                      {displayedSection.plainExplanation}
                    </p>
                    {displayedSection.whyItMatters && (
                      <div className="rounded-2xl bg-brand-50 border border-brand-100 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-400 mb-1.5">Why it matters</p>
                        <p className="text-xs text-warm-800 leading-relaxed">{displayedSection.whyItMatters}</p>
                      </div>
                    )}
                    {displayedSection.riskLevel === 'high' && (
                      <a href="#legal-aid" className="text-xs font-semibold text-brand-500 hover:text-brand-600 underline underline-offset-2">
                        Find free legal help →
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-warm-300 leading-relaxed">
                    Move your cursor over any highlighted area of the document to see what it means in plain language.
                  </p>
                )}
              </div>
            </div>

            {/* Section index */}
            <div className="rounded-2xl border border-warm-200 bg-white shadow-warm-sm p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-warm-400 mb-2 px-1">Sections</p>
              <div className="flex flex-col gap-0.5">
                {sections.map((s, i) => {
                  const color = RISK_COLORS[s.riskLevel] || RISK_COLORS.low
                  const isActive = displayedSection?.sectionId === s.sectionId
                  return (
                    <button
                      key={s.sectionId}
                      onClick={() => {
                        setPageNumber(s.geometry?.page || 1)
                        setActiveSection(prev => prev?.sectionId === s.sectionId ? null : s)
                      }}
                      className={
                        "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left " +
                        (isActive ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-warm-600 hover:bg-warm-50')
                      }
                    >
                      <span className={"h-1.5 w-1.5 rounded-full shrink-0 " + color.dot} />
                      Section {i + 1}
                      {s.geometry && (
                        <span className="ml-auto text-[10px] text-warm-300">p.{s.geometry.page}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Filled fields summary */}
            {savedCount > 0 && (
              <div className="rounded-2xl border border-forest-200 bg-forest-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-forest-600 mb-2 px-1">
                  Filled fields ({savedCount}/{totalFields})
                </p>
                <div className="flex flex-col gap-1">
                  {session.answers.map(a => (
                    <div key={a.fieldId} className="flex items-center gap-2 px-2 py-1">
                      <CheckCircle size={11} className="text-forest-500 shrink-0" />
                      <span className="text-[10px] text-warm-600 truncate">{a.fieldLabel}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => navigate('/review')}
                  className="w-full mt-3 rounded-xl bg-brand-500 text-white text-xs font-semibold py-2 hover:bg-brand-600 transition-colors flex items-center justify-center gap-1.5"
                >
                  Review all answers <ArrowRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
