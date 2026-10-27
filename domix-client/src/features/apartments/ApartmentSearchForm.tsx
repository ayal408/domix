import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import {
  apartmentSearchSchema,
  APARTMENT_SEARCH_DEFAULTS,
  type ApartmentSearchFormInput,
  type ApartmentSearchFormValues,
} from '@/features/apartments/schemas'
import { RangeFilter } from '@/components/ui/RangeFilter'
import { SelectField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useCities } from '@/hooks/useApartments'
import { useQuery } from '@tanstack/react-query'
import { dataClient } from '@/api/http'
import { PROPERTY_TYPES, SORT_OPTIONS } from '@/types/api'

interface Props {
  onSubmit: (values: ApartmentSearchFormValues) => void
  onClear: () => void
  /** Prefills the form — e.g. when arriving via a "run this saved search" link. */
  initialValues?: ApartmentSearchFormValues
}

export function ApartmentSearchForm({ onSubmit, onClear, initialValues }: Props) {
  const { t } = useTranslation()
  const { data: cities } = useCities()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<ApartmentSearchFormInput, unknown, ApartmentSearchFormValues>({
    resolver: zodResolver(apartmentSearchSchema),
    defaultValues: initialValues ?? APARTMENT_SEARCH_DEFAULTS,
  })

  const selectedCity = watch('city')
  const areas = useQuery({
    queryKey: ['apartment-filter-areas', selectedCity ?? ''],
    queryFn: async ({ signal }) => (await dataClient.get<string[]>('/Apartment/areas', { params: { city: selectedCity || undefined }, signal })).data,
    staleTime: 5 * 60 * 1000,
  })
  const includeSelected = (values: string[], selected?: string) => Array.from(new Set([...(selected ? [selected] : []), ...values]))
  const priceOptions = Array.from(new Set([0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000, 15000, 20000, 30000, 50000, 100000, 500000, 1000000, 2000000, 3000000, 5000000, 10000000, watch('minPrice'), watch('maxPrice')].filter((value): value is number => value != null && Number.isFinite(Number(value))).map(Number))).sort((a, b) => a - b)
  const roomOptions = Array.from(new Set([...Array.from({ length: 21 }, (_, index) => index / 2), 12, 15, 20, watch('minRooms'), watch('maxRooms')].filter((value): value is number => value != null && Number.isFinite(Number(value))).map(Number))).sort((a, b) => a - b)

  function handleClear() {
    reset({ ...APARTMENT_SEARCH_DEFAULTS, minPrice: '', maxPrice: '', minRooms: '', maxRooms: '', propertyType: '', sortBy: '', parking: '', elevator: '' })
    onClear()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6"
    >
      <div className="col-span-2 sm:col-span-1">
        <SelectField label={t('apartments.filters.city')} {...register('city', { onChange: () => setValue('area', '') })}>
          <option value="">{t('apartments.filters.cityPlaceholder')}</option>
          {includeSelected(cities ?? [], watch('city')).map(city => <option key={city} value={city}>{city}</option>)}
        </SelectField>
      </div>
      {(['Price', 'Rooms'] as const).map(kind => {
        const min = `min${kind}` as const, max = `max${kind}` as const
        return <RangeFilter key={kind} minLabel={t(`apartments.filters.${min}`)} maxLabel={t(`apartments.filters.${max}`)} anyLabel={t('apartments.filters.any')}
          minValue={watch(min)} maxValue={watch(max)} options={kind === 'Price' ? priceOptions : roomOptions} step={kind === 'Price' ? 1 : 0.5}
          minError={errors[min]?.message} maxError={errors[max]?.message}
          onMinChange={value => setValue(min, value, { shouldDirty: true, shouldValidate: true })}
          onMaxChange={value => setValue(max, value, { shouldDirty: true, shouldValidate: true })} />
      })}
      <div className="col-span-2 sm:col-span-1">
        <SelectField label={t('apartments.filters.area')} disabled={areas.isFetching && !areas.data} {...register('area')}>
          <option value="">{t('apartments.filters.areaPlaceholder')}</option>
          {includeSelected(areas.data ?? [], watch('area')).map(area => <option key={area} value={area}>{area}</option>)}
        </SelectField>
        {areas.isError && <button type="button" onClick={() => void areas.refetch()} className="mt-1 text-xs text-danger underline">{t('common.retry')}</button>}
      </div>
      <SelectField label={t('apartments.filters.propertyType')} {...register('propertyType')}>
        <option value="">{t('apartments.filters.any')}</option>
        {PROPERTY_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`apartments.propertyTypes.${type}`)}
          </option>
        ))}
      </SelectField>
      <SelectField label={t('apartments.filters.sortBy')} {...register('sortBy')}>
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t(`apartments.sort.${option}`)}
          </option>
        ))}
      </SelectField>
      {(['elevator', 'parking'] as const).map(name => <Controller key={name} name={name} control={control} render={({ field }) => (
        <SelectField label={t(`apartments.filters.${name}`)} value={field.value == null ? '' : String(field.value)} onChange={event => field.onChange(event.target.value)}>
          <option value="">{t('apartments.filters.any')}</option><option value="true">{t('common.yes')}</option><option value="false">{t('common.no')}</option>
        </SelectField>
      )} />)}
      <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-2">
        <Button type="submit" className="flex-1 whitespace-nowrap">
          {t('apartments.filters.apply')}
        </Button>
        <Button type="button" variant="secondary" onClick={handleClear}>
          {t('apartments.filters.clear')}
        </Button>
      </div>
    </form>
  )
}
