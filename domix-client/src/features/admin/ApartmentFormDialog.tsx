import { Fragment, useEffect } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import {
  apartmentFormSchema,
  APARTMENT_FORM_DEFAULTS,
  apartmentToFormValues,
  toCreateApartmentRequest,
  toUpdateApartmentRequest,
  type ApartmentFormInput,
  type ApartmentFormValues,
} from '@/features/apartments/schemas'
import { useCreateApartment, useUpdateApartment } from '@/hooks/useApartments'
import { InputField, TextareaField, CheckboxField, SelectField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { PROPERTY_TYPES } from '@/types/api'
import type { Apartment } from '@/types/api'

interface Props {
  open: boolean
  apartment: Apartment | null
  onClose: () => void
}

/** Create when `apartment` is null, full edit (owner/Admin/Manager only — enforced server-side) otherwise. */
export function ApartmentFormDialog({ open, apartment, onClose }: Props) {
  const { t } = useTranslation()
  const isEdit = apartment != null
  const createMutation = useCreateApartment()
  const updateMutation = useUpdateApartment()
  const pushToast = useToastStore((state) => state.push)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApartmentFormInput, unknown, ApartmentFormValues>({
    resolver: zodResolver(apartmentFormSchema),
    defaultValues: APARTMENT_FORM_DEFAULTS,
  })

  useEffect(() => {
    if (open) reset(apartment ? apartmentToFormValues(apartment) : APARTMENT_FORM_DEFAULTS)
  }, [open, apartment, reset])

  async function onSubmit(values: ApartmentFormValues) {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ apartmentId: apartment.apartmentId, payload: toUpdateApartmentRequest(values) })
        pushToast({ variant: 'success', title: t('admin.apartments.updateSuccess') })
      } else {
        await createMutation.mutateAsync(toCreateApartmentRequest(values))
        pushToast({ variant: 'success', title: t('admin.apartments.createSuccess') })
      }
      onClose()
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
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

        <div className="fixed inset-0 overflow-y-auto p-4">
          <div className="flex min-h-full items-center justify-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-lg">
                <DialogTitle className="text-lg font-semibold text-foreground">
                  {isEdit ? t('admin.apartments.editApartment') : t('admin.apartments.newApartment')}
                </DialogTitle>

                <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InputField label={t('apartments.fields.city')} required error={errors.city?.message} {...register('city')} />
                    <InputField label={t('apartments.fields.area')} required error={errors.area?.message} {...register('area')} />
                  </div>

                  <InputField label={t('apartments.fields.address')} required error={errors.address?.message} {...register('address')} />

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <InputField
                      label={t('apartments.fields.price')}
                      type="number"
                      min={0}
                      required
                      error={errors.price?.message}
                      {...register('price')}
                    />
                    <InputField
                      label={t('apartments.fields.squareMeters')}
                      type="number"
                      min={0}
                      error={errors.squareMeters?.message}
                      {...register('squareMeters')}
                    />
                    <InputField
                      label={t('apartments.fields.sumOfRooms')}
                      type="number"
                      min={0}
                      step="0.5"
                      error={errors.sumOfRooms?.message}
                      {...register('sumOfRooms')}
                    />
                    <InputField
                      label={t('apartments.fields.sumOfBeds')}
                      type="number"
                      min={0}
                      error={errors.sumOfBeds?.message}
                      {...register('sumOfBeds')}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <InputField label={t('apartments.fields.floor')} type="number" error={errors.floor?.message} {...register('floor')} />
                    <SelectField label={t('apartments.fields.propertyType')} {...register('propertyType')}>
                      <option value="">{t('apartments.filters.any')}</option>
                      {PROPERTY_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`apartments.propertyTypes.${type}`)}
                        </option>
                      ))}
                    </SelectField>
                    <div className="col-span-2 flex items-end gap-6 pb-2">
                      <CheckboxField label={t('apartments.fields.elevator')} {...register('elevator')} />
                      <CheckboxField label={t('apartments.fields.parking')} {...register('parking')} />
                      {isEdit && <CheckboxField label={t('apartments.fields.status')} {...register('status')} />}
                    </div>
                  </div>

                  <TextareaField
                    label={t('apartments.fields.description')}
                    error={errors.description?.message}
                    {...register('description')}
                  />

                  <div className="mt-2 flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" loading={isSubmitting}>
                      {t('common.save')}
                    </Button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
