import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import {
  MORTGAGE_CALCULATOR_DEFAULTS,
  mortgageCalculatorSchema,
  type MortgageCalculatorFormInput,
  type MortgageCalculatorFormValues,
} from '@/features/mortgage/schemas'
import { BreakdownBar } from '@/features/mortgage/BreakdownBar'
import { BalanceChart } from '@/features/mortgage/BalanceChart'
import { buildAmortizationSchedule, summarizeMortgage, toYearlySchedule, type MortgageInput } from '@/lib/mortgage'
import { formatCurrency } from '@/lib/format'
import { InputField } from '@/components/ui/Field'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Clamps a possibly-invalid, mid-typing form value to something safe to
 * compute with. `watch()` reflects raw (pre-Zod-coercion) input, so a field
 * can be `""`, `undefined`, or a non-numeric string while the user is typing.
 */
function toFiniteNonNegative(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export default function MortgageCalculatorPage() {
  const { t, i18n } = useTranslation()

  const {
    register,
    watch,
    formState: { errors },
  } = useForm<MortgageCalculatorFormInput, unknown, MortgageCalculatorFormValues>({
    resolver: zodResolver(mortgageCalculatorSchema),
    defaultValues: MORTGAGE_CALCULATOR_DEFAULTS,
    mode: 'onChange',
  })

  const watched = watch()

  // Recomputed on every keystroke for live results — invalid/partial input is
  // clamped to 0 here (the field itself still shows the real validation error)
  // rather than throwing mid-render.
  const input: MortgageInput = useMemo(
    () => ({
      homePrice: toFiniteNonNegative(watched.homePrice),
      downPayment: toFiniteNonNegative(watched.downPayment),
      annualInterestRatePercent: toFiniteNonNegative(watched.interestRate),
      termYears: toFiniteNonNegative(watched.termYears),
    }),
    [watched.homePrice, watched.downPayment, watched.interestRate, watched.termYears],
  )

  const summary = useMemo(() => summarizeMortgage(input), [input])
  const yearlySchedule = useMemo(() => toYearlySchedule(buildAmortizationSchedule(input)), [input])
  const hasResult = summary.principal > 0 && summary.numPayments > 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('mortgage.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('mortgage.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <Card className="flex h-fit flex-col gap-4 p-5" aria-label={t('mortgage.title')}>
          <InputField
            label={t('mortgage.fields.homePrice')}
            type="number"
            min={0}
            step="1000"
            inputMode="decimal"
            error={errors.homePrice?.message}
            {...register('homePrice')}
          />
          <InputField
            label={t('mortgage.fields.downPayment')}
            type="number"
            min={0}
            step="1000"
            inputMode="decimal"
            error={errors.downPayment?.message}
            {...register('downPayment')}
          />
          <InputField
            label={t('mortgage.fields.interestRate')}
            type="number"
            min={0}
            step="0.05"
            inputMode="decimal"
            hint={t('mortgage.fields.interestRateHint')}
            error={errors.interestRate?.message}
            {...register('interestRate')}
          />
          <InputField
            label={t('mortgage.fields.termYears')}
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            error={errors.termYears?.message}
            {...register('termYears')}
          />
        </Card>

        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={t('mortgage.summary.monthlyPayment')} value={formatCurrency(summary.monthlyPayment, i18n.language)} emphasize />
            <StatTile label={t('mortgage.summary.principal')} value={formatCurrency(summary.principal, i18n.language)} />
            <StatTile label={t('mortgage.summary.totalInterest')} value={formatCurrency(summary.totalInterest, i18n.language)} />
            <StatTile label={t('mortgage.summary.totalPayment')} value={formatCurrency(summary.totalPayment, i18n.language)} />
          </div>

          {hasResult ? (
            <>
              <Card className="flex flex-col gap-3 p-5">
                <h2 className="text-sm font-semibold text-foreground">{t('mortgage.breakdown.title')}</h2>
                <BreakdownBar principal={summary.principal} interest={summary.totalInterest} language={i18n.language} />
              </Card>

              <Card className="flex flex-col gap-3 p-5">
                <h2 className="text-sm font-semibold text-foreground">{t('mortgage.chart.title')}</h2>
                <BalanceChart data={yearlySchedule} language={i18n.language} />
              </Card>

              <Card className="flex flex-col gap-3 p-5">
                <h2 className="text-sm font-semibold text-foreground">{t('mortgage.schedule.title')}</h2>
                <AmortizationTable rows={yearlySchedule} language={i18n.language} />
              </Card>
            </>
          ) : (
            <EmptyState title={t('mortgage.empty')} />
          )}
        </div>
      </div>
    </div>
  )
}

function StatTile({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className={emphasize ? 'text-xl font-bold text-primary' : 'text-lg font-semibold text-foreground'}>{value}</span>
    </Card>
  )
}

function AmortizationTable({
  rows,
  language,
}: {
  rows: Array<{ year: number; principalPaid: number; interestPaid: number; endingBalance: number }>
  language: string
}) {
  const { t } = useTranslation()

  return (
    <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[28rem] text-start text-sm">
        <thead className="sticky top-0 bg-card-muted text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 text-start font-medium">{t('mortgage.schedule.year')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('mortgage.schedule.principalPaid')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('mortgage.schedule.interestPaid')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('mortgage.schedule.endingBalance')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year} className="border-t border-border">
              <td className="px-3 py-2 text-foreground">{row.year}</td>
              <td className="px-3 py-2 text-foreground">{formatCurrency(row.principalPaid, language)}</td>
              <td className="px-3 py-2 text-foreground">{formatCurrency(row.interestPaid, language)}</td>
              <td className="px-3 py-2 text-foreground">{formatCurrency(row.endingBalance, language)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
