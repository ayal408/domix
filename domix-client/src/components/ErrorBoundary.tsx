import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last-resort safety net for render-time exceptions React Query/RHF error
 * states don't cover. Deliberately outside i18n (a broken i18n bundle is one
 * of the failures this needs to survive), and reloads rather than trying to
 * recover in place, since the error boundary itself can't know if app state
 * is still consistent.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  override render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted">
          An unexpected error occurred. Reloading the page usually fixes this.
        </p>
        <Button onClick={() => window.location.assign('/')}>Reload</Button>
      </div>
    )
  }
}
