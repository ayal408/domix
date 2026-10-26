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
    const script = existing ?? document.createElement('script')
    const finish = (error?: Error) => {
      clearTimeout(timer)
      script.removeEventListener('load', loaded)
      script.removeEventListener('error', failed)
      if (error) { script.remove(); reject(error) } else resolve()
    }
    const loaded = () => finish(window.google?.accounts?.id ? undefined : new Error('GOOGLE_SCRIPT_LOAD_FAILED'))
    const failed = () => finish(new Error('GOOGLE_SCRIPT_LOAD_FAILED'))
    const timer = setTimeout(() => finish(new Error('GOOGLE_SCRIPT_TIMEOUT')), 12_000)
    script.addEventListener('load', loaded)
    script.addEventListener('error', failed)
    if (!existing) {
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }).catch((err: unknown) => {
    scriptPromise = null
    throw err
  })

  return scriptPromise
}
