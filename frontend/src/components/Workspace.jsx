import { useEffect, useState } from 'react'
import { api } from '../api'
import { set, useStudio } from '../store'
import { useShallow } from 'zustand/react/shallow'
import {
  exitMode, openRedline, openSkill, requestFinalize, restoreVersion, runGenerate, stopGeneration, textOf, handleUserInput,
} from '../flow'
import Editor from './Editor'
import VerificationPanel from './VerificationPanel'

function VersionHistory() {
  const versions = useStudio((s) => s.versions)
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="text-sm border border-line rounded-lg px-3 py-1.5 hover:bg-field" aria-expanded={open}>
        History ({versions.length})
      </button>
      {open && (
        <ul className="absolute right-0 top-10 w-80 max-h-80 overflow-y-auto bg-sheet border border-line rounded-xl shadow-lg p-1 z-20">
          {!versions.length && <li className="p-3 text-sm text-muted">Versions are saved before every change.</li>}
          {versions.map((v) => (
            <li key={v.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-field">
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{v.label}</div>
                <div className="text-xs text-muted">{v.time.toLocaleTimeString()}</div>
              </div>
              <button onClick={() => { openRedline(v.id); setOpen(false) }} className="text-xs text-muted hover:text-ink" title="Show what changed since this version">Compare</button>
              <button onClick={() => { restoreVersion(v.id); setOpen(false) }} className="text-xs text-accent">Restore</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Header() {
  const { mode, models, model, stats, skills, speed } = useStudio(useShallow((s) => ({ mode: s.mode, models: s.models, model: s.model, stats: s.stats, skills: s.skills, speed: s.speed })))
  const saveState = useStudio((s) => s.saveState)
  const saved = stats && stats.naive > 0 ? Math.max(0, Math.round((1 - stats.prompt / stats.naive) * 100)) : null
  return (
    <header className="flex items-center gap-3 px-5 py-2.5 bg-sheet/90 backdrop-blur border-b border-line">
      <div className="min-w-0">
        <div className="text-xs text-muted">Workspace</div>
        <select
          value={mode.skill.id}
          onChange={(e) => openSkill(e.target.value)}
          className="font-serif text-lg font-semibold bg-transparent -ml-1"
          aria-label="Change skill"
        >
          {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <span className="flex-1" />
      {saveState !== 'idle' && (
        <span className={`text-xs ${saveState === 'error' ? 'text-bad' : 'text-muted'}`}>
          {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Not saved'}
        </span>
      )}
      {stats && (
        <span className="text-xs text-muted" title="Estimated tokens sent to the model versus pasting every uploaded document in full">
          Context {stats.prompt.toLocaleString()} tokens{saved !== null && saved > 0 ? ` (${saved}% less than full paste)` : ''}
        </span>
      )}
      <select value={model || ''} onChange={(e) => set({ model: e.target.value })} className="text-sm border border-line rounded-lg px-2 py-1.5 bg-sheet" aria-label="Model" disabled={speed === 'lite'} title={speed === 'lite' ? 'Lite always uses the fast model. Switch to Pro to choose a model.' : 'Model used in Pro'}>
        {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <VersionHistory />
      <button onClick={exitMode} className="text-sm border border-line rounded-lg px-3 py-1.5 hover:bg-field">Leave</button>
      <button onClick={requestFinalize} className="text-sm bg-accent text-white rounded-lg px-4 py-1.5 hover:opacity-90">Finish</button>
    </header>
  )
}

function Toolbox() {
  const { mode, params, draft, files, generating } = useStudio(useShallow((s) => ({ mode: s.mode, params: s.params, draft: s.draft, files: s.files, generating: s.generating })))
  const cfg = mode.config
  const hasDraft = !!textOf(draft)
  const missing = cfg.fields.filter((f) => f.required && !String(params[f.key] || '').trim())
  const needFile = cfg.needs_file && files.length === 0
  const ready = !missing.length && !needFile

  return (
    <div className="px-5 py-3 bg-sheet border-b border-line space-y-3">
      {cfg.fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {cfg.fields.map((f) => {
            const empty = f.required && !String(params[f.key] || '').trim()
            return (
              <label key={f.key} className="text-xs text-muted">
                {f.label}{f.required ? ' (required)' : ''}
                <input
                  value={params[f.key] || ''}
                  onChange={(e) => set((s) => ({ params: { ...s.params, [f.key]: e.target.value } }))}
                  className={`mt-1 block w-full text-sm text-ink rounded-lg px-2.5 py-1.5 bg-field border ${empty ? 'border-warn' : 'border-transparent'}`}
                />
              </label>
            )
          })}
        </div>
      )}
      {needFile && <p className="text-xs text-warn">This workspace needs a document. Attach one with the paperclip in the chat.</p>}

      <div className="flex flex-wrap items-center gap-2">
        {!hasDraft && (
          <button
            onClick={() => runGenerate(useStudio.getState().goal || `Prepare the ${mode.skill.name}`)}
            disabled={!ready || generating}
            className="text-sm bg-accent text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
          >
            Generate draft
          </button>
        )}
        {generating && (
          <button onClick={stopGeneration} className="text-sm border border-bad text-bad rounded-lg px-3 py-1.5">Stop</button>
        )}
        {hasDraft && cfg.quick_actions.map((a) => (
          <button
            key={a.label}
            onClick={() => handleUserInput(a.instruction, 'typed')}
            disabled={generating}
            className="text-xs border border-line rounded-full px-3 py-1.5 hover:bg-accent-soft hover:border-accent disabled:opacity-40"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SourcePanel() {
  const files = useStudio((s) => s.files)
  const source = files.find((f) => f.role === 'source' && !String(f.id).startsWith('tmp-'))
  const [text, setText] = useState('')
  useEffect(() => {
    if (!source) return setText('')
    api.getFile(source.id).then((r) => setText(r.text)).catch(() => setText('Could not load the document.'))
  }, [source?.id])
  return (
    <div className="w-[38%] min-w-[280px] border-r border-line bg-sheet flex flex-col min-h-0">
      <div className="px-4 py-2 text-sm font-medium border-b border-line truncate">{source ? source.name : 'Source document'}</div>
      <pre className="flex-1 overflow-auto p-4 text-xs whitespace-pre-wrap font-sans text-muted">{source ? text : 'Attach the contract you want reviewed.'}</pre>
    </div>
  )
}

export default function Workspace() {
  const mode = useStudio((s) => s.mode)
  if (!mode) return null
  const cfg = mode.config
  return (
    <>
      <Header />
      <Toolbox />
      <div className="flex-1 flex min-h-0">
        {cfg.layout === 'review' && <SourcePanel />}
        <Editor />
        {cfg.panels.includes('verification') && <VerificationPanel />}
      </div>
    </>
  )
}
