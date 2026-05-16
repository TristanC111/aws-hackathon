import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_SECTIONS = [
  {
    sectionId: 'sec_001',
    index: 0,
    originalText:
      'Part A.I. – Information About You. Provide your full legal name as it appears on your passport or official identification document.',
    plainExplanation:
      'This part asks for your full name — exactly as it is written in your passport or ID card.',
    whyItMatters:
      'The government uses this to match your application to the right person. A wrong name can cause delays.',
    riskLevel: 'low',
    riskReason: null,
    safeToSuggest: true,
    suggestedAnswer: null,
    geometry: { page: 1, boundingBox: { Left: 0.0, Top: 0.06, Width: 1.0, Height: 0.20 } },
  },
  {
    sectionId: 'sec_002',
    index: 1,
    originalText:
      'Part A.II. – Information About Your Spouse and Children. List all family members who are currently in the United States and those who may be included in your application.',
    plainExplanation:
      'This section asks you to list your husband or wife and any children, and whether they are in the US.',
    whyItMatters:
      'Your family members can be included in your asylum case so they are protected too.',
    riskLevel: 'medium',
    riskReason: 'Family separation situations may require additional legal guidance.',
    safeToSuggest: true,
    suggestedAnswer: null,
    geometry: { page: 1, boundingBox: { Left: 0.0, Top: 0.26, Width: 1.0, Height: 0.22 } },
  },
  {
    sectionId: 'sec_003',
    index: 2,
    originalText:
      'Part B – Information About Your Application. Have you, your spouse, or your child ever ordered, incited, assisted, or otherwise participated in causing harm or death to any person because of their race, religion, nationality, membership in a particular social group, or political opinion?',
    plainExplanation:
      'This question asks whether you or anyone in your family ever hurt someone because of their religion, race, or political beliefs.',
    whyItMatters:
      'This is a very serious question. Your answer affects whether you qualify for asylum. Answer carefully and honestly.',
    riskLevel: 'high',
    riskReason:
      'Persecution-related question — requires legal review before answering.',
    safeToSuggest: false,
    suggestedAnswer: null,
    geometry: { page: 1, boundingBox: { Left: 0.0, Top: 0.50, Width: 1.0, Height: 0.22 } },
  },
  {
    sectionId: 'sec_004',
    index: 3,
    originalText:
      'Part C – Additional Information. Describe in detail your fear of persecution. Explain what happened to you or your family that makes you afraid to return to your home country.',
    plainExplanation:
      'This is where you tell your story. Explain in your own words what happened to you or your family, and why you are afraid to go back home.',
    whyItMatters:
      'This is the most important part of your application. Be as specific and detailed as possible about dates, places, and events.',
    riskLevel: 'high',
    riskReason:
      'Core persecution claim — strongly recommended to complete with legal aid support.',
    safeToSuggest: false,
    suggestedAnswer: null,
    geometry: { page: 2, boundingBox: { Left: 0.0, Top: 0.05, Width: 1.0, Height: 0.40 } },
  },
  {
    sectionId: 'sec_005',
    index: 4,
    originalText:
      'Part D – Signature. I certify, under penalty of perjury under the laws of the United States of America, that this application and the evidence submitted with it is all true and correct.',
    plainExplanation:
      'By signing here, you are promising that everything you wrote is true. Lying on this form is a serious crime.',
    whyItMatters:
      'Do not sign until you have checked every answer. If something is wrong, fix it first.',
    riskLevel: 'medium',
    riskReason: 'Legal declaration — ensure all prior sections are accurate.',
    safeToSuggest: true,
    suggestedAnswer: null,
    geometry: { page: 2, boundingBox: { Left: 0.0, Top: 0.48, Width: 1.0, Height: 0.18 } },
  },
]

const MOCK_FORM_FIELDS = [
  {
    fieldId: 'field_001',
    fieldLabel: 'Full Legal Name',
    fieldDescription: 'Enter your name exactly as it appears on your passport.',
    geometry: { page: 1, boundingBox: { Left: 0.02, Top: 0.10, Width: 0.56, Height: 0.036 } },
  },
  {
    fieldId: 'field_002',
    fieldLabel: 'Date of Birth',
    fieldDescription: 'Enter in MM/DD/YYYY format.',
    geometry: { page: 1, boundingBox: { Left: 0.02, Top: 0.16, Width: 0.28, Height: 0.036 } },
  },
  {
    fieldId: 'field_003',
    fieldLabel: 'Country of Birth',
    fieldDescription: 'The country where you were born.',
    geometry: { page: 1, boundingBox: { Left: 0.02, Top: 0.30, Width: 0.40, Height: 0.036 } },
  },
  {
    fieldId: 'field_004',
    fieldLabel: 'Nationality',
    fieldDescription: 'Your current citizenship.',
    geometry: { page: 1, boundingBox: { Left: 0.02, Top: 0.37, Width: 0.40, Height: 0.036 } },
  },
  {
    fieldId: 'field_005',
    fieldLabel: 'Current Address in US',
    fieldDescription: 'Where you are currently living in the United States.',
    geometry: { page: 1, boundingBox: { Left: 0.02, Top: 0.44, Width: 0.80, Height: 0.036 } },
  },
]

