import { useEffect, useMemo } from 'react'
import { set, useStudio } from '../store'
import { diffWords, toPlain } from '../diff'

export default function RedlineModal() {
  const r = useStudio((s) => s.redline)
  const ops = useMemo(() => (r ? diffWords(toPlain(r.before), toPlain(r.after)) : []), [r])

  useEffect(() => {
    if (!r) return
    const onKey = (e) => { if (e.key === 'Escape') set({ redline: null }) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [r])
  if (!r) return null

  const words = (t) => ops.filter((o) => o.t === t && o.w !== '\n').length
  const ins = words('ins')
  const del = words('del')

  const runs = []
  ops.forEach((o) => {
    const last = runs[runs.length - 1]
    if (last && last.t === o.t) last.ws.push(o.w)
    else runs.push({ t: o.t, ws: [o.w] })
  })
  const render = (ws) => ws.map((w, i) => (w === '\n' ? <br key={i} /> : <span key={i}>{w} </span>))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="rl-title">
      <div className="bg-sheet border border-line rounded-2xl w-[860px] max-w-full max-h-[88vh] flex flex-col shadow-2xl">
        <div className="flex items-start gap-3 px-6 py-4 border-b border-line">
          <div className="flex-1 min-w-0">
            <h2 id="rl-title" className="font-serif text-xl font-semibold">Redline</h2>
            <p className="text-xs text-muted truncate">“{r.label}” ({r.time.toLocaleTimeString()}) compared with the current draft</p>
          </div>
          <span className="text-xs rounded-full bg-ok-soft text-ok px-2.5 py-1">+{ins} words</span>
          <span className="text-xs rounded-full bg-bad-soft text-bad px-2.5 py-1">−{del} words</span>
          <button onClick={() => set({ redline: null })} className="text-sm border border-line rounded-lg px-3 py-1 hover:bg-field">Close</button>
        </div>
        <div className="overflow-y-auto px-8 py-6">
          {ins + del === 0 ? (
            <p className="text-sm text-muted">No differences. This version matches the current draft.</p>
          ) : (
            <div className="redline font-serif text-[16px] leading-[1.75]">
              {runs.map((run, i) =>
                run.t === 'ins' ? <ins key={i}>{render(run.ws)}</ins>
                : run.t === 'del' ? <del key={i}>{render(run.ws.filter((w) => w !== '\n'))}</del>
                : <span key={i}>{render(run.ws)}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
