import { create } from 'zustand'

// view: home (chat only) -> mode (chat + workspace) -> finalizing (dialog over workspace) -> home
export const useStudio = create(() => ({
  skills: [],
  models: [],
  model: null,
  speed: 'lite',
  files: [],            // {id, name, role, status, tokens}
  messages: [],         // {id, role: user|assistant|status|result, text, source, ...}
  drafts: [],
  draftId: null,
  saveState: 'idle',
  page: 'drafter',
  theme: 'light',
  lang: 'en',
  langChosen: false,
  palette: false,
  redline: null,
  activeCite: null,
  view: 'home',
  mode: null,           // {skill: {id,name,category}, config: {...skill.mode}}
  params: {},
  goal: '',             // the user's original request, reused when drafting starts
  draft: '',
  versions: [],         // {id, label, content, time}
  citations: [],
  verifying: false,
  generating: false,
  busy: false,
  stats: null,          // {prompt, naive}
  confirm: null,        // {title, message, confirmLabel, onConfirm}
  toasts: [],
}))

export const set = (patch) => useStudio.setState(patch)
export const get = () => useStudio.getState()

let counter = 0
export const nextId = () => `${Date.now()}-${counter++}`

export function addMessage(m) {
  useStudio.setState((s) => ({ messages: [...s.messages, { id: nextId(), ...m }] }))
}

export function toast(text, kind = 'info') {
  const id = nextId()
  useStudio.setState((s) => ({ toasts: [...s.toasts, { id, text, kind }] }))
  setTimeout(() => useStudio.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500)
}
