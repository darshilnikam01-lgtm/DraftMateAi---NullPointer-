import { useEffect, useState } from 'react'
import { useStudio } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { runVerification } from '../flow'

const STATUS = {
  verified: { label: 'Verified', cls: 'bg-ok-soft text-ok', mark: '✓' },
  partial: { label: 'Partly verified', cls: 'bg-warn-soft text-warn', mark: '◐' },
  unverified: { label: 'Unverified', cls: 'bg-bad-soft text-bad', mark: '✕' },
}

function locate(c) {
  const els = document.querySelectorAll(`.draft [data-cid="${c.id}"]`)
  const el = els[0]
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  els.forEach((e) => e.classList.add('cite-flash'))
  setTimeout(() => els.forEach((e) => e.classList.remove('cite-flash')), 1400)
}

function Card({ c, active }) {
  const st = STATUS[c.status]
  return (
    <li id={`cite-card-${c.id}`} className={`border rounded-xl p-3 bg-sheet transition-shadow ${active ? 'border-accent ring-2 ring-accent/30' : 'border-line'}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
          <span aria-hidden="true">{st.mark} </span>{st.label}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium break-words">{c.text}</p>
      <p className="mt-1 text-xs text-muted">{c.reason}</p>
      <div className="mt-2 flex gap-3 text-xs">
        {c.source_url && <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="text-accent underline">Open source</a>}
        {c.type !== 'placeholder' && <button onClick={() => locate(c)} className="text-muted hover:text-ink">Find in draft</button>}
      </div>
    </li>
  )
}

export default function VerificationPanel() {
  const { citations, verifying, draft } = useStudio(useShallow((s) => ({ citations: s.citations, verifying: s.verifying, draft: s.draft })))
  const [filter, setFilter] = useState('all')
  const activeCite = useStudio((s) => s.activeCite)
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    if (!activeCite) return
    setFilter('all')
    setFlash(activeCite.id)
    setTimeout(() => document.getElementById(`cite-card-${activeCite.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    const t = setTimeout(() => setFlash(null), 1800)
    return () => clearTimeout(t)
  }, [activeCite])
  const counts = { verified: 0, partial: 0, unverified: 0 }
  citations.forEach((c) => { counts[c.status]++ })
  const shown = filter === 'all' ? citations : citations.filter((c) => c.status === filter)

  return (
    <aside className="w-[340px] shrink-0 border-l border-line bg-field flex flex-col min-h-0" aria-label="Citation review">
      <div className="p-4 border-b border-line bg-sheet">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Citation review</h2>
          <button onClick={runVerification} disabled={verifying || !draft} className="text-xs border border-line rounded-lg px-2.5 py-1 hover:bg-field disabled:opacity-40">
            {verifying ? 'Checking…' : 'Check again'}
          </button>
        </div>
        {citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {[['all', `All ${citations.length}`], ['verified', `Verified ${counts.verified}`], ['partial', `Partly ${counts.partial}`], ['unverified', `Unverified ${counts.unverified}`]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={`px-2.5 py-1 rounded-full border ${filter === k ? 'bg-accent text-white border-accent' : 'border-line bg-sheet'}`}>{l}</button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {verifying && <p className="text-sm text-muted animate-pulse">Looking each authority up in Indian Kanoon…</p>}
        {!verifying && !citations.length && (
          <p className="text-sm text-muted">{draft ? 'No citations were found in this draft.' : 'Citations appear here once a draft exists. Each one is looked up in an external legal source, never judged by the AI alone.'}</p>
        )}
        <ul className="space-y-2">{shown.map((c) => <Card key={c.id} c={c} active={flash === c.id} />)}</ul>
      </div>
      <p className="p-3 text-xs text-muted border-t border-line">
        Checks accessible sources only. Always confirm authorities yourself before relying on them.
      </p>
    </aside>
  )
}
