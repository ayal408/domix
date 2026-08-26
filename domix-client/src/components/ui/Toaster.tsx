import { useEffect } from 'react'
import { useToastStore, type Toast, type ToastVariant } from '@/stores/toast.store'
import { cn } from '@/lib/cn'

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-success/40 bg-success-bg text-success',
  error: 'border-danger/40 bg-danger-bg text-danger',
  warning: 'border-warning/40 bg-warning-bg text-warning',
  info: 'border-border bg-card text-foreground',
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss)

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration)
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.duration, dismiss])

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto w-80 max-w-[calc(100vw-2rem)] rounded border px-4 py-3 shadow-lg',
        VARIANT_CLASSES[toast.variant],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description && <p className="mt-0.5 text-xs opacity-90">{toast.description}</p>}
        </div>
        <button
          type="button"
          onClick={() => dismiss(toast.id)}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          &times;
        </button>
      </div>
    </div>
  )
}

/** Fixed toast stack, driven entirely by `useToastStore`. Mount once at the app root. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:end-4 sm:items-end"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
