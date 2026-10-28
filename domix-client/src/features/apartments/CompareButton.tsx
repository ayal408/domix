import { useTranslation } from 'react-i18next'
import { useCompareStore, MAX_COMPARE } from '@/stores/compare.store'
import { useToastStore } from '@/stores/toast.store'
import { cn } from '@/lib/cn'

export function CompareButton({ apartmentId, overlay = false }: { apartmentId: string; overlay?: boolean }) {
  const { t } = useTranslation()
  const selected = useCompareStore(s => s.apartmentIds.includes(apartmentId))
  const toggle = useCompareStore(s => s.toggle)
  const push = useToastStore(s => s.push)
  return <button type="button" aria-pressed={selected}
    className={cn('min-h-11 rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring',
      overlay ? 'absolute bottom-2 start-2 z-20 text-white' : 'border border-border',
      selected ? 'bg-primary text-white' : overlay ? 'bg-black/60 hover:bg-black/80' : 'bg-card text-foreground')}
    onClick={event => {
      event.preventDefault()
      event.stopPropagation()
      if (!selected && useCompareStore.getState().apartmentIds.length >= MAX_COMPARE) {
        push({ variant: 'info', title: t('compare.limitReached', { count: MAX_COMPARE }) })
        return
      }
      toggle(apartmentId)
    }}>{selected ? `✓ ${t('compare.short')}` : t(overlay ? 'compare.short' : 'compare.addToCompare')}</button>
}
