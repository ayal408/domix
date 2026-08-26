import { useTranslation } from 'react-i18next'
import { formatCurrency, formatNumber } from '@/lib/format'

interface Props {
  principal: number
  interest: number
  language: string
}

/**
 * Part-to-whole composition for a single total (principal vs. total interest)
 * — a slim proportion bar rather than a full chart, per the "is it even a
 * chart?" heuristic. Values are always direct-labelled in the legend below,
 * so identity never depends on the primary/warning colour pair alone.
 */
export function BreakdownBar({ principal, interest, language }: Props) {
  const { t } = useTranslation()
  const total = principal + interest
  const principalPct = total > 0 ? (principal / total) * 100 : 0
  const interestPct = total > 0 ? 100 - principalPct : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded-full bg-card-muted" aria-hidden="true">
        {principalPct > 0 && (
          <div
            className="h-full rounded-s-full"
            style={{ width: `${principalPct}%`, backgroundColor: 'var(--color-primary)' }}
          />
        )}
        {interestPct > 0 && (
          <div
            className="h-full rounded-e-full"
            style={{ width: `${interestPct}%`, backgroundColor: 'var(--color-warning)' }}
          />
        )}
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <LegendItem
          color="var(--color-primary)"
          label={t('mortgage.breakdown.principal')}
          value={formatCurrency(principal, language)}
          pct={principalPct}
          language={language}
        />
        <LegendItem
          color="var(--color-warning)"
          label={t('mortgage.breakdown.interest')}
          value={formatCurrency(interest, language)}
          pct={interestPct}
          language={language}
        />
      </dl>
    </div>
  )
}

function LegendItem({
  color,
  label,
  value,
  pct,
  language,
}: {
  color: string
  label: string
  value: string
  pct: number
  language: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-foreground">
        {/* `<bdi>` isolates each value from the surrounding run — without it, a
            currency string can leak bidi directionality into the neighbouring
            "(N%)" text and mirror its parentheses even on an LTR page. */}
        <bdi>{value}</bdi>{' '}
        <span className="text-muted">
          (<bdi>{formatNumber(pct, language, { maximumFractionDigits: 0 })}</bdi>%)
        </span>
      </dd>
    </div>
  )
}
