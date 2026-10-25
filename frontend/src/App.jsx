import { useEffect } from 'react'
import { set, useStudio } from './store'
import { initApp } from './flow'
import ChatThread from './components/ChatThread'
import Composer from './components/Composer'
import Workspace from './components/Workspace'
import Sidebar from './components/Sidebar'
import SkillsLibrary from './components/SkillsLibrary'
import DraftsPage from './components/DraftsPage'
import CommandPalette from './components/CommandPalette'
import RedlineModal from './components/RedlineModal'
import ConfirmModal from './components/ConfirmModal'
import FinalizeDialog from './components/FinalizeDialog'
import Toasts from './components/Toasts'

export default function App() {
  const view = useStudio((s) => s.view)
  const page = useStudio((s) => s.page)
  const inMode = view !== 'home'

  useEffect(() => { initApp() }, [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        set((s) => ({ palette: !s.palette }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="h-full flex bg-field text-ink">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 flex min-h-0">
          {page === 'skills' ? (
            <SkillsLibrary />
          ) : page === 'drafts' ? (
            <DraftsPage />
          ) : (
            <>
              <section
                className={`flex flex-col min-h-0 transition-[width] duration-500 ease-out ${
                  inMode ? 'w-[400px] shrink-0 border-r border-line bg-sheet' : 'w-full max-w-3xl mx-auto'
                }`}
              >
                <ChatThread />
                <Composer />
              </section>

              {inMode && (
                <section className="open-workspace flex-1 min-w-0 flex flex-col min-h-0">
                  <Workspace />
                </section>
              )}
            </>
          )}
        </div>

        <footer className="text-[11px] text-center py-1.5 text-muted border-t border-line bg-sheet">
          AI-generated draft. A qualified professional must review it before use.
        </footer>
      </div>

      {view === 'finalizing' && <FinalizeDialog />}
      <RedlineModal />
      <CommandPalette />
      <ConfirmModal />
      <Toasts />
    </div>
  )
}
