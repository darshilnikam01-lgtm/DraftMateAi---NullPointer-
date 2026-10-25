import { useStudio } from '../store'

export default function Toasts() {
  const toasts = useStudio((s) => s.toasts)
  return (
    <div className="fixed bottom-12 right-4 space-y-2 z-50" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`px-4 py-2 rounded-lg text-sm shadow-lg ${t.kind === 'error' ? 'bg-bad text-sheet' : 'bg-ink text-sheet'}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
