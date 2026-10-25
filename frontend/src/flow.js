// The orchestration layer: everything the chat does when the user types OR speaks.
import { api, streamGenerate, ERROR_MARKER } from './api'
import { addMessage, get, nextId, set, toast, useStudio } from './store'

let abortCtrl = null

export function cleanHtml(s) {
  return s.replace(/```html/gi, '').replace(/```/g, '')
}
export const textOf = (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// ------------------------------------------------------------------ setup
export async function initApp() {
  applyTheme(initialTheme())
  loadDrafts()
  startAutosave()
  try {
    const l = localStorage.getItem('dm-lang')
    if (l) set({ lang: l, langChosen: true })
  } catch {}
  try {
    const [skills, models] = await Promise.all([api.skills(), api.models()])
    set({ skills, models, model: models[0]?.id || null })
  } catch (e) {
    toast('Cannot reach the backend. Is it running on port 8000?', 'error')
  }
}

const THEME_KEY = 'dm-theme'
function initialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
export function applyTheme(t) {
  document.documentElement.dataset.theme = t
  try { localStorage.setItem(THEME_KEY, t) } catch {}
  set({ theme: t })
}
export const toggleTheme = () => applyTheme(get().theme === 'dark' ? 'light' : 'dark')
export function setLang(code) {
  set({ lang: code, langChosen: true })
  try { localStorage.setItem('dm-lang', code) } catch {}
}
export const goPage = (page) => set({ page })
export const setSpeed = (speed) => { if (!get().busy && !get().generating) set({ speed }) }

export function openRedline(id) {
  const v = get().versions.find((x) => x.id === id)
  if (!v) return
  set({ redline: { label: v.label, time: v.time, before: v.content, after: get().draft } })
}

// ------------------------------------------------------------------ versions
export function saveVersion(label) {
  const { draft } = get()
  if (!textOf(draft)) return
  set((s) => ({ versions: [{ id: nextId(), label, content: draft, time: new Date() }, ...s.versions].slice(0, 30) }))
}
export function restoreVersion(id) {
  const v = get().versions.find((x) => x.id === id)
  if (!v) return
  saveVersion('Before restoring an older version')
  set({ draft: v.content })
  toast('Version restored')
}

// ------------------------------------------------------------------ the single entry point
export async function handleUserInput(text, source = 'typed') {
  text = text.trim()
  const s = get()
  if (!text) return
  if (s.busy || s.generating) return toast('Please wait for the current action to finish, or press Stop.')
  addMessage({ role: 'user', text, source })
  set({ busy: true })
  try {
    if (s.view === 'home') await routeFromHome(text)
    else await turnInsideMode(text)
  } catch (e) {
    addMessage({ role: 'assistant', text: `Something went wrong: ${e.message}`, error: true })
  } finally {
    set({ busy: false })
  }
}

// Home: the backend decides whether this is a chat question or a drafting task.
async function routeFromHome(text, forceSkillId = null) {
  const s = get()
  const r = await api.route({
    instruction: text, has_draft: false, file_ids: s.files.map((f) => f.id), force_skill_id: forceSkillId, model: s.model, lang: s.lang,
  })
  if (r.kind === 'chat') return addMessage({ role: 'assistant', text: r.reply })
  openMode(r, text)
}

function openMode(r, goal) {
  set({
    view: 'mode', mode: { skill: r.skill, config: r.mode_config }, params: r.params || {}, goal: goal || '',
    draft: '', versions: [], citations: [], stats: null, draftId: null, saveState: 'idle',
  })
  const need = [...r.missing_fields.map((f) => f.label), ...(r.missing_file ? ['an uploaded document'] : [])]
  let text = r.summary
  if (need.length) text += ` I still need: ${need.join(', ')}. Type or say them, or fill them in on the right.`
  addMessage({ role: 'assistant', text, kind: 'mode-open' })
  if (!need.length && goal) runGenerate(goal)
}

// Open a skill from the skills menu (no sentence needed).
export async function openSkill(skillId) {
  const s = get()
  if (s.busy) return
  set({ page: 'drafter' })
  set({ busy: true })
  try {
    if (s.view === 'home') {
      addMessage({ role: 'status', text: 'Opening skill from the menu' })
      await routeFromHome('', skillId)
    } else {
      // switching skill inside a workspace keeps the current draft
      const r = await api.route({ instruction: '', has_draft: true, file_ids: s.files.map((f) => f.id), force_skill_id: skillId })
      set({ mode: { skill: r.skill, config: r.mode_config } })
      addMessage({ role: 'status', text: `Switched to ${r.skill.name}. Your draft is kept.` })
    }
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    set({ busy: false })
  }
}

// Inside a mode: the backend returns a structured action; we execute it (confirming first if destructive).
async function turnInsideMode(text) {
  const s = get()
  const t = await api.modeTurn({
    message: text, skill_id: s.mode.skill.id, params: s.params, draft: s.draft, goal: s.goal,
    file_ids: s.files.map((f) => f.id), model: s.model, lang: s.lang,
  })
  addMessage({ role: 'status', text: `Understood: ${t.action.replace('_', ' ')}` })

  const run = async () => {
    if (t.params && Object.keys(t.params).length) set((st) => ({ params: { ...st.params, ...t.params } }))
    if (t.reply) addMessage({ role: 'assistant', text: t.reply })
    if (t.action === 'generate' || t.action === 'edit_draft') await runGenerate(t.instruction, t.action === 'edit_draft')
    else if (t.action === 'verify') await runVerification()
    else if (t.action === 'finalize') requestFinalize()
    else if (t.action === 'exit') exitMode()
  }

  if (t.destructive && (t.action === 'generate' || t.action === 'edit_draft')) {
    set({
      confirm: {
        title: 'Change the draft?',
        message: `${t.reply || t.instruction} A copy of the current draft is saved to Version history first.`,
        confirmLabel: 'Yes, go ahead',
        onConfirm: () => { set({ confirm: null }); run() },
      },
    })
    return
  }
  await run()
}

// ------------------------------------------------------------------ generation
export async function runGenerate(instruction) {
  const s = get()
  saveVersion(`Before: ${instruction.slice(0, 40)}`)
  const previous = s.draft
  const hadDraft = !!textOf(previous)
  abortCtrl = new AbortController()
  const t0 = performance.now()
  set({ generating: true, citations: [] })
  let acc = ''
  try {
    for await (const chunk of streamGenerate(
      {
        instruction, skill_id: s.mode.skill.id, params: s.params, file_ids: s.files.map((f) => f.id),
        current_draft: hadDraft ? previous : '', model: s.model, speed: s.speed, lang: s.lang,
      },
      abortCtrl.signal,
      (stats) => set({ stats }),
    )) {
      acc += chunk
      if (acc.includes(ERROR_MARKER)) break
      set({ draft: cleanHtml(acc) })
    }
    if (acc.includes(ERROR_MARKER)) {
      const msg = acc.split(ERROR_MARKER)[1]?.trim() || 'Unknown error'
      set({ draft: previous })
      addMessage({ role: 'assistant', text: `Drafting failed: ${msg}`, error: true })
      return
    }
    saveVersion(instruction.slice(0, 40))
    addMessage({ role: 'status', text: `Draft written in ${((performance.now() - t0) / 1000).toFixed(1)}s (${s.speed === 'lite' ? 'Lite' : 'Pro'})` })
    addMessage({ role: 'assistant', text: 'Draft ready. Checking the citations now.' })
    await runVerification()
  } catch (e) {
    if (e.name === 'AbortError') {
      addMessage({ role: 'status', text: 'Stopped. Draft kept as it was written so far.' })
    } else {
      set({ draft: previous })
      addMessage({ role: 'assistant', text: `Drafting failed: ${e.message}`, error: true })
    }
  } finally {
    set({ generating: false })
    abortCtrl = null
  }
}

export function stopGeneration() {
  abortCtrl?.abort()
}

export async function runVerification() {
  const { draft, model } = get()
  if (!textOf(draft)) return toast('Nothing to verify yet.')
  set({ verifying: true })
  try {
    const r = await api.verify({ html: draft, model })
    set({ citations: r.citations })
    const c = r.counts
    addMessage({
      role: 'status',
      text: r.citations.length
        ? `Citations: ${c.verified} verified, ${c.partial} partly verified, ${c.unverified} unverified`
        : 'No citations found in this draft.',
    })
  } catch (e) {
    toast(`Verification failed: ${e.message}`, 'error')
  } finally {
    set({ verifying: false })
  }
}

// ------------------------------------------------------------------ finishing
export function requestFinalize() {
  if (!textOf(get().draft)) return toast('Write a draft before finishing.')
  set({ view: 'finalizing' })
}
export function cancelFinalize() {
  set({ view: 'mode' })
}

export async function exportDocx() {
  const { draft, mode } = get()
  try {
    const blob = await api.exportDocx(draft, (mode?.skill.name || 'draft').replace(/\s+/g, '_'))
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(mode?.skill.name || 'draft').replace(/\s+/g, '_')}.docx`
    a.click()
    URL.revokeObjectURL(url)
    toast('Word file downloaded')
    return true
  } catch (e) {
    toast(e.message, 'error')
    return false
  }
}

export function exportPdf() {
  const { draft } = get()
  const w = window.open('', '_blank')
  if (!w) return toast('Allow pop-ups to export as PDF.', 'error')
  w.document.write(
    `<html><head><title>Draft</title><style>body{font-family:Georgia,serif;font-size:13pt;line-height:1.6;max-width:720px;margin:40px auto}
    table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px;vertical-align:top}</style></head><body>${draft}
    <p style="font-size:9pt;color:#555"><i>AI-assisted draft. Review and verify all content and citations before use.</i></p></body></html>`,
  )
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
  return true
}

// Leave the workspace and drop a result card into the chat.
export function finishAndReturn(exported) {
  const s = get()
  const unresolved = s.citations.filter((c) => c.status !== 'verified').length
  addMessage({
    role: 'result',
    title: s.mode.skill.name,
    snapshot: { draft: s.draft, params: s.params, mode: s.mode, goal: s.goal, citations: s.citations, draftId: s.draftId },
    exported,
    warnings: unresolved,
    versions: s.versions.length,
  })
  set({ view: 'home', mode: null, params: {}, goal: '', draft: '', versions: [], citations: [], stats: null })
}

export async function exitMode() {
  await saveNow()
  set({ view: 'home', mode: null, params: {}, goal: '', draft: '', versions: [], citations: [], stats: null, draftId: null, saveState: 'idle' })
  addMessage({ role: 'status', text: 'Left the workspace. Your draft is saved in Drafts.' })
}

export function reopenResult(snapshot) {
  const s = get()
  if (s.view !== 'home') return toast('Finish or leave the current workspace first.')
  set({
    view: 'mode', mode: snapshot.mode, params: snapshot.params, goal: snapshot.goal, draft: snapshot.draft,
    citations: snapshot.citations, versions: [], draftId: snapshot.draftId || null,
  })
  addMessage({ role: 'status', text: `Reopened ${snapshot.mode.skill.name}.` })
}

// ------------------------------------------------------------------ saved drafts
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
let saveTimer = null

function titleFor(s) {
  const block = s.draft.match(/<(h[1-3]|p)[^>]*>([\s\S]*?)<\/\1>/i)
  const first = textOf(block ? block[2] : s.draft)
  const t = first.length > 70 ? `${first.slice(0, 67)}...` : first
  return t || s.mode.skill.name
}

export async function loadDrafts() {
  try { set({ drafts: await api.drafts() }) } catch {}
}

export async function saveNow() {
  clearTimeout(saveTimer)
  const s = get()
  if (!s.mode || s.view === 'home' || s.generating || !textOf(s.draft)) return
  const id = s.draftId || newId()
  set({ draftId: id, saveState: 'saving' })
  try {
    await api.saveDraft(id, {
      title: titleFor(s), custom: false, skill_id: s.mode.skill.id, skill_name: s.mode.skill.name,
      params: s.params, goal: s.goal, content: s.draft,
      versions: s.versions.map((v) => ({ ...v, time: v.time.toISOString() })),
    })
    set({ saveState: 'saved' })
    loadDrafts()
  } catch {
    set({ saveState: 'error' })
  }
}

export function startAutosave() {
  useStudio.subscribe((s, prev) => {
    if (s.draft === prev.draft && s.params === prev.params && s.versions === prev.versions && s.generating === prev.generating) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, 1500)
  })
}

export async function openDraft(id) {
  const s = get()
  if (s.busy || s.generating) return toast('Please wait for the current action to finish, or press Stop.')
  set({ busy: true })
  try {
    if (s.view !== 'home') await saveNow()
    const d = await api.getDraft(id)
    const r = await api.route({ instruction: '', has_draft: true, file_ids: [], force_skill_id: d.skill_id })
    set({
      page: 'drafter', view: 'mode', mode: { skill: r.skill, config: r.mode_config }, params: d.params || {}, goal: d.goal || '',
      draft: d.content, citations: [], stats: null, files: [], draftId: d.id, saveState: 'saved',
      versions: (d.versions || []).map((v) => ({ ...v, time: new Date(v.time) })),
    })
    addMessage({ role: 'status', text: `Reopened "${d.title}". Uploaded files are not kept, so add them again if you need them.` })
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    set({ busy: false })
  }
}

export async function renameDraft(id, title) {
  try {
    await api.renameDraft(id, title)
    await loadDrafts()
  } catch (e) {
    toast(e.message, 'error')
  }
}

export function removeDraft(id) {
  const d = get().drafts.find((x) => x.id === id)
  set({
    confirm: {
      title: 'Delete this draft?',
      message: `"${d ? d.title : 'This draft'}" and its version history will be deleted for good.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        set({ confirm: null })
        try {
          await api.deleteDraft(id)
          if (get().draftId === id) set({ draftId: null, saveState: 'idle' })
          await loadDrafts()
        } catch (e) {
          toast(e.message, 'error')
        }
      },
    },
  })
}

// ------------------------------------------------------------------ files
export async function uploadFile(file, role) {
  const tempId = `tmp-${nextId()}`
  set((s) => ({ files: [...s.files, { id: tempId, name: file.name, role, status: 'converting' }] }))
  try {
    const r = await api.upload(file, role)
    set((s) => ({ files: s.files.map((f) => (f.id === tempId ? { ...r } : f)) }))
    addMessage({ role: 'status', text: `${file.name} converted to Markdown (${r.tokens.toLocaleString()} tokens), used as ${role}` })
  } catch (e) {
    set((s) => ({ files: s.files.filter((f) => f.id !== tempId) }))
    toast(`${file.name}: ${e.message}`, 'error')
  }
}
export async function changeFileRole(id, role) {
  set((s) => ({ files: s.files.map((f) => (f.id === id ? { ...f, role } : f)) }))
  try { await api.setRole(id, role) } catch (e) { toast(e.message, 'error') }
}
export async function removeFile(id) {
  set((s) => ({ files: s.files.filter((f) => f.id !== id) }))
  try { await api.deleteFile(id) } catch { /* ignore */ }
}
