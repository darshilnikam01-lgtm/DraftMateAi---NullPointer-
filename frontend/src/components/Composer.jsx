import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStudio } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { handleUserInput, uploadFile, changeFileRole, removeFile, openSkill, setSpeed, setLang } from '../flow'
import { LANGS, localeOf } from '../taskIcons'
import { useSpeech } from '../hooks/useSpeech'
import Icon from './Icon'

const ROLES = [
  ['reference', 'Reference style'],
  ['template', 'Template'],
  ['source', 'Source material'],
]

function strength(text, fileCount) {
  const v = text.toLowerCase()
  const checks = [
    [v.length > 25, 20, 'what you want drafted'],
    [v.length > 90, 10, 'more background'],
    [/india|lucknow|delhi|mumbai|high court|section|act\b|code\b/.test(v), 20, 'jurisdiction or the law involved'],
    [/₹|rs\.?\s?\d|\d{3,}/.test(v), 15, 'the amount'],
    [/m\/s|\bv\.|pvt|ltd|\bmr\.?\b|\bms\.?\b|\bshri\b|\bsmt\b/.test(v), 10, 'party names'],
    [/\d+\s*(days?|months?|weeks?)/.test(v), 10, 'a time limit'],
    [fileCount > 0, 15, 'a reference or template document'],
  ]
  const score = Math.min(100, checks.reduce((a, [ok, pts]) => a + (ok ? pts : 0), 0))
  const missing = checks.filter(([ok]) => !ok).map(([, , label]) => label)
  return { score, missing }
}

