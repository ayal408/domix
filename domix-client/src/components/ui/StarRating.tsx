import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

const SIZE_CLASSES = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-7 w-7' } as const

interface StarRatingProps {
  /** 0-5, rounded to the nearest whole star for display. */
  value: number
  /** Shown as "(count)" next to the stars when provided. */
  count?: number
  size?: keyof typeof SIZE_CLASSES
  className?: string
}

/** Read-only star display for an apartment's average rating. */
export function StarRating({ value, count, size = 'md', className }: StarRatingProps) {
  const { t } = useTranslation()
  const rounded = Math.round(Math.min(5, Math.max(0, value)))

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="inline-flex" role="img" aria-label={t('rating.ariaValue', { value, max: 5 })}>
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon key={i} filled={i < rounded} className={SIZE_CLASSES[size]} />
        ))}
      </span>
      {typeof count === 'number' && <span className="text-xs text-muted">({count})</span>}
    </span>
  )
}

interface StarRatingInputProps {
  onRate: (score: number) => void
  disabled?: boolean
  size?: keyof typeof SIZE_CLASSES
  className?: string
}

/** Interactive 1-5 star picker. Submits immediately on click — there is no separate confirm step. */
export function StarRatingInput({ onRate, disabled, size = 'lg', className }: StarRatingInputProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div
      className={cn('inline-flex items-center gap-1', className)}
      onMouseLeave={() => setHovered(null)}
      role="group"
      aria-label={t('rating.pickerLabel')}
    >
      {Array.from({ length: 5 }, (_, i) => i + 1).map((score) => (
        <button
          key={score}
          type="button"
          disabled={disabled}
          aria-label={t('rating.rateStars', { count: score })}
          onMouseEnter={() => setHovered(score)}
          onFocus={() => setHovered(score)}
          onBlur={() => setHovered(null)}
          onClick={() => onRate(score)}
          className="rounded p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StarIcon filled={hovered != null && score <= hovered} className={SIZE_CLASSES[size]} />
        </button>
      ))}
    </div>
  )
}

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn(filled ? 'fill-warning text-warning' : 'fill-none text-border', className)}
      aria-hidden="true"
    >
      <path
        d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L10 14.9l-5.2 2.62.99-5.8-4.21-4.1 5.82-.85L10 1.5z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
}
