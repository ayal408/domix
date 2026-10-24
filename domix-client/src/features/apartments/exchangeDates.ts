import { HDate } from '@hebcal/core'
export function todayIso(): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find(p => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function validExchangeDates(start: string, end: string, today = todayIso()): boolean {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  return valid(start) && valid(end) && start >= today && end > start
}

export function formatExchangeDate(value: string | null | undefined, language: string): string {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return language.startsWith('he') ? new HDate(date).renderGematriya() : value
}
