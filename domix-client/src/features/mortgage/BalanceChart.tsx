import { useId, useMemo, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCompactCurrency, formatCurrency } from '@/lib/format'
import type { YearlyAmortizationRow } from '@/lib/mortgage'

interface Props {
  data: YearlyAmortizationRow[]
  language: string
}

const WIDTH = 640
const HEIGHT = 240
const PAD_LEFT = 64
const PAD_RIGHT = 16
const PAD_TOP = 16
const PAD_BOTTOM = 28
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM
const Y_TICKS = 4

/**
 * Single-series line chart: remaining balance over the life of the loan.
 * One series needs no legend box (the heading names it) — the hover
 * crosshair + tooltip is the direct label, per the interaction spec.
 */
export function BalanceChart({ data, language }: Props) {
  const { t } = useTranslation()
  const gradientId = useId()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const startingBalance = (data[0]?.endingBalance ?? 0) + (data[0]?.principalPaid ?? 0)
  const maxBalance = Math.max(1, startingBalance)

  const points = useMemo(
    () =>
      data.map((row, index) => {
        const x = PAD_LEFT + (data.length <= 1 ? 0 : (index / (data.length - 1)) * PLOT_WIDTH)
        const y = PAD_TOP + PLOT_HEIGHT - (row.endingBalance / maxBalance) * PLOT_HEIGHT
        return { x, y, row }
      }),
    [data, maxBalance],
  )

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const lastPoint = points[points.length - 1]
  const areaPath = lastPoint
    ? `${linePath} L ${lastPoint.x.toFixed(1)} ${PAD_TOP + PLOT_HEIGHT} L ${PAD_LEFT} ${PAD_TOP + PLOT_HEIGHT} Z`
    : ''

  const gridLines = Array.from({ length: Y_TICKS + 1 }, (_, i) => {
    const fraction = i / Y_TICKS
    return { y: PAD_TOP + PLOT_HEIGHT * fraction, value: maxBalance * (1 - fraction) }
  })

  const xLabelStep = Math.max(1, Math.ceil(data.length / 6))

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const relX = ((event.clientX - rect.left) / rect.width) * WIDTH
    const fraction = (relX - PAD_LEFT) / PLOT_WIDTH
    const index = Math.round(fraction * (data.length - 1))
    setHoverIndex(Math.min(data.length - 1, Math.max(0, index)))
  }

  if (data.length === 0) return null

  const hovered = hoverIndex != null ? points[hoverIndex] : undefined

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full text-muted"
        role="img"
        aria-label={t('mortgage.chart.ariaLabel')}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((line) => (
          <g key={line.y}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={line.y}
              y2={line.y}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text x={PAD_LEFT - 8} y={line.y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="currentColor">
              {formatCompactCurrency(line.value, language)}
            </text>
          </g>
        ))}

        {points
          .filter((_, index) => index % xLabelStep === 0 || index === points.length - 1)
          .map((p) => (
            <text key={p.row.year} x={p.x} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="currentColor">
              {t('mortgage.chart.yearShort', { year: p.row.year })}
            </text>
          ))}

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
        <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hovered && (
          <g>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PAD_TOP}
              y2={PAD_TOP + PLOT_HEIGHT}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <circle cx={hovered.x} cy={hovered.y} r={4} fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth={2} />
          </g>
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 max-w-[10rem] -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-card-hover"
          style={{ left: `${(hovered.x / WIDTH) * 100}%` }}
        >
          <p className="font-semibold text-foreground">{t('mortgage.chart.yearLabel', { year: hovered.row.year })}</p>
          <p className="text-muted">
            {t('mortgage.chart.balance')}: <span className="font-medium text-foreground">{formatCurrency(hovered.row.endingBalance, language)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
