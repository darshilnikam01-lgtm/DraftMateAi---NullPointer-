export const TASK_ICON = {
  'legal-notice': 'mail',
  'agreement-drafting': 'file',
  'contract-review': 'check',
  'legal-research': 'search',
  'general-drafting': 'drafter',
  'know-your-kanoon': 'book',
  'upload-and-chat': 'chat',
  'case-predict': 'target',
  'counter-arguments': 'swap',
  'legal-sandbox': 'cap',
}
export const iconFor = (id) => TASK_ICON[id] || 'drafter'
export const DOCK_ORDER = ['legal-notice', 'agreement-drafting', 'know-your-kanoon', 'case-predict', 'counter-arguments', 'upload-and-chat']

export const LANGS = [
  { code: 'en', label: 'English', native: 'English', locale: 'en-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', locale: 'hi-IN' },
  { code: 'hing', label: 'Hinglish', native: 'Hinglish', locale: 'en-IN' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', locale: 'mr-IN' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', locale: 'bn-IN' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', locale: 'ta-IN' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', locale: 'te-IN' },
]
export const localeOf = (code) => (LANGS.find((l) => l.code === code) || LANGS[0]).locale