function mockDelay(ms = 1200) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── API functions ─────────────────────────────────────────────────────────────

/**
 * Upload a PDF and start a new session.
 * @param {File} file
 * @param {string} language  BCP-47 code
 */
export async function uploadDocument(file, language) {
  if (USE_MOCK) {
    await mockDelay(1500)
    return {
      sessionId: 'mock-session-' + Date.now(),
      status: 'uploaded',
      pageCount: 12,
      detectedDocumentLanguage: 'en',
      message: 'Document received. Analysis starting.',
    }
  }
  const form = new FormData()
  form.append('file', file)
  form.append('language', language)
  const { data } = await api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/**
 * Analyze the uploaded document — extract, translate, explain.
 * @param {string} sessionId
 * @param {string} language  BCP-47 code
 */
export async function analyzeDocument(sessionId, language) {
  if (USE_MOCK) {
    await mockDelay(3000)
    return {
      sessionId,
      documentTitle: 'Form I-589, Application for Asylum and Withholding of Removal',
      language,
      sections: MOCK_SECTIONS,
      totalSections: MOCK_SECTIONS.length,
      highRiskCount: MOCK_SECTIONS.filter(s => s.riskLevel === 'high').length,
    }
  }
  const { data } = await api.post('/analyze', { sessionId, language })
  return data
}

/**
 * Get an AI suggestion for a single form field.
 */
export async function getFieldSuggestion({ sessionId, language, fieldId, fieldLabel, fieldDescription, conversationHistory }) {
  if (USE_MOCK) {
    await mockDelay(800)
    const suggestions = {
      field_001: { suggestedValue: 'Ahmad Al-Rashidi', reasoning: 'Please enter your full legal name.', confidence: 'low' },
      field_002: { suggestedValue: '', reasoning: 'Please enter your date of birth.', confidence: 'low' },
      field_003: { suggestedValue: 'Syria', reasoning: 'Based on your name this may be Syria — please confirm.', confidence: 'medium' },
      field_004: { suggestedValue: 'Syrian', reasoning: 'Most applicants from Syria are Syrian nationals.', confidence: 'medium' },
      field_005: { suggestedValue: '', reasoning: 'Please enter your current US address.', confidence: 'low' },
    }
    const s = suggestions[fieldId] || { suggestedValue: '', reasoning: 'Please fill in this field.', confidence: 'low' }
    return { fieldId, ...s, needsConfirmation: true, riskLevel: 'low' }
  }
  const { data } = await api.post('/form-suggest', {
    sessionId, language, fieldId, fieldLabel, fieldDescription, conversationHistory,
  })
  return data
}

/**
 * Save current form progress.
 */
export async function saveSession(sessionId, answers, completionPercent) {
  if (USE_MOCK) {
    await mockDelay(300)
    return { sessionId, saved: true, completionPercent }
  }
  const { data } = await api.post('/session/save', { sessionId, answers, completionPercent })
  return data
}

/**
 * Get a session by ID.
 */
export async function getSession(sessionId) {
  if (USE_MOCK) {
    await mockDelay(400)
    return null
  }
  const { data } = await api.get(`/session/${sessionId}`)
  return data
}

/**
 * Generate a completed form draft PDF.
 */
export async function generateDraft(sessionId, language) {
  if (USE_MOCK) {
    await mockDelay(2000)
    return {
      sessionId,
      downloadUrl: '#',
      expiresIn: 3600,
      completionPercent: 100,
      flaggedSections: MOCK_SECTIONS.filter(s => s.riskLevel === 'high').map(s => ({
        sectionId: s.sectionId,
        message: 'This section was flagged as legally sensitive. Please review with a legal aid advisor before submitting.',
      })),
    }
  }
  const { data } = await api.post('/generate-draft', { sessionId, language })
  return data
}

/**
 * Get legal aid organizations.
 */
export async function getLegalAid(country = 'US', language = '') {
  if (USE_MOCK) {
    await mockDelay(300)
    return { organizations: [] } // populated from static data file
  }
  const { data } = await api.get('/legal-aid', { params: { country, language } })
  return data
}

export { MOCK_FORM_FIELDS }
