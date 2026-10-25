export function authReturn(state: unknown): string {
  const from = (state as { from?: { pathname?: string; search?: string } } | null)?.from
  const path = from?.pathname
  if (typeof path !== 'string' || !path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\r\n]/.test(path) || ['/login', '/register'].includes(path)) return '/'
  const search = from?.search
  return path + (typeof search === 'string' && search.startsWith('?') ? search : '')
}
