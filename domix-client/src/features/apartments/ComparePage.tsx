import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useApartments } from '@/hooks/useApartments'
import { useCompareStore } from '@/stores/compare.store'
import { formatArea, formatCurrency } from '@/lib/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import type { Apartment } from '@/types/api'

interface Row {
  label: string
  render: (apartment: Apartment, language: string) => React.ReactNode
}

export default function ComparePage() {
  const { t, i18n } = useTranslation()
  const { data: allApartments, isLoading } = useApartments()
  const apartmentIds = useCompareStore((state) => state.apartmentIds)
  const removeFromCompare = useCompareStore((state) => state.remove)
  const clearCompare = useCompareStore((state) => state.clear)

  const apartments = useMemo(
    () => apartmentIds.map((id) => allApartments?.find((a) => a.apartmentId === id)).filter((a): a is Apartment => !!a),
    [allApartments, apartmentIds],
  )

  const rows: Row[] = [
    { label: t('apartments.fields.price'), render: (a, lang) => formatCurrency(a.price, lang) },
    { label: t('apartments.filters.city'), render: (a) => `${a.city} · ${a.area}` },
    { label: t('apartments.fields.sumOfRooms'), render: (a) => a.sumOfRooms ?? '—' },
    { label: t('apartments.fields.sumOfBeds'), render: (a) => a.sumOfBeds ?? '—' },
    { label: t('apartments.fields.squareMeters'), render: (a, lang) => formatArea(a.squareMeters, lang) },
    { label: t('apartments.fields.floor'), render: (a) => a.floor ?? '—' },
    {
      label: t('apartments.fields.propertyType'),
      render: (a) => (a.propertyType ? t(`apartments.propertyTypes.${a.propertyType}`) : '—'),
    },
    { label: t('apartments.fields.elevator'), render: (a) => (a.elevator ? t('common.yes') : t('common.no')) },
    { label: t('apartments.fields.parking'), render: (a) => (a.parking ? t('common.yes') : t('common.no')) },
    {
      label: t('apartments.fields.rating'),
      render: (a) => (a.ratingCount > 0 ? `${a.rating.toFixed(1)} (${a.ratingCount})` : '—'),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('compare.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('compare.subtitle')}</p>
        </div>
        {apartments.length > 0 && (
          <Button variant="secondary" size="sm" onClick={clearCompare}>
            {t('compare.clearAll')}
          </Button>
        )}
      </div>

      {!isLoading && apartments.length === 0 ? (
        <EmptyState
          title={t('compare.empty.title')}
          description={t('compare.empty.description')}
          action={
            <Link to="/" className="text-sm font-medium text-primary hover:underline">
              {t('apartments.detail.back')}
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-start">
            <thead>
              <tr>
                <th className="w-40 p-2 text-start text-xs font-medium uppercase tracking-wide text-muted" />
                {apartments.map((apartment) => (
                  <th key={apartment.apartmentId} className="min-w-[180px] p-2 text-start align-top">
                    <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3">
                      <Link to={`/apartments/${apartment.apartmentId}`} className="text-sm font-semibold text-primary hover:underline">
                        {apartment.city} · {apartment.area}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeFromCompare(apartment.apartmentId)}
                        aria-label={t('compare.remove')}
                        className="text-muted hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <th className="p-2 text-start text-sm font-medium text-muted">{row.label}</th>
                  {apartments.map((apartment) => (
                    <td key={apartment.apartmentId} className="p-2 text-sm text-foreground">
                      {row.render(apartment, i18n.language)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
