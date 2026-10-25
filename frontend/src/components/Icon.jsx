const P = {
  drafter: 'M4 20h4L19 9l-4-4L4 16v4z M13 7l4 4',
  skills: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14z M20 20l-4-4',
  moon: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',
  chevron: 'M15 6l-6 6 6 6',
  clip: 'M20 11l-8 8a5 5 0 01-7-7l8-8a3.5 3.5 0 015 5l-8 8a2 2 0 01-3-3l7-7',
  mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z M5 11a7 7 0 0014 0 M12 18v3',
  send: 'M5 12l14-7-5 14-2-6-7-1z',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
  brain: 'M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 0V7a3 3 0 00-3-3z M15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 0',
  dot: 'M12 10a2 2 0 100 4 2 2 0 000-4z',
  diff: 'M7 4v12 M3 12l4 4 4-4 M17 20V8 M13 12l4-4 4 4',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z M8 7h7',
  chat: 'M4 5h16v11H9l-5 4V5z M8 10h8',
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 8a4 4 0 100 8 4 4 0 000-8z M12 11.5v1',
  swap: 'M7 7h12 M16 4l3 3-3 3 M17 17H5 M8 14l-3 3 3 3',
  cap: 'M2 9l10-5 10 5-10 5L2 9z M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5',
  mail: 'M3 6h18v12H3z M3 7l9 6 9-6',
  file: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6',
  check: 'M5 12l4 4 10-10 M4 20h16',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  folder: 'M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6z',
  grid: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  scale: 'M12 4v16 M6 20h12 M5 7h14 M5 7l-3 7a3 3 0 006 0L5 7z M19 7l-3 7a3 3 0 006 0l-3-7z',
}
export default function Icon({ name, size = 16, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {P[name].split(' M').map((d, i) => <path key={i} d={i ? `M${d}` : d} />)}
    </svg>
  )
}
