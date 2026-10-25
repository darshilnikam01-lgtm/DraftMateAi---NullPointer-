export const toPlain = (html) =>
  (html || '')
    .replace(/<\/(p|h[1-6]|li|tr)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]*\n[ \t\n]*/g, '\n')

const tokenize = (t) => t.match(/\n|[^\s]+/g) || []

export function diffWords(a, b) {
  const A = tokenize(a)
  const B = tokenize(b)
  let s = 0
  while (s < A.length && s < B.length && A[s] === B[s]) s++
  let ea = A.length
  let eb = B.length
  while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb-- }

  const x = A.slice(s, ea)
  const y = B.slice(s, eb)
  const n = x.length
  const m = y.length
  let mid = []
  if (n * m > 16e6) {
    mid = [...x.map((w) => ({ t: 'del', w })), ...y.map((w) => ({ t: 'ins', w }))]
  } else {
    const W = m + 1
    const dp = new Uint16Array((n + 1) * W)
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * W + j] = x[i] === y[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (x[i] === y[j]) { mid.push({ t: 'eq', w: x[i] }); i++; j++ }
      else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) mid.push({ t: 'del', w: x[i++] })
      else mid.push({ t: 'ins', w: y[j++] })
    }
    while (i < n) mid.push({ t: 'del', w: x[i++] })
    while (j < m) mid.push({ t: 'ins', w: y[j++] })
  }
  return [
    ...A.slice(0, s).map((w) => ({ t: 'eq', w })),
    ...mid,
    ...A.slice(ea).map((w) => ({ t: 'eq', w })),
  ]
}
