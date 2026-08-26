/**
 * Untrusted-content helpers.
 *
 * React escapes text nodes for us, so the realistic injection surface in this
 * app is URL-valued attributes (`<img src>`, `<a href>`) fed by server data —
 * `imageUrl` on an apartment image is operator-supplied and must never be able
 * to become `javascript:alert(1)`.
 */

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:'])
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/
const DATA_URL_PREFIX = /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i
/** C0 controls plus DEL — the characters used to hide `java\nscript:` payloads. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/

/**
 * Returns the URL when it is safe to place in `src`/`href`, otherwise null.
 * Relative paths are allowed; protocol-relative (`//host`) URLs are resolved
 * against the current origin before the protocol check so they cannot smuggle
 * an unexpected scheme.
 */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (CONTROL_CHARS.test(trimmed)) return null

  try {
    const base = typeof window === 'undefined' ? 'http://localhost' : window.location.href
    const parsed = new URL(trimmed, base)
    return SAFE_URL_PROTOCOLS.has(parsed.protocol) ? trimmed : null
  } catch {
    return null
  }
}

/**
 * Turns the raw base64 the API returns for avatars into a renderable data URL.
 *
 * `UserService.ToDto` emits bare base64 with no prefix, while
 * `UpdateProfileImageAsync` accepts either form — so both shapes are handled.
 * Anything that is not well-formed base64 is rejected rather than injected.
 */
export function base64ToImageSrc(
  base64: string | null | undefined,
  mimeType = 'image/png',
): string | null {
  if (!base64) return null
  const value = base64.trim()
  if (!value) return null

  if (DATA_URL_PREFIX.test(value)) return value

  // Some payloads arrive with an unrecognised prefix; keep only the payload.
  const payload = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value
  const normalised = payload.replace(/\s/g, '')

  if (!normalised || normalised.length % 4 !== 0 || !BASE64_PATTERN.test(normalised)) {
    return null
  }

  return `data:${mimeType};base64,${normalised}`
}

/** Strips a `data:` prefix so only the payload is sent to the API. */
export function imageSrcToBase64(dataUrl: string): string {
  return dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl
}

/** Collapses whitespace and trims — for names, cities, and search terms. */
export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Deterministic initials for avatar fallbacks. */
export function initialsOf(name: string | null | undefined): string {
  const cleaned = normalizeText(name ?? '')
  if (!cleaned) return '?'
  const parts = cleaned.split(' ').filter(Boolean)
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase()
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
}
