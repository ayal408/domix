/**
 * Locale-aware formatting built on `Intl`, so Hebrew, Spanish and French all
 * get correct separators, currency placement and calendar text with no
 * per-language formatting code.
 */

/** Listing prices are stored as whole ILS on the server (`Apartment.price` is an int). */
export const DEFAULT_CURRENCY = 'ILS'

/** Maps our i18n language codes onto BCP-47 locales for `Intl`. */
const LOCALE_BY_LANGUAGE: Record<string, string> = {
  en: 'en-US',
  he: 'he-IL',
  es: 'es-ES',
  fr: 'fr-FR',
}

export function toIntlLocale(language: string): string {
  const base = language.split('-')[0] ?? 'en'
  return LOCALE_BY_LANGUAGE[base] ?? language
}

export function formatCurrency(
  value: number | null | undefined,
  language: string,
  currency: string = DEFAULT_CURRENCY,
): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(toIntlLocale(language), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

/** Compact currency for tight spaces (chart axis labels), e.g. "$1.2M". */
export function formatCompactCurrency(
  value: number | null | undefined,
  language: string,
  currency: string = DEFAULT_CURRENCY,
): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(toIntlLocale(language), {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatNumber(
  value: number | null | undefined,
  language: string,
  options?: Intl.NumberFormatOptions,
): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(toIntlLocale(language), options).format(value)
}

/**
 * Parses a server timestamp.
 *
 * The .NET API serialises `DateTime` values that were produced with
 * `DateTime.UtcNow` but are stored without a kind marker, so some payloads
 * arrive with no timezone suffix. Those are treated as UTC rather than local
 * time, which is what the server actually meant.
 */
export function parseServerDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
  const date = new Date(hasZone ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(
  value: string | null | undefined,
  language: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const date = parseServerDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat(toIntlLocale(language), options).format(date)
}

export function formatDateTime(value: string | null | undefined, language: string): string {
  return formatDate(value, language, { dateStyle: 'medium', timeStyle: 'short' })
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 1000 * 60 * 60 * 24 * 365],
  ['month', 1000 * 60 * 60 * 24 * 30],
  ['week', 1000 * 60 * 60 * 24 * 7],
  ['day', 1000 * 60 * 60 * 24],
  ['hour', 1000 * 60 * 60],
  ['minute', 1000 * 60],
  ['second', 1000],
]

/** "3 hours ago" / "לפני 3 שעות", picking the largest sensible unit. */
export function formatRelativeTime(value: string | null | undefined, language: string): string {
  const date = parseServerDate(value)
  if (!date) return '—'

  const formatter = new Intl.RelativeTimeFormat(toIntlLocale(language), { numeric: 'auto' })
  const elapsed = date.getTime() - Date.now()
  const magnitude = Math.abs(elapsed)

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (magnitude >= ms || unit === 'second') {
      return formatter.format(Math.round(elapsed / ms), unit)
    }
  }
  return formatter.format(0, 'second')
}

/** Compact square-metre label, e.g. "82 m²". */
export function formatArea(value: number | null | undefined, language: string): string {
  if (typeof value !== 'number') return '—'
  return `${formatNumber(value, language)} m²`
}

/** Human-readable byte size for upload validation messages. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Builds a `wa.me` deep link from a phone number on file. Every number in this app is Israeli
 * (972), stored in local format (leading 0) — normalises that to the international form WhatsApp
 * requires. Returns null for anything too short to plausibly be a real number, e.g. a placeholder.
 */
export function toWhatsAppLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null

  const international = digits.startsWith('972') ? digits : digits.startsWith('0') ? `972${digits.slice(1)}` : digits

  if (international.length < 10) return null

  const query = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${international}${query}`
}
