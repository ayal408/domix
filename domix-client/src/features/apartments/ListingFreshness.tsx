import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/format'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { useFlowAction } from '@/features/community/api'
import { Button } from '@/components/ui/Button'
import type { Apartment } from '@/types/api'
import { confirmationState } from './availabilityConfirmation'
import './comparison.i18n'

export function ListingFreshness({ apartment, detailed = false }: { apartment: Apartment; detailed?: boolean }) {
  const { t, i18n } = useTranslation('comparison')
  const userId = useAuthStore(s => s.user?.userId)
  const action = useFlowAction()
  const push = useToastStore(s => s.push)
  if (apartment.status !== 'Available' && apartment.status !== 'Negotiating') return null
  const state = confirmationState(apartment.lastConfirmedAt)
  return <div className="text-xs text-muted">
    <p>{t(state, { date: formatDate(apartment.lastConfirmedAt, i18n.language) })}</p>
    {detailed && <p className="mt-1">{t('note')}</p>}
    {detailed && userId === apartment.userId && <Button className="mt-2" size="sm" variant="secondary" disabled={action.isPending}
      onClick={() => action.mutate({ path: `/community/renewals/${apartment.apartmentId}`, body: { snooze: false } }, {
        onSuccess: () => push({ variant: 'success', title: t('confirmedNow') }),
      })}>{t('confirm')}</Button>}
  </div>
}