export default function Composer() {
  const { files, view, mode, skills, busy, generating, speed, lang } = useStudio(useShallow((s) => ({
    files: s.files, view: s.view, mode: s.mode, skills: s.skills, busy: s.busy, generating: s.generating, speed: s.speed, lang: s.lang,
  })))
  const [text, setText] = useState('')
  const [pending, setPending] = useState(null)
  const [menu, setMenu] = useState(false)
  const timer = useRef(null)
  const fileInput = useRef(null)

  const onFinal = useCallback((spoken) => {
    setPending(spoken)
    timer.current = setTimeout(() => { handleUserInput(spoken, 'voice'); setPending(null) }, 2000)
  }, [])
  const { start, stop, listening, interim, supported } = useSpeech(onFinal, localeOf(lang))
  useEffect(() => () => clearTimeout(timer.current), [])

  const at = text.match(/@(\w*)$/)
  const atMatches = useMemo(() => {
    if (!at) return []
    const n = at[1].toLowerCase()
    return skills.filter((s) => s.name.toLowerCase().replace(/\s/g, '').includes(n)).slice(0, 6)
  }, [at?.[1], skills])
  const pickAt = (s) => { setText(text.replace(/@\w*$/, '')); openSkill(s.id) }

  const send = () => {
    if (!text.trim()) return
    handleUserInput(text, 'typed')
    setText('')
  }
  const sendPendingNow = () => { clearTimeout(timer.current); handleUserInput(pending, 'voice'); setPending(null) }
  const editPending = () => { clearTimeout(timer.current); setText(pending); setPending(null) }

  const defaultRole = view === 'mode' && mode?.config.needs_file ? 'source' : 'reference'
  const onPick = (e) => { [...e.target.files].forEach((f) => uploadFile(f, defaultRole)); e.target.value = '' }

  const { score, missing } = strength(text, files.length)
  const showMeter = view === 'home'

  return (
    <div className="px-4 pb-3 pt-2">
      {files.length > 0 && (
        <ul className="mb-2 space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-xs bg-sheet border border-line rounded-lg px-2.5 py-1.5">
              <span className="truncate flex-1" title={f.name}>{f.name}</span>
              {f.status === 'converting' ? (
                <span className="text-muted animate-pulse">Converting to Markdown…</span>
              ) : (
                <>
                  <select value={f.role} onChange={(e) => changeFileRole(f.id, e.target.value)} className="bg-transparent text-muted" aria-label={`Role of ${f.name}`}>
                    {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <button onClick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`} className="text-muted hover:text-bad">✕</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <div className="mb-2 flex items-center gap-2 text-sm bg-accent-soft rounded-lg px-3 py-2">
          <span className="flex-1">Heard: “{pending}”. Sending in a moment.</span>
          <button onClick={sendPendingNow} className="font-medium text-accent">Send now</button>
          <button onClick={editPending} className="text-muted">Edit</button>
        </div>
      )}

      <div className="relative border border-line bg-sheet rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,.04)] focus-within:border-accent/60 transition-colors">
        {atMatches.length > 0 && (
          <ul role="listbox" aria-label="Skills" className="absolute bottom-full mb-2 left-0 w-72 bg-sheet border border-line rounded-xl shadow-lg p-1 z-20">
            {atMatches.map((s, i) => (
              <li key={s.id}>
                <button onClick={() => pickAt(s)} className={`w-full text-left px-3 py-2 rounded-lg hover:bg-field ${i === 0 ? 'bg-field' : ''}`}>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted truncate">{s.description}</div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          value={listening ? interim : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (atMatches.length) pickAt(atMatches[0])
              else send()
            }
          }}
          rows={view === 'home' ? 3 : 2}
          disabled={listening}
          placeholder={
            listening ? 'Listening…'
            : view === 'home' ? 'Ask anything, or type @ to use a specific legal skill'
            : 'Ask for a change, or say “finish” when you are done'
          }
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm outline-none max-h-48"
        />

        <div className="flex items-center gap-1 px-2 pb-2">
          <button onClick={() => fileInput.current.click()} className="p-2 rounded-lg text-muted hover:text-ink hover:bg-field" aria-label="Attach a document" title="Attach a document"><Icon name="clip" /></button>
          <input ref={fileInput} type="file" multiple accept=".pdf,.docx,.txt,.md,.pptx,.xlsx" className="hidden" onChange={onPick} />

          <div className="relative">
            <button onClick={() => setMenu((v) => !v)} className="px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-ink hover:bg-field" aria-haspopup="menu" aria-expanded={menu}>Skills</button>
            {menu && (
              <ul role="menu" className="absolute bottom-10 left-0 w-72 bg-sheet border border-line rounded-xl shadow-lg p-1 z-20">
                {skills.map((s) => (
                  <li key={s.id}>
                    <button role="menuitem" onClick={() => { setMenu(false); openSkill(s.id) }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-field">
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted">{s.description}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div role="radiogroup" aria-label="Speed" className="inline-flex rounded-lg bg-field p-0.5 ml-1">
            {[
              ['lite', 'bolt', 'Lite', 'Fast. Light model with low thinking. Good for first drafts and quick edits.'],
              ['pro', 'brain', 'Pro', 'Slower. Main model with deep thinking. Better for complex or high-stakes drafts.'],
            ].map(([v, icon, l, tip]) => (
              <button
                key={v} role="radio" aria-checked={speed === v} title={tip} disabled={busy || generating}
                onClick={() => setSpeed(v)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs disabled:opacity-60 ${speed === v ? 'bg-sheet text-ink font-medium shadow-sm' : 'text-muted hover:text-ink'}`}
              ><Icon name={icon} size={13} />{l}</button>
            ))}
          </div>

          <span className="flex-1" />
          <select
            value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Voice and reply language" title="Voice and reply language"
            className="text-xs bg-transparent text-muted hover:text-ink rounded-md px-1.5 py-1 outline-none cursor-pointer max-w-[88px]"
          >
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
          </select>
          <button
            onClick={listening ? stop : start}
            disabled={!supported}
            title={supported ? 'Speak' : 'Voice input needs Chrome or Edge'}
            aria-label={listening ? 'Stop listening' : 'Start voice input'}
            className={`p-2 rounded-full ${listening ? 'bg-bad text-sheet animate-pulse' : 'text-muted hover:text-ink hover:bg-field disabled:opacity-40'}`}
          >
            <Icon name="mic" />
          </button>
          <button onClick={send} disabled={busy || generating || !text.trim()} aria-label="Send" className="grid place-items-center w-9 h-9 bg-accent text-white rounded-full disabled:opacity-30 transition-opacity">
            <Icon name="send" />
          </button>
        </div>
      </div>

      {showMeter && (
        <div className="mt-3 px-1">
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>Prompt strength</span>
            <div className="flex-1 h-1 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
              <i className="block h-full bg-accent transition-[width] duration-300" style={{ width: `${score}%` }} />
            </div>
            <span className="tabular-nums w-9 text-right">{score}%</span>
          </div>
          {text.trim() && score < 100 && missing.length > 0 && (
            <p className="mt-1.5 text-xs text-muted">Add {missing.slice(0, 3).join(', ')} for a more accurate draft.</p>
          )}
        </div>
      )}
    </div>
  )
}
