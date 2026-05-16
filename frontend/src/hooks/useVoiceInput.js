import { useState, useRef, useCallback } from 'react'

/**
 * useVoiceInput — wraps the browser's Web Speech API.
 * Falls back gracefully if the API is unavailable.
 */
export default function useVoiceInput({ onResult, language = 'en-US' } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = useCallback(() => {
    if (!isSupported) {
      setError('Voice input is not supported in this browser.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = language

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      onResult?.(transcript)
    }

    recognition.onerror = (event) => {
      setError('Voice input error: ' + event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [isSupported, language, onResult])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  return { isListening, isSupported, error, start, stop }
}
