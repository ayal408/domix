import { lazy, type ComponentType } from 'react'

const RELOAD_FLAG = 'domix.chunk-reload-attempted'

/** Browsers/bundlers word this differently, but they all describe the same failure. */
const CHUNK_ERROR_PATTERN =
  /dynamically imported module|failed to fetch|loading chunk|importing a module script failed|error loading dynamically imported module/i

function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERROR_PATTERN.test(error.message)
}

/**
 * The reload-on-stale-chunk decision, factored out from `lazyWithReload` so it
 * is directly unit-testable as a plain async function — driving it through
 * `React.lazy` + `Suspense` + an error boundary in a test is timing-sensitive
 * and doesn't actually exercise anything this function doesn't already cover.
 *
 * A stale chunk reference — the hashed JS/CSS filename a lazy route asks for
 * no longer exists because a newer build was deployed since this tab loaded —
 * triggers exactly one full page reload instead of surfacing as a blank error
 * boundary. `sessionStorage` remembers that the reload already happened, so a
 * *persistent* failure (offline, a genuinely broken deploy) rejects through to
 * the caller instead of reload-looping.
 */
export function withChunkReload<T>(
  factory: () => Promise<T>,
  reload: () => void = () => window.location.reload(),
): () => Promise<T> {
  return async () => {
    try {
      const result = await factory()
      sessionStorage.removeItem(RELOAD_FLAG)
      return result
    } catch (error) {
      if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1')
        reload()
        // The reload is about to replace this document — never resolve, so
        // whatever's waiting on this (a Suspense boundary, in practice) stays
        // on its loading state instead of momentarily showing an error right
        // before the page disappears.
        return new Promise<T>(() => {})
      }
      throw error
    }
  }
}

export function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  reload?: () => void,
) {
  return lazy(withChunkReload(factory, reload))
}
