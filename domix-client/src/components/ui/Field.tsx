import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * Shared form-field chrome: label, error message, and the aria wiring between
 * them. Every control below renders its own `<input>`/`<select>`/`<textarea>`
 * but delegates the label/error/describedby plumbing here so it's consistent
 * (and accessible) across the whole apartments form.
 */
interface FieldShellProps {
  id: string
  label: string
  error?: string
  required?: boolean
  hint?: string
  children: ReactNode
}

export function FieldShell({ id, label, error, required, hint, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ms-0.5 text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const controlClasses = (hasError?: boolean) =>
  cn(
    'w-full rounded border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted',
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    hasError ? 'border-danger' : 'border-border',
  )

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { label, error, hint, required, id, className, ...rest },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} error={error} required={required} hint={hint}>
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(controlClasses(!!error), className)}
        {...rest}
      />
    </FieldShell>
  )
})

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: string
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { label, error, hint, required, id, className, rows = 4, ...rest },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} error={error} required={required} hint={hint}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(controlClasses(!!error), 'resize-y', className)}
        {...rest}
      />
    </FieldShell>
  )
})

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, required, id, className, children, ...rest },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} error={error} required={required} hint={hint}>
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(controlClasses(!!error), className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  )
})

interface CheckboxFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField(
  { label, id, className, ...rest },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <label htmlFor={fieldId} className="flex items-center gap-2 text-sm text-foreground">
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        className={cn(
          'h-4 w-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        {...rest}
      />
      {label}
    </label>
  )
})
