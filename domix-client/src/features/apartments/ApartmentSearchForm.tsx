import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import {
  apartmentSearchSchema,
  APARTMENT_SEARCH_DEFAULTS,
  type ApartmentSearchFormInput,
  type ApartmentSearchFormValues,
} from '@/features/apartments/schemas'
import { InputField, SelectField, CheckboxField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useCities } from '@/hooks/useApartments'
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
    formState: { errors },
  } = useForm<ApartmentSearchFormInput, unknown, ApartmentSearchFormValues>({
    resolver: zodResolver(apartmentSearchSchema),
    defaultValues: initialValues ?? APARTMENT_SEARCH_DEFAULTS,
  })

  function handleClear() {
    reset(APARTMENT_SEARCH_DEFAULTS)
    onClear()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6"
    >
      <div className="col-span-2 sm:col-span-1">
        <InputField
          label={t('apartments.filters.city')}
          placeholder={t('apartments.filters.cityPlaceholder')}
          list="domix-cities"
          {...register('city')}
        />
        <datalist id="domix-cities">
          {cities?.map((city) => <option key={city} value={city} />)}
        </datalist>
      </div>
      <InputField
        label={t('apartments.filters.minPrice')}
        type="number"
        min={0}
        inputMode="numeric"
        error={errors.minPrice?.message}
        {...register('minPrice')}
      />
      <InputField
        label={t('apartments.filters.maxPrice')}
        type="number"
        min={0}
        inputMode="numeric"
        error={errors.maxPrice?.message}
        {...register('maxPrice')}
      />
      <InputField
        label={t('apartments.filters.minRooms')}
        type="number"
        min={0}
        step="0.5"
        inputMode="decimal"
        error={errors.minRooms?.message}
        {...register('minRooms')}
      />
      <InputField
        label={t('apartments.filters.maxRooms')}
        type="number"
        min={0}
        step="0.5"
        inputMode="decimal"
        error={errors.maxRooms?.message}
        {...register('maxRooms')}
      />
      <div className="col-span-2 sm:col-span-1">
        <InputField
          label={t('apartments.filters.area')}
          placeholder={t('apartments.filters.areaPlaceholder')}
          {...register('area')}
        />
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
      <div className="col-span-2 flex items-end gap-4 sm:col-span-1">
        <CheckboxField label={t('apartments.filters.elevator')} {...register('elevator')} />
        <CheckboxField label={t('apartments.filters.parking')} {...register('parking')} />
      </div>
      <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-1">
        <Button type="submit" className="flex-1">
          {t('apartments.filters.apply')}
        </Button>
        <Button type="button" variant="secondary" onClick={handleClear}>
          {t('apartments.filters.clear')}
        </Button>
      </div>
    </form>
  )
}
