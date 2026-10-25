import { useEffect, useMemo, useState } from 'react'

const BODY = [
  '..........#########.',
  '.........###########',
  '.........##.########',
  '.........###########',
  '.........###########',
  '.........#####......',
  '.........#####......',
  '.........##########.',
  '#.......#####.......',
  '#......######.......',
  '##....#######.#.....',
  '###..##########.....',
  '###############.....',
  '.##############.....',
  '..#############.....',
  '...###########......',
  '....#########.......',
  '.....#######........',
]
const LEGS_A = ['.....###..##........', '.....##...##........', '.....#....###.......', '.....###..#.........']
const LEGS_B = ['.....##..###........', '.....##..##.........', '.....###.#..........', '......##.###........']
const CACTUS = ['..#..', '#.#.#', '#.#.#', '#####', '..#..', '..#..', '..#..', '..#..']

const rects = (grid, key) =>
  grid.flatMap((row, y) => [...row].map((c, x) => (c === '#' ? <rect key={`${key}${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))

function Dino() {
  const body = useMemo(() => rects(BODY, 'b'), [])
  const a = useMemo(() => rects(LEGS_A, 'a'), [])
  const b = useMemo(() => rects(LEGS_B, 'c'), [])
  const cactus = useMemo(() => rects(CACTUS, 'k'), [])
  return (
    <svg viewBox="0 0 90 26" width="180" height="52" role="img" aria-label="Running dinosaur while you wait" shapeRendering="crispEdges" fill="currentColor">
      <g className="dino-jump" transform="translate(6 0)">
        <g>{body}</g>
        <g className="dino-legs-a" transform="translate(0 18)">{a}</g>
        <g className="dino-legs-b" transform="translate(0 18)">{b}</g>
      </g>
      <g className="dino-cactus"><g transform="translate(0 14)">{cactus}</g></g>
      <rect x="0" y="22.5" width="90" height="0.5" opacity="0.5" />
      <g className="dino-ground" opacity="0.4">
        {[4, 18, 32, 46, 60, 74, 88, 102].map((x) => <rect key={x} x={x} y="24.2" width="3" height="0.5" />)}
      </g>
    </svg>
  )
}

export function useElapsed(running) {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    if (!running) return
    const t0 = performance.now()
    setMs(0)
    const id = setInterval(() => setMs(performance.now() - t0), 100)
    return () => clearInterval(id)
  }, [running])
  return ms
}

export const fmt = (ms) => {
  const s = ms / 1000
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, '0')}s`
}

export default function DinoLoader({ label, speed }) {
  const ms = useElapsed(true)
  return (
    <div className="flex flex-col items-center gap-1 py-4 text-muted select-none" role="status" aria-live="off">
      <Dino />
      <div className="font-mono text-2xl text-ink tabular-nums">{fmt(ms)}</div>
      <div className="text-xs">
        {label}
        <span className="mx-1.5">·</span>
        {speed === 'lite' ? '⚡ Lite' : '🧠 Pro'}
        {speed === 'pro' && ms > 20000 && <span className="ml-1.5">Pro thinks longer. Hang on.</span>}
      </div>
    </div>
  )
}
