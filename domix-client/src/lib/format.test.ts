import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  parseServerDate,
  toIntlLocale,
} from '@/lib/format'

describe('toIntlLocale', () => {
  it('maps supported language codes to BCP-47 locales', () => {
    expect(toIntlLocale('en')).toBe('en-US')
    expect(toIntlLocale('he')).toBe('he-IL')
  })

  it('falls back to the raw value for an unknown language', () => {
    expect(toIntlLocale('xx')).toBe('xx')
  })
})

describe('formatCurrency', () => {
  it('formats a whole-number ILS amount with no decimals', () => {
    expect(formatCurrency(4500, 'en')).toContain('4,500')
  })

  it('returns an em dash for null/undefined/NaN', () => {
    expect(formatCurrency(null, 'en')).toBe('—')
    expect(formatCurrency(undefined, 'en')).toBe('—')
    expect(formatCurrency(Number.NaN, 'en')).toBe('—')
  })
})

describe('formatCompactCurrency', () => {
  it('abbreviates large amounts', () => {
    expect(formatCompactCurrency(1_200_000, 'en')).toMatch(/1\.2M/)
  })

  it('returns an em dash for non-numeric input', () => {
    expect(formatCompactCurrency(undefined, 'en')).toBe('—')
  })
})

describe('formatNumber', () => {
  it('formats a number using the locale', () => {
    expect(formatNumber(1234, 'en')).toBe('1,234')
  })

  it('returns an em dash for non-numeric input', () => {
    expect(formatNumber(undefined, 'en')).toBe('—')
  })
})

describe('parseServerDate', () => {
  it('treats an unmarked timestamp as UTC', () => {
    const withoutZone = parseServerDate('2024-01-01T00:00:00')
    const withZone = parseServerDate('2024-01-01T00:00:00Z')
    expect(withoutZone?.getTime()).toBe(withZone?.getTime())
  })

  it('preserves an explicit offset instead of double-applying UTC', () => {
    const date = parseServerDate('2024-01-01T00:00:00+02:00')
    expect(date?.toISOString()).toBe('2023-12-31T22:00:00.000Z')
  })

  it('returns null for empty or invalid input', () => {
    expect(parseServerDate(null)).toBeNull()
    expect(parseServerDate('')).toBeNull()
    expect(parseServerDate('not-a-date')).toBeNull()
  })
})

describe('formatDate', () => {
  it('returns an em dash when the value cannot be parsed', () => {
    expect(formatDate(null, 'en')).toBe('—')
    expect(formatDate('garbage', 'en')).toBe('—')
  })

  it('formats a valid date', () => {
    expect(formatDate('2024-06-15T00:00:00Z', 'en')).toMatch(/2024/)
  })
})

describe('formatBytes', () => {
  it('formats bytes, kilobytes and megabytes with the right unit', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
