import { useCallback, useEffect, useRef, useState } from 'react'

// Browser speech-to-text (Chrome / Edge). The final transcript goes to onFinal; the live text is `interim`.
export function useSpeech(onFinal, locale = 'en-IN') {
  const recRef = useRef(null)
  const cb = useRef(onFinal)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const loc = useRef(locale)
  useEffect(() => { cb.current = onFinal }, [onFinal])
  useEffect(() => { loc.current = locale }, [locale])

  const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

  const start = useCallback(() => {
    if (!SR) return
    const rec = new SR()
    rec.lang = loc.current
    rec.interimResults = true
    rec.continuous = false
    let finalText = ''
    rec.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setInterim(t)
      if (e.results[e.results.length - 1].isFinal) finalText = t
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
      if (finalText.trim()) cb.current(finalText.trim())
    }
    rec.onerror = () => { setListening(false); setInterim('') }
    rec.start()
    recRef.current = rec
    setListening(true)
  }, [SR])

  const stop = useCallback(() => recRef.current?.stop(), [])
  return { start, stop, listening, interim, supported: !!SR }
}
