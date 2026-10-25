// All backend calls live here. Vite proxies /api to FastAPI (see vite.config.js).
async function json(path, options) {
  const res = await fetch(path, options)
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail || detail } catch { /* ignore */ }
    throw new Error(detail)
  }
  return res.json()
}
const post = (path, body) =>
  json(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  skills: () => json('/api/skills'),
  models: () => json('/api/models'),
  route: (body) => post('/api/route', body),
  modeTurn: (body) => post('/api/mode/turn', body),
  verify: (body) => post('/api/verify', body),
  finalizeCheck: (body) => post('/api/finalize-check', body),
  drafts: () => json('/api/drafts'),
  getDraft: (id) => json(`/api/drafts/${id}`),
  saveDraft: (id, body) => json(`/api/drafts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  renameDraft: (id, title) => post(`/api/drafts/${id}/rename`, { title }),
  deleteDraft: (id) => json(`/api/drafts/${id}`, { method: 'DELETE' }),
  setRole: (id, role) => post(`/api/files/${id}/role`, { role }),
  getFile: (id) => json(`/api/files/${id}`),
  deleteFile: (id) => fetch(`/api/files/${id}`, { method: 'DELETE' }),
  upload: (file, role) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('role', role)
    return json('/api/upload', { method: 'POST', body: fd })
  },
  async exportDocx(html, filename) {
    const res = await fetch('/api/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html, filename }),
    })
    if (!res.ok) throw new Error('Export failed')
    return res.blob()
  },
}

export const ERROR_MARKER = '[[DRAFTMATE_ERROR]]'

// Streams the draft as it is written. onHeaders receives the token statistics.
export async function* streamGenerate(body, signal, onHeaders) {
  const res = await fetch('/api/generate', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail || detail } catch { /* ignore */ }
    throw new Error(detail)
  }
  onHeaders?.({
    prompt: Number(res.headers.get('X-Prompt-Tokens')) || 0,
    naive: Number(res.headers.get('X-Naive-Tokens')) || 0,
  })
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    yield decoder.decode(value, { stream: true })
  }
}
