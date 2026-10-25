import { useState } from 'react'
import { set, useStudio } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { goPage, toggleTheme } from '../flow'
import Icon from './Icon'

const COMING = ['Research', 'Matters', 'Documents', 'Templates', 'Compliance']

export default function Sidebar() {
  const { page, theme } = useStudio(useShallow((s) => ({ page: s.page, theme: s.theme })))
  const [slim, setSlim] = useState(false)

  const item = (id, icon, label) => (
    <button
      key={id}
      onClick={() => goPage(id)}
      aria-current={page === id ? 'page' : undefined}
      title={slim ? label : undefined}
      className={`group flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-sm transition-colors ${
        page === id ? 'bg-accent-soft text-accent font-medium' : 'text-muted hover:bg-field hover:text-ink'
      }`}
    >
      <Icon name={icon} />
      {!slim && <span className="truncate">{label}</span>}
    </button>
  )

  return (
    <nav
      aria-label="Main"
      className={`hidden md:flex flex-col shrink-0 border-r border-line bg-sheet py-4 px-2.5 transition-[width] duration-300 ${slim ? 'w-[60px]' : 'w-[208px]'}`}
    >
      <div className="flex items-center gap-2 px-1.5 pb-5">
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-accent text-sheet shrink-0"><Icon name="scale" size={17} /></span>
        {!slim && (
          <div className="leading-tight min-w-0">
            <div className="font-serif text-[17px] font-semibold">DraftMate</div>
            <div className="text-[11px] text-muted truncate">Your AI assistant in law</div>
          </div>
        )}
      </div>

      <div className="space-y-0.5">
        {item('drafter', 'drafter', 'Drafter')}
        {item('drafts', 'folder', 'Drafts')}
        {item('skills', 'skills', 'Skills library')}
      </div>

      {!slim && (
        <div className="mt-6">
          <div className="px-2.5 pb-1 text-[11px] uppercase tracking-wider text-muted/80">Coming soon</div>
          {COMING.map((c) => (
            <div key={c} className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-muted/50 cursor-default select-none">
              <Icon name="dot" /> {c}
            </div>
          ))}
        </div>
      )}

      <span className="flex-1" />

      <div className="space-y-0.5">
        <button
          onClick={() => set({ palette: true })}
          title="Command palette"
          className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-field hover:text-ink"
        >
          <Icon name="search" />
          {!slim && (<><span className="flex-1 text-left">Search & commands</span><kbd className="text-[10px] border border-line rounded px-1.5 py-0.5">Ctrl K</kbd></>)}
        </button>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-field hover:text-ink"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          {!slim && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>
        <button
          onClick={() => setSlim((v) => !v)}
          aria-label={slim ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-field hover:text-ink"
        >
          <Icon name="chevron" className={`transition-transform ${slim ? 'rotate-180' : ''}`} />
          {!slim && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  )
}
