import { createContext, useContext, useReducer } from 'react'

const SessionContext = createContext(null)

const initialState = {
  sessionId: null,
  language: 'en',
  languageName: 'English',
  documentTitle: null,
  sections: [],
  answers: [],
  completionPercent: 0,
  status: 'idle', // idle | uploading | analyzing | in_progress | complete
  highRiskCount: 0,
  fillMode: 'guided', // 'guided' | 'direct'
  pdfUrl: null,
}

function sessionReducer(state, action) {
  switch (action.type) {
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload.code, languageName: action.payload.name }
    case 'SET_FILL_MODE':
      return { ...state, fillMode: action.payload }
    case 'SET_PDF_URL':
      return { ...state, pdfUrl: action.payload }
    case 'UPLOAD_START':
      return { ...state, status: 'uploading' }
    case 'UPLOAD_SUCCESS':
      return { ...state, sessionId: action.payload.sessionId, status: 'analyzing' }
    case 'ANALYZE_SUCCESS':
      return {
        ...state,
        documentTitle: action.payload.documentTitle,
        sections: action.payload.sections,
        highRiskCount: action.payload.highRiskCount,
        status: 'in_progress',
      }
    case 'SAVE_ANSWER': {
      const existing = state.answers.findIndex(a => a.fieldId === action.payload.fieldId)
      const answers = existing >= 0
        ? state.answers.map((a, i) => i === existing ? action.payload : a)
        : [...state.answers, action.payload]
      const completionPercent = Math.round((answers.length / Math.max(state.sections.length, 1)) * 100)
      return { ...state, answers, completionPercent }
    }
    case 'SET_COMPLETE':
      return { ...state, status: 'complete', completionPercent: 100 }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export function SessionProvider({ children }) {
  const [session, dispatch] = useReducer(sessionReducer, initialState)
  return (
    <SessionContext.Provider value={{ session, dispatch }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
