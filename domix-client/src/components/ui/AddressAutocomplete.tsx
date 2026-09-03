import { useId, useState } from 'react'
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react'
import { FieldShell } from '@/components/ui/Field'
import { cn } from '@/lib/cn'

interface AddressAutocompleteProps {
  label: string
  /** The committed field value — only changes when the user picks a suggestion, never on every keystroke. */
  value: string
  onChange: (value: string) => void
  /** Raw search text, debounced upstream by the caller's suggestion hook. */
  query: string
  onQueryChange: (query: string) => void
  suggestions: string[]
  isLoading?: boolean
  required?: boolean
  disabled?: boolean
  error?: string
  placeholder?: string
  /** Shown under the field when there's no error and the option list is empty (e.g. "Pick a city first"). */
  hint?: string
}

/**
 * A combobox restricted to picking from server-fetched suggestions (Israeli cities/streets from
 * data.gov.il — see IsraeliAddressService) rather than accepting arbitrary free text. `value` only
 * updates on an explicit selection, so a listing can't be saved with a place that isn't real.
 */
export function AddressAutocomplete({
  label,
  value,
  onChange,
  query,
  onQueryChange,
  suggestions,
  isLoading,
  required,
  disabled,
  error,
  placeholder,
  hint,
}: AddressAutocompleteProps) {
  const fieldId = useId()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <FieldShell id={fieldId} label={label} error={error} required={required} hint={!error ? hint : undefined}>
      <Combobox
        value={value || null}
        onChange={(selected: string | null) => onChange(selected ?? '')}
        disabled={disabled}
      >
        <div className="relative">
          <ComboboxInput
            id={fieldId}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            aria-invalid={!!error}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            className={cn(
              'w-full rounded border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-60',
              error ? 'border-danger' : 'border-border',
            )}
            displayValue={(v: unknown) => (typeof v === 'string' ? v : '')}
            onChange={(event) => {
              onQueryChange(event.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
          />
          {isOpen && (query.trim().length >= 2 || isLoading) && (
            <ComboboxOptions
              static
              className="absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded border border-border bg-card py-1 shadow-lg"
              onBlur={() => setIsOpen(false)}
            >
              {isLoading ? (
                <div className="px-3 py-2 text-sm text-muted">…</div>
              ) : suggestions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted">{hint ?? ' '}</div>
              ) : (
                suggestions.map((suggestion) => (
                  <ComboboxOption
                    key={suggestion}
                    value={suggestion}
                    onClick={() => setIsOpen(false)}
                    className="cursor-pointer px-3 py-2 text-sm text-foreground data-focus:bg-card-muted"
                  >
                    {suggestion}
                  </ComboboxOption>
                ))
              )}
            </ComboboxOptions>
          )}
        </div>
      </Combobox>
    </FieldShell>
  )
}
