import { Dialog, DialogPanel, DialogTitle, Description, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'
import { Button } from '@/components/ui/Button'

interface Props {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog static onClose={onCancel} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
              <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
              {description && <Description className="mt-2 text-sm text-muted">{description}</Description>}
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
                  {cancelLabel}
                </Button>
                <Button
                  type="button"
                  variant={destructive ? 'danger' : 'primary'}
                  onClick={onConfirm}
                  loading={loading}
                >
                  {confirmLabel}
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
