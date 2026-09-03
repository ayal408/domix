import { useEffect, useState } from 'react'

/** Delays reflecting `value` until it stops changing for `delayMs` — e.g. so autocomplete queries don't fire on every keystroke. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
