import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import HebrewDatePicker from 'react-hebrew-datepicker'
import 'react-hebrew-datepicker/dist/styles.css'

interface Props {
  name: string
  label: string
  value: string
  onChange: (isoDate: string) => void
  error?: string
  minDate?: string
  maxDate?: string
  required?: boolean
}

/** Keep the picker ISO value unchanged: do not pass date-only values through UTC conversion. */
export function HebrewDateField({ name, label, value, onChange, error, minDate, maxDate, required }: Props) {
  const id = useId()
  const { t } = useTranslation()
  return <div role="group" aria-describedby={error ? `${id}-error` : undefined} className="domix-datepicker flex flex-col gap-1.5">
    <HebrewDatePicker id={id} name={name} label={label} value={value}
      onChange={event => onChange(event.target.value)} required={required}
      minDate={minDate} maxDate={maxDate} showGregorian dir="rtl" />
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-danger">{t(error)}</p>}
  </div>
}
