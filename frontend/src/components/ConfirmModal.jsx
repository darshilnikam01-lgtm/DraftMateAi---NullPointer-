import { useEffect, useRef } from 'react'
import { set, useStudio } from '../store'

// Used before consequential actions (overwrite, delete, leave). Enter does NOT confirm on purpose.
export default function ConfirmModal() {
  const confirm = useStudio((s) => s.confirm)
  const cancelRef = useRef(null)
  useEffect(() => {
    if (!confirm) return
    cancelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') set({ confirm: null }) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm])
  if (!confirm) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="alertdialog" aria-modal="true" aria-labelledby="cm-title">
      <div className="bg-sheet rounded-2xl p-6 w-[420px] max-w-[92vw] shadow-xl">
        <h2 id="cm-title" className="font-serif text-xl font-semibold">{confirm.title}</h2>
        <p className="text-sm text-muted mt-2">{confirm.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} onClick={() => set({ confirm: null })} className="px-4 py-2 text-sm border border-line rounded-lg hover:bg-field">Cancel</button>
          <button onClick={confirm.onConfirm} className="px-4 py-2 text-sm bg-bad text-sheet rounded-lg">{confirm.confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
