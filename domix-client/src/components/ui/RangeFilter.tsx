import { InputField } from './Field'

interface Props {
  minLabel: string
  maxLabel: string
  anyLabel: string
  minValue: unknown
  maxValue: unknown
  options: number[]
  step: number
  minError?: string
  maxError?: string
  onMinChange: (value: string | number) => void
  onMaxChange: (value: string | number) => void
}

/** Preset positions keep both rental and sale prices reachable; exact values remain editable. */
export function RangeFilter({ minLabel, maxLabel, anyLabel, minValue, maxValue, options, step, minError, maxError, onMinChange, onMaxChange }: Props) {
  const number = (value: unknown) => value === '' || value == null ? undefined : Number(value)
  const lower = number(minValue), upper = number(maxValue)
  const values = Array.from(new Set([...options, lower, upper].filter((value): value is number => value != null && Number.isFinite(value) && value >= 0))).sort((a, b) => a - b)
  const last = values.length - 1
  const lowIndex = lower == null ? 0 : Math.max(0, values.indexOf(lower))
  const highIndex = upper == null ? last : Math.max(0, values.indexOf(upper))
  const format = (value: number | undefined) => value == null ? anyLabel : new Intl.NumberFormat().format(value)
  return (
    <fieldset className="col-span-2 min-w-0 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">{minLabel} — {maxLabel}</legend>
      <div className="grid grid-cols-2 gap-3">
        <InputField label={minLabel} type="number" min={0} step={step} placeholder={anyLabel} value={lower ?? ''} onChange={event => onMinChange(event.target.value)} error={minError} />
        <InputField label={maxLabel} type="number" min={0} step={step} placeholder={anyLabel} value={upper ?? ''} onChange={event => onMaxChange(event.target.value)} error={maxError} />
      </div>
      <div className="domix-range mt-3" dir="ltr" style={{ background: `linear-gradient(to right, var(--color-border, #94a3b8) ${lowIndex / last * 100}%, var(--color-primary) ${lowIndex / last * 100}%, var(--color-primary) ${highIndex / last * 100}%, var(--color-border, #94a3b8) ${highIndex / last * 100}%)` }}>
        <input type="range" aria-label={minLabel} aria-valuetext={format(lower)} aria-valuemin={values[0]} aria-valuemax={values[last]} aria-valuenow={lower ?? values[0]} min={0} max={last} value={lowIndex} onChange={event => onMinChange(values[Math.min(Number(event.target.value), highIndex)]!)} />
        <input type="range" aria-label={maxLabel} aria-valuetext={format(upper)} aria-valuemin={values[0]} aria-valuemax={values[last]} aria-valuenow={upper ?? values[last]} min={0} max={last} value={highIndex} onChange={event => onMaxChange(values[Math.max(Number(event.target.value), lowIndex)]!)} />
      </div>
    </fieldset>
  )
}
