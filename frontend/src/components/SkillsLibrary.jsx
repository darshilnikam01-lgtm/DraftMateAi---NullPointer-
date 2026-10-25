import { useMemo, useState } from 'react'
import { useStudio } from '../store'
import { openSkill } from '../flow'
import { iconFor } from '../taskIcons'
import Icon from './Icon'

export default function SkillsLibrary() {
  const skills = useStudio((s) => s.skills)
  const activeId = useStudio((s) => s.mode?.skill.id)
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const by = {}
    skills
      .filter((s) => !needle || `${s.name} ${s.description} ${s.category}`.toLowerCase().includes(needle))
      .forEach((s) => { (by[s.category || 'General'] ||= []).push(s) })
    return Object.entries(by)
  }, [skills, q])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Skills library</h1>
        <p className="text-muted mt-1 text-sm">Each skill is a focused workspace with its own settings, prompts and checks.</p>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skills"
          aria-label="Search skills"
          className="mt-6 w-full max-w-sm text-sm bg-sheet border border-line rounded-lg px-3 py-2 outline-none focus:border-accent"
        />

        {groups.map(([cat, list]) => (
          <section key={cat} className="mt-8">
            <h2 className="text-[11px] uppercase tracking-wider text-muted mb-3">{cat}</h2>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
              {list.map((s) => (
                <button
                  key={s.id} onClick={() => openSkill(s.id)}
                  className="text-left bg-sheet border border-line rounded-xl p-4 hover:border-accent/60 hover:-translate-y-px transition"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid place-items-center w-8 h-8 rounded-lg bg-accent-soft text-accent shrink-0"><Icon name={iconFor(s.id)} size={16} /></span>
                    <span className="font-medium text-[15px]">{s.name}</span>
                    {s.id === activeId && <span className="text-[10px] bg-accent-soft text-accent rounded px-1.5 py-0.5">Open</span>}
                  </div>
                  <p className="text-xs text-muted mt-1.5 line-clamp-3">{s.description}</p>
                </button>
              ))}
            </div>
          </section>
        ))}
        {!groups.length && <p className="mt-10 text-sm text-muted">No skill matches “{q}”.</p>}
      </div>
    </div>
  )
}
