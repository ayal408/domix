import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSavedSearches, useDeleteSavedSearch } from '@/hooks/useSavedSearches'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { formatDate } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Guid, SavedSearch } from '@/types/api'

function describeSearch(search: SavedSearch, t: (key: string, options?: Record<string, unknown>) => string): string {
  const parts: string[] = []
  if (search.city) parts.push(search.city)
  if (search.area) parts.push(search.area)
  if (search.minPrice != null || search.maxPrice != null) {
    parts.push(`${search.minPrice ?? '0'}–${search.maxPrice ?? '∞'}`)
  }
  if (search.minRooms != null || search.maxRooms != null) {
    parts.push(t('apartments.card.roomsShort', { count: search.maxRooms ?? search.minRooms }))
  }
  return parts.length > 0 ? parts.join(' · ') : t('savedSearches.anyListing')
}

export default function SavedSearchesPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { data: savedSearches, isLoading } = useSavedSearches()
  const deleteMutation = useDeleteSavedSearch()
  const pushToast = useToastStore((state) => state.push)
  const [pendingDeleteId, setPendingDeleteId] = useState<Guid | null>(null)

  function applySearch(search: SavedSearch) {
    const params = new URLSearchParams()
    if (search.city) params.set('city', search.city)
    if (search.area) params.set('area', search.area)
    if (search.minPrice != null) params.set('minPrice', String(search.minPrice))
    if (search.maxPrice != null) params.set('maxPrice', String(search.maxPrice))
    if (search.minRooms != null) params.set('minRooms', String(search.minRooms))
    if (search.maxRooms != null) params.set('maxRooms', String(search.maxRooms))
    if (search.propertyType) params.set('propertyType', search.propertyType)
    if (search.parking) params.set('parking', 'true')
    if (search.elevator) params.set('elevator', 'true')
    navigate(`/?${params.toString()}`)
  }

  async function handleDeleteConfirm() {
    if (!pendingDeleteId) return
    try {
      await deleteMutation.mutateAsync(pendingDeleteId)
      pushToast({ variant: 'success', title: t('savedSearches.deleted') })
      setPendingDeleteId(null)
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('savedSearches.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('savedSearches.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : !savedSearches || savedSearches.length === 0 ? (
        <EmptyState title={t('savedSearches.empty.title')} description={t('savedSearches.empty.description')} />
      ) : (
        <div className="flex flex-col gap-3">
          {savedSearches.map((search) => (
            <Card key={search.savedSearchId} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{search.name}</p>
                <p className="text-xs text-muted">{describeSearch(search, t)}</p>
                <p className="mt-1 text-xs text-muted">
                  {t('savedSearches.createdAt', { date: formatDate(search.createdAt, i18n.language) })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => applySearch(search)}>
                  {t('savedSearches.run')}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setPendingDeleteId(search.savedSearchId)}>
                  {t('common.delete')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId != null}
        title={t('savedSearches.deleteConfirmTitle')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  )
}
