/** Removing a city also removes its dependent area; other URL state stays intact. */
export function withoutCatalogFilter(params: URLSearchParams, key: string): URLSearchParams {
  const next = new URLSearchParams(params)
  next.delete(key)
  if (key === 'city') next.delete('area')
  return next
}

export function numericCatalogParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key)?.trim()
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}
