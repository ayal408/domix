import { Fragment, useRef, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import { useUploadApartmentImage } from '@/hooks/useImages'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { safeUrl } from '@/lib/sanitize'
import { Button } from '@/components/ui/Button'
import type { Apartment } from '@/types/api'

interface Props {
  open: boolean
  apartment: Apartment | null
  onClose: () => void
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 15 * 1024 * 1024

export function ApartmentImagesDialog({ open, apartment, onClose }: Props) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadApartmentImage()
  const pushToast = useToastStore((state) => state.push)

  if (!apartment) return null
  const images = (apartment.apartmentImages ?? []).map((img) => safeUrl(img.imageUrl)).filter((src): src is string => !!src)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !apartment) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      pushToast({ variant: 'error', title: 'Only JPEG, PNG or WebP images are allowed.' })
      return
    }
    if (file.size > MAX_BYTES) {
      pushToast({ variant: 'error', title: 'Image is too large (max 15 MB).' })
      return
    }

    setProgress(0)
    try {
      await upload.mutateAsync({
        request: { apartmentId: apartment.apartmentId, image: file },
        onProgress: setProgress,
      })
      pushToast({ variant: 'success', title: t('admin.apartments.imageUploaded') })
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    } finally {
      setProgress(null)
    }
  }

  return (
    <Transition show={open} as={Fragment}>
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
            <DialogPanel className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
              <DialogTitle className="text-lg font-semibold text-foreground">
                {t('admin.apartments.images')} — {apartment.city}
              </DialogTitle>

              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {images.map((src, index) => (
                    <img key={src + index} src={src} alt="" className="h-24 w-full rounded-xl border border-border object-cover" />
                  ))}
                </div>
              )}

              <div className="mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  onChange={handleFileChange}
                  className="hidden"
                  id="apartment-image-input"
                />
                <Button
                  type="button"
                  variant="secondary"
                  loading={progress != null}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {progress != null ? `${t('admin.apartments.uploading')} ${progress}%` : t('admin.apartments.uploadImage')}
                </Button>
              </div>

              <div className="mt-6 flex justify-end">
                <Button type="button" variant="secondary" onClick={onClose}>
                  {t('common.close')}
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
