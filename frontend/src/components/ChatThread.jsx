import { useEffect, useRef } from 'react'
import { useStudio } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { handleUserInput, reopenResult, openSkill, goPage, setLang } from '../flow'
import { DOCK_ORDER, LANGS, iconFor } from '../taskIcons'
import Icon from './Icon'
import DinoLoader from './DinoLoader'

const EXAMPLES = [
  'Draft a legal notice for Rs. 50,000 unpaid rent, 15 days to comply',
  'What does Section 138 of the Negotiable Instruments Act cover?',
]

function Home() {
  const { skills, lang, langChosen } = useStudio(useShallow((s) => ({ skills: s.skills, lang: s.lang, langChosen: s.langChosen })))
  const dock = DOCK_ORDER.map((id) => skills.find((k) => k.id === id)).filter(Boolean)
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-serif text-[34px] font-semibold tracking-tight">Hello, how can I help you today?</h1>
      <p className="mt-2 text-muted text-sm max-w-md">Draft, research and prepare in one calm workspace. Type it, or just say it.</p>

      {!langChosen ? (
        <div className="mt-6">
          <div className="text-xs text-muted mb-2">Choose your language for voice and replies</div>
          <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)}
                className="text-[13px] border border-line bg-sheet rounded-full px-3 py-1 text-muted hover:text-ink hover:border-accent/60 transition-colors">
                {l.native}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={() => useStudio.setState({ langChosen: false })} className="mt-3 text-xs text-muted hover:text-ink inline-flex items-center gap-1.5">
          <Icon name="globe" size={13} /> {(LANGS.find((l) => l.code === lang) || LANGS[0]).native}
        </button>
      )}

      {dock.length > 0 && (
        <div className="mt-7 flex flex-wrap justify-center gap-2.5 max-w-lg" role="group" aria-label="Choose a task">
          {dock.map((k) => (
            <button key={k.id} onClick={() => openSkill(k.id)} title={k.description}
              className="group w-[78px] flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 hover:bg-sheet border border-transparent hover:border-line transition-colors">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent-soft text-accent group-hover:scale-105 transition-transform"><Icon name={iconFor(k.id)} size={19} /></span>
              <span className="text-[11px] leading-tight text-muted group-hover:text-ink">{k.name}</span>
            </button>
          ))}
          <button onClick={() => goPage('skills')} title="See every task"
            className="group w-[78px] flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 hover:bg-sheet border border-transparent hover:border-line transition-colors">
            <span className="grid place-items-center w-10 h-10 rounded-xl border border-line text-muted group-hover:text-ink"><Icon name="grid" size={19} /></span>
            <span className="text-[11px] leading-tight text-muted group-hover:text-ink">All tasks</span>
          </button>
        </div>
      )}

      <ul className="mt-5 w-full max-w-xl space-y-1 text-left">
        {EXAMPLES.map((e) => (
          <li key={e}>
            <button onClick={() => handleUserInput(e, 'typed')}
              className="w-full text-left rounded-lg px-4 py-2 text-sm text-muted hover:text-ink hover:bg-sheet transition-colors">
              {e}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResultCard({ m }) {
  return (
    <div className="border border-line bg-sheet rounded-xl p-4">
      <div className="font-medium">{m.title} finished</div>
      <div className="text-sm text-muted mt-1">
        {m.exported ? 'Exported.' : 'Saved to this chat.'}{' '}
        {m.warnings ? `${m.warnings} citation${m.warnings > 1 ? 's' : ''} still need review.` : 'All citations were verified.'}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => reopenResult(m.snapshot)} className="text-sm border border-line rounded-lg px-3 py-1.5 hover:bg-field">
          Reopen
        </button>
      </div>
    </div>
  )
}

export default function ChatThread() {
  const { messages, view, busy, generating, verifying, speed } = useStudio(useShallow((s) => ({
    messages: s.messages, view: s.view, busy: s.busy, generating: s.generating, verifying: s.verifying, speed: s.speed,
  })))
  const working = busy || generating || verifying
  const label = generating ? 'Drafting' : verifying ? 'Checking citations' : 'Understanding your request'
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, working])

  if (!messages.length && view === 'home' && !working) return <Home />

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3" aria-live="polite">
      {messages.map((m) => {
        if (m.role === 'user')
          return (
            <div key={m.id} className="flex justify-end">
              <div className="bg-accent text-white rounded-2xl rounded-br-md px-4 py-2 max-w-[85%] text-sm whitespace-pre-wrap">
                {m.source === 'voice' && <span className="mr-1" aria-label="spoken">🎤</span>}
                {m.text}
              </div>
            </div>
          )
        if (m.role === 'status')
          return <div key={m.id} className="text-xs text-muted pl-1">{m.text}</div>
        if (m.role === 'result') return <ResultCard key={m.id} m={m} />
        return (
          <div key={m.id} className={`text-sm leading-relaxed max-w-[92%] ${m.error ? 'text-bad' : ''}`}>
            {m.text}
          </div>
        )
      })}
      {working && <DinoLoader label={label} speed={speed} />}
      <div ref={end} />
    </div>
  )
}
