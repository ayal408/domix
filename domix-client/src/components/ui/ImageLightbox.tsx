import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  images: string[]
  initialIndex: number
  onClose: () => void
}

/**
 * Full-screen gallery viewer. Built on the project's existing Headless UI
 * dependency (same as `ConfirmDialog`) rather than a new lightbox library.
 */
export function ImageLightbox({ images, initialIndex, onClose }: Props) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => setIndex(initialIndex), [initialIndex])

  function next() {
    setIndex((current) => (current + 1) % images.length)
  }

  function prev() {
    setIndex((current) => (current - 1 + images.length) % images.length)
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') next()
      else if (event.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length])

  if (images.length === 0) return null

  return (
    <Transition show as={Fragment} appear>
      <Dialog static onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/90" aria-hidden="true" />
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
            <DialogPanel className="relative flex h-full w-full max-w-5xl items-center justify-center">
              <img
                src={images[index]}
                alt=""
                className="max-h-[85vh] max-w-full rounded-lg object-contain"
              />

              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                className="absolute end-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CloseIcon />
              </button>

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    aria-label={t('lightbox.previous')}
                    className="absolute start-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronIcon direction="start" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    aria-label={t('lightbox.next')}
                    className="absolute end-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronIcon direction="end" />
                  </button>
                  <div className="absolute bottom-2 start-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
                    {index + 1} / {images.length}
                  </div>
                </>
              )}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: 'start' | 'end' }) {
  const d = direction === 'start' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
