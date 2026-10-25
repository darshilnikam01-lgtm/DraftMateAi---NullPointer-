import { useEffect, useState } from 'react'
import { api } from '../api'
import { useStudio } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { cancelFinalize, exportDocx, exportPdf, finishAndReturn } from '../flow'

function Row({ ok, children }) {
  return (
    <li className="flex gap-2 text-sm">
      <span className={ok ? 'text-ok' : 'text-warn'} aria-hidden="true">{ok ? '✓' : '!'}</span>
      <span>{children}</span>
    </li>
  )
}

export default function FinalizeDialog() {
  const { draft, citations, mode } = useStudio(useShallow((s) => ({ draft: s.draft, citations: s.citations, mode: s.mode })))
  const [check, setCheck] = useState(null)

  useEffect(() => {
    api.finalizeCheck({
      draft, skill_id: mode.skill.id,
      unverified_count: citations.filter((c) => c.status === 'unverified').length,
      partial_count: citations.filter((c) => c.status === 'partial').length,
    }).then(setCheck).catch(() => setCheck({ placeholders: [], unverified: 0, partial: 0, exports: ['docx'] }))
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') cancelFinalize() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!check) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40" role="dialog" aria-modal="true" aria-labelledby="fd-title">
      <div className="bg-sheet rounded-2xl p-6 w-[480px] max-w-[92vw] shadow-xl">
        <h2 id="fd-title" className="font-serif text-xl font-semibold">Ready to finish?</h2>
        <ul className="mt-4 space-y-2">
          <Row ok={!check.placeholders.length}>
            {check.placeholders.length ? `Placeholders still to fill: ${check.placeholders.join(', ')}` : 'No placeholders left'}
          </Row>
          <Row ok={!check.unverified}>{check.unverified ? `${check.unverified} unverified citation(s)` : 'No unverified citations'}</Row>
          <Row ok={!check.partial}>{check.partial ? `${check.partial} partly verified citation(s)` : 'No partly verified citations'}</Row>
        </ul>
        <p className="text-xs text-muted mt-4">You can still export. The warnings above stay your responsibility to resolve.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={async () => { if (await exportDocx()) finishAndReturn(true) }} className="bg-accent text-white rounded-lg px-4 py-2 text-sm">Export Word file</button>
          <button onClick={() => { if (exportPdf()) finishAndReturn(true) }} className="border border-line rounded-lg px-4 py-2 text-sm hover:bg-field">Export PDF</button>
          <button onClick={() => finishAndReturn(false)} className="border border-line rounded-lg px-4 py-2 text-sm hover:bg-field">Save and return to chat</button>
          <button onClick={cancelFinalize} className="text-sm text-muted px-2">Keep editing</button>
        </div>
      </div>
    </div>
  )
}
