import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

const TONE_CLASSES: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-card-muted text-muted',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  )
}
