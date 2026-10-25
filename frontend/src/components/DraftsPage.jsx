import { useMemo, useState } from 'react'
import { useStudio } from '../store'
import { openDraft, removeDraft, renameDraft } from '../flow'
import { iconFor } from '../taskIcons'
import Icon from './Icon'

function when(ts) {
  const d = new Date(ts * 1000)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DraftsPage() {
  const drafts = useStudio((s) => s.drafts)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return drafts.filter((d) => !n || `${d.title} ${d.skill_name}`.toLowerCase().includes(n))
  }, [drafts, q])

  const startRename = (d) => { setEditing(d.id); setName(d.title) }
  const finishRename = async () => {
    const id = editing
    setEditing(null)
    if (id && name.trim()) await renameDraft(id, name.trim())
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Drafts</h1>
        <p className="text-muted mt-1 text-sm">Your work is saved here automatically as you draft.</p>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drafts" aria-label="Search drafts"
          className="mt-6 w-full max-w-sm text-sm bg-sheet border border-line rounded-lg px-3 py-2 outline-none focus:border-accent"
        />

        <ul className="mt-6 space-y-2">
          {shown.map((d) => (
            <li key={d.id} className="group flex items-center gap-3 bg-sheet border border-line rounded-xl px-4 py-3 hover:border-accent/60 transition-colors">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-accent-soft text-accent shrink-0"><Icon name={iconFor(d.skill_id)} size={17} /></span>
              {editing === d.id ? (
                <input
                  autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={finishRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setEditing(null) }}
                  aria-label="Draft name" className="flex-1 min-w-0 text-sm bg-field border border-accent rounded-md px-2 py-1 outline-none"
                />
              ) : (
                <button onClick={() => openDraft(d.id)} className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium truncate">{d.title}</div>
                  <div className="text-xs text-muted">{d.skill_name} · {when(d.updated_at)}</div>
                </button>
              )}
              <button onClick={() => startRename(d)} className="text-xs text-muted hover:text-ink opacity-0 group-hover:opacity-100 focus:opacity-100">Rename</button>
              <button onClick={() => removeDraft(d.id)} className="text-xs text-muted hover:text-bad opacity-0 group-hover:opacity-100 focus:opacity-100">Delete</button>
            </li>
          ))}
        </ul>

        {!shown.length && (
          <p className="mt-10 text-sm text-muted text-center">
            {drafts.length ? `No draft matches "${q}".` : 'No drafts yet. Start a task and your draft will appear here.'}
          </p>
        )}
      </div>
    </div>
  )
}
