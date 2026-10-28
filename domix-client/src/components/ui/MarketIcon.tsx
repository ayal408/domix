export type MarketIconName = 'search' | 'heart' | 'plus' | 'message' | 'user' | 'home' | 'list' | 'grid' | 'arrow' | 'calendar' | 'bell'
const paths: Record<MarketIconName, string> = {
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  plus: 'M12 5v14M5 12h14', message: 'M4 4h16v12H8l-4 4V4Z',
  user: 'M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  home: 'M3 10 12 3l9 7M5 9v12h14V9M9 21v-8h6v8',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  grid: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  arrow: 'M5 12h14M13 6l6 6-6 6', calendar: 'M5 5h14v16H5ZM8 2v6M16 2v6M5 10h14M9 14h2M14 14h1',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
}
export function MarketIcon({name, className = 'h-5 w-5'}: {name: MarketIconName; className?: string}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={paths[name]} /></svg>
}
