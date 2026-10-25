import { useEffect, useMemo, useRef, useState } from 'react'
import { set, useStudio } from '../store'
import {
  exitMode, exportDocx, goPage, openDraft, openRedline, openSkill, requestFinalize, runVerification, setSpeed, textOf, toggleTheme,
} from '../flow'

export default function CommandPalette() {
  const open = useStudio((s) => s.palette)
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const input = useRef(null)

  const close = () => set({ palette: false })

  const commands = useMemo(() => {
    if (!open) return []
    const s = useStudio.getState()
    const inMode = s.view === 'mode'
    const hasDraft = !!textOf(s.draft)
    const list = [
      { group: 'Go to', label: 'Drafter', run: () => goPage('drafter') },
      { group: 'Go to', label: 'Drafts', run: () => goPage('drafts') },
      { group: 'Go to', label: 'Skills library', run: () => goPage('skills') },
      { group: 'Settings', label: s.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', run: toggleTheme },
      { group: 'Settings', label: 'Speed: Lite (fast)', run: () => setSpeed('lite') },
      { group: 'Settings', label: 'Speed: Pro (slower, deeper)', run: () => setSpeed('pro') },
    ]
    if (inMode && hasDraft) {
      list.push(
        { group: 'Draft', label: 'Check citations', run: runVerification },
        { group: 'Draft', label: 'Compare with the previous version', run: () => s.versions[0] ? openRedline(s.versions[0].id) : null },
        { group: 'Draft', label: 'Download as Word', run: exportDocx },
        { group: 'Draft', label: 'Finish and export', run: requestFinalize },
      )
    }
    if (inMode) list.push({ group: 'Draft', label: 'Leave workspace', run: exitMode })
    s.drafts.slice(0, 8).forEach((d) => list.push({ group: 'Open draft', label: d.title, hint: d.skill_name, run: () => openDraft(d.id) }))
    s.skills.forEach((k) => list.push({ group: 'Open skill', label: k.name, hint: k.category, run: () => openSkill(k.id) }))
    return list
  }, [open])

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return commands.filter((c) => !n || `${c.label} ${c.group}`.toLowerCase().includes(n)).slice(0, 12)
  }, [commands, q])

  useEffect(() => { if (open) { setQ(''); setI(0); setTimeout(() => input.current?.focus(), 0) } }, [open])
  useEffect(() => setI(0), [q])

  const run = (c) => { close(); c?.run() }
  const onKey = (e) => {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI((v) => Math.min(v + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((v) => Math.max(v - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(shown[i]) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/35 z-[60] flex items-start justify-center pt-[14vh] px-4" onMouseDown={close}>
      <div role="dialog" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()} className="w-[560px] max-w-full bg-sheet border border-line rounded-2xl shadow-2xl overflow-hidden">
        <input
          ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
          placeholder="Type a command or a skill name"
          aria-label="Command"
          className="w-full px-5 py-4 text-[15px] bg-transparent outline-none border-b border-line"
        />
        <ul className="max-h-[340px] overflow-y-auto p-1.5" role="listbox">
          {shown.map((c, idx) => (
            <li key={`${c.group}-${c.label}`} role="option" aria-selected={idx === i}>
              <button
                onMouseEnter={() => setI(idx)} onClick={() => run(c)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left ${idx === i ? 'bg-accent-soft text-accent' : ''}`}
              >
                <span className="text-[11px] uppercase tracking-wide text-muted w-24 shrink-0">{c.group}</span>
                <span className="flex-1 truncate">{c.label}</span>
                {c.hint && <span className="text-xs text-muted">{c.hint}</span>}
              </button>
            </li>
          ))}
          {!shown.length && <li className="px-4 py-6 text-sm text-muted text-center">Nothing matches “{q}”.</li>}
        </ul>
        <div className="px-4 py-2 text-[11px] text-muted border-t border-line flex gap-4">
          <span>↑↓ move</span><span>Enter run</span><span>Esc close</span>
        </div>
      </div>
    </div>
  )
}
