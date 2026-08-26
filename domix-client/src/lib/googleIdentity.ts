const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let scriptPromise: Promise<void> | null = null

/**
 * Loads the Google Identity Services script once and caches the promise, so
 * every caller (login page, register page, a re-mounted button) shares the
 * same in-flight or resolved load instead of injecting duplicate <script>s.
 */
export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('GOOGLE_SCRIPT_NO_WINDOW'))
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }

  if (scriptPromise) {
    return scriptPromise
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)

    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('GOOGLE_SCRIPT_LOAD_FAILED')))
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('GOOGLE_SCRIPT_LOAD_FAILED'))
    document.head.appendChild(script)
  }).catch((err: unknown) => {
    // Let a later retry (e.g. next mount) try again instead of caching a failure.
    scriptPromise = null
    throw err
  })

  return scriptPromise
}
