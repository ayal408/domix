import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  variant: ToastVariant
  /** Already-translated title. Callers translate before pushing. */
  title: string
  description?: string
  duration: number
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => string
  dismiss: (id: string) => void
  clear: () => void
}

const DEFAULT_DURATION = 5_000
let counter = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: ({ duration = DEFAULT_DURATION, ...toast }) => {
    const id = `toast-${++counter}`
    set((state) => ({ toasts: [...state.toasts, { ...toast, id, duration }] }))
    return id
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  clear: () => set({ toasts: [] }),
}))
