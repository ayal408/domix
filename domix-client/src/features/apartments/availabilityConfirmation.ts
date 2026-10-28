import { parseServerDate } from '@/lib/format'

/** Missing, invalid or future timestamps never count as a confirmation. */
export function confirmationState(value: string | null | undefined, now = Date.now()): 'unconfirmed' | 'stale' | 'confirmed' {
  const date = parseServerDate(value)
  if (!date || date.getTime() > now) return 'unconfirmed'
  return now - date.getTime() >= 30 * 86400000 ? 'stale' : 'confirmed'
}

