import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDeleteApartment } from '@/hooks/useApartments'
import { ApartmentFormDialog } from '@/features/admin/ApartmentFormDialog'
import { ApartmentImagesDialog } from '@/features/admin/ApartmentImagesDialog'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StarRating } from '@/components/ui/StarRating'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { formatCurrency } from '@/lib/format'
import type { Apartment, Guid } from '@/types/api'

type DialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; apartmentId: Guid }
  | { kind: 'images'; apartmentId: Guid }
  | { kind: 'delete'; apartmentId: Guid }

interface Props {
  apartments: Apartment[] | undefined
  isLoading: boolean
  title: string
  subtitle: string
  newApartmentLabel: string
  emptyLabel: string
}

/**
 * The create/edit/delete/images management table, shared by the Admin
 * "all listings" view and the per-user "My apartments" view — the only real
 * difference between the two is which `apartments` array they pass in and the
 * page-level copy, so that's parameterised while the table/dialog chrome stays
 * one implementation.
 */
export function ApartmentManagementList({ apartments, isLoading, title, subtitle, newApartmentLabel, emptyLabel }: Props) {
  const { t, i18n } = useTranslation()
  const deleteMutation = useDeleteApartment()
  const pushToast = useToastStore((state) => state.push)
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' })

  const byId = useMemo(() => new Map((apartments ?? []).map((a) => [a.apartmentId, a])), [apartments])
  const activeApartment: Apartment | null =
    dialog.kind === 'edit' || dialog.kind === 'images' || dialog.kind === 'delete'
      ? (byId.get(dialog.apartmentId) ?? null)
      : null

  async function handleDeleteConfirm() {
    if (dialog.kind !== 'delete') return
    try {
      await deleteMutation.mutateAsync(dialog.apartmentId)
      pushToast({ variant: 'success', title: t('admin.apartments.deleteSuccess') })
      setDialog({ kind: 'closed' })
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <Button onClick={() => setDialog({ kind: 'create' })}>{newApartmentLabel}</Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !apartments || apartments.length === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('admin.apartments.table.city')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('admin.apartments.table.address')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('admin.apartments.table.price')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('rating.label')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('admin.apartments.table.status')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('admin.apartments.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {apartments.map((apartment) => (
                <tr key={apartment.apartmentId}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {apartment.city} · {apartment.area}
                  </td>
                  <td className="max-w-[16rem] truncate px-4 py-3 text-muted">{apartment.address}</td>
                  <td className="px-4 py-3 text-foreground">{formatCurrency(apartment.price, i18n.language)}</td>
                  <td className="px-4 py-3">
                    {apartment.ratingCount > 0 ? (
                      <StarRating value={apartment.rating} count={apartment.ratingCount} size="sm" />
                    ) : (
                      <span className="text-xs text-muted">{t('rating.none')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={apartment.status ? 'success' : 'neutral'}>
                      {apartment.status ? t('admin.apartments.status.active') : t('admin.apartments.status.inactive')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'images', apartmentId: apartment.apartmentId })}>
                        {t('admin.apartments.images')}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'edit', apartmentId: apartment.apartmentId })}>
                        {t('common.edit')}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setDialog({ kind: 'delete', apartmentId: apartment.apartmentId })}>
                        {t('common.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ApartmentFormDialog
        open={dialog.kind === 'create' || dialog.kind === 'edit'}
        apartment={dialog.kind === 'edit' ? activeApartment : null}
        onClose={() => setDialog({ kind: 'closed' })}
      />

      <ApartmentImagesDialog
        open={dialog.kind === 'images'}
        apartment={activeApartment}
        onClose={() => setDialog({ kind: 'closed' })}
      />

      <ConfirmDialog
        open={dialog.kind === 'delete'}
        title={t('admin.apartments.deleteConfirmTitle')}
        description={t('admin.apartments.deleteConfirmDescription')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDialog({ kind: 'closed' })}
      />
    </div>
  )
}
