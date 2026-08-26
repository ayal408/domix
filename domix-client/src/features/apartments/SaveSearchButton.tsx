import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import { useCreateSavedSearch } from '@/hooks/useSavedSearches'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { saveSearchNameSchema, type SaveSearchNameValues } from '@/features/apartments/savedSearch.schemas'
import { InputField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import type { ApartmentSearchQuery } from '@/types/api'

/**
 * Only rendered by the catalog page once a non-empty search is active. Hidden
 * for anonymous visitors — saved searches belong to a signed-in account.
 */
export function SaveSearchButton({ query }: { query: ApartmentSearchQuery | null }) {
  const { t } = useTranslation()
  const status = useAuthStore((state) => state.status)
  const createSavedSearch = useCreateSavedSearch()
  const pushToast = useToastStore((state) => state.push)
  const [isOpen, setIsOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SaveSearchNameValues>({ resolver: zodResolver(saveSearchNameSchema), defaultValues: { name: '' } })

  if (status !== 'authenticated' || !query) return null

  async function onSubmit(values: SaveSearchNameValues) {
    try {
      await createSavedSearch.mutateAsync({
        name: values.name,
        city: query?.city ?? null,
        area: query?.area ?? null,
        minPrice: query?.minPrice ?? null,
        maxPrice: query?.maxPrice ?? null,
        minRooms: query?.minRooms ?? null,
        maxRooms: query?.maxRooms ?? null,
        propertyType: query?.propertyType ?? null,
        parking: query?.parking ?? null,
        elevator: query?.elevator ?? null,
      })
      pushToast({ variant: 'success', title: t('savedSearches.saved') })
      reset()
      setIsOpen(false)
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    }
  }

  if (!isOpen) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        {t('savedSearches.saveThisSearch')}
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-2">
      <InputField
        label={t('savedSearches.nameLabel')}
        placeholder={t('savedSearches.namePlaceholder')}
        error={errors.name?.message}
        autoFocus
        {...register('name')}
      />
      <Button type="submit" size="sm" loading={createSavedSearch.isPending}>
        {t('common.save')}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
        {t('common.cancel')}
      </Button>
    </form>
  )
}
