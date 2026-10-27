import { z } from 'zod'
import { PROPERTY_TYPES, SORT_OPTIONS } from '@/types/api'
import type { Apartment, CreateApartmentRequest, UpdateApartmentRequest } from '@/types/api'

/**
 * Native number inputs round-trip through strings, and an empty optional
 * field arrives as `""` — `z.coerce.number()` would turn that into `0`
 * instead of leaving it unset. This normalises `""`/`null` to `undefined`
 * before the wrapped schema (and its coercion) ever sees the value.
 */
function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (val === '' || val === null ? undefined : val), schema.optional())
}

/**
 * Shared by the create and edit forms — mirrors `CreateApartmentDTO` /
 * `UpdateApartmentDTO` on the backend (see domix-server ApartmentDTO.cs).
 * Listing status (Available/Rented/Sold) is changed separately via the
 * dedicated status action, not through this form.
 */
export const apartmentFormSchema = z.object({
  listingType: z.enum(['Unspecified', 'Exchange', 'Rent', 'Sale']).optional(),
  availableFrom: z.string().optional(),
  availableTo: z.string().optional(),
  desiredCity: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1, 'validation.city').max(100, 'validation.long'),
  address: z.string().trim().min(1, 'validation.address').max(200, 'validation.long'),
  area: z.string().trim().min(1, 'validation.area').max(100, 'validation.long'),
  price: z.coerce
    .number({ error: 'validation.price' })
    .nonnegative('validation.price')
    .max(1_000_000_000, 'validation.price')
    .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'validation.price'),
  description: emptyToUndefined(z.string().trim().max(2000, 'validation.long')),
  squareMeters: emptyToUndefined(
    z.coerce.number().int('validation.integer').positive('validation.positive').max(100_000),
  ),
  sumOfRooms: emptyToUndefined(z.coerce.number().positive('validation.positive').max(100)),
  sumOfBeds: emptyToUndefined(z.coerce.number().int('validation.integer').nonnegative().max(100)),
  floor: emptyToUndefined(z.coerce.number().int('validation.integer').min(-5).max(300)),
  elevator: z.boolean().nullable().optional(),
  parking: z.boolean().nullable().optional(),
  propertyType: emptyToUndefined(z.enum(PROPERTY_TYPES)),
  isAnonymous: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.listingType === 'Exchange') {
    if (!data.availableFrom || !data.availableTo || data.availableTo <= data.availableFrom)
      ctx.addIssue({ code: 'custom', path: ['availableTo'], message: 'validation.dates' })
    if (!data.desiredCity?.trim())
      ctx.addIssue({ code: 'custom', path: ['desiredCity'], message: 'validation.destination' })
  } else if (data.price <= 0) {
    ctx.addIssue({ code: 'custom', path: ['price'], message: 'validation.price' })
  }
})

/** Parsed/coerced shape — what `onSubmit` receives and what the API mappers below consume. */
export type ApartmentFormValues = z.output<typeof apartmentFormSchema>
/** Raw shape RHF's `register()` fields hold before Zod coercion runs (numbers arrive as `unknown` pre-parse). */
export type ApartmentFormInput = z.input<typeof apartmentFormSchema>

export const APARTMENT_FORM_DEFAULTS: ApartmentFormValues = {
  listingType: 'Exchange',
  availableFrom: '',
  availableTo: '',
  desiredCity: '',
  city: '',
  address: '',
  area: '',
  price: 0,
  description: '',
  squareMeters: undefined,
  sumOfRooms: undefined,
  sumOfBeds: undefined,
  floor: undefined,
  elevator: false,
  parking: false,
  propertyType: undefined,
  isAnonymous: false,
}

export function apartmentToFormValues(apartment: Apartment): ApartmentFormValues {
  return {
    listingType: apartment.listingType ?? 'Unspecified',
    availableFrom: apartment.availableFrom ?? '',
    availableTo: apartment.availableTo ?? '',
    desiredCity: apartment.desiredCity ?? '',
    city: apartment.city,
    address: apartment.address,
    area: apartment.area,
    price: apartment.price,
    description: apartment.description ?? '',
    squareMeters: apartment.squareMeters ?? undefined,
    sumOfRooms: apartment.sumOfRooms ?? undefined,
    sumOfBeds: apartment.sumOfBeds ?? undefined,
    floor: apartment.floor ?? undefined,
    elevator: apartment.elevator ?? null,
    parking: apartment.parking ?? null,
    propertyType: (apartment.propertyType as ApartmentFormValues['propertyType']) ?? undefined,
    isAnonymous: apartment.isAnonymous,
  }
}

export function toCreateApartmentRequest(values: ApartmentFormValues): CreateApartmentRequest {
  return {
    listingType: values.listingType ?? 'Unspecified',
    availableFrom: values.listingType === 'Exchange' ? values.availableFrom || null : null,
    availableTo: values.listingType === 'Exchange' ? values.availableTo || null : null,
    desiredCity: values.listingType === 'Exchange' ? values.desiredCity || null : null,
    city: values.city,
    address: values.address,
    area: values.area,
    price: values.price,
    description: values.description || null,
    squareMeters: values.squareMeters ?? null,
    sumOfRooms: values.sumOfRooms ?? null,
    sumOfBeds: values.sumOfBeds ?? null,
    floor: values.floor ?? null,
    elevator: values.elevator ?? null,
    parking: values.parking ?? null,
    propertyType: values.propertyType ?? null,
    isAnonymous: values.isAnonymous ?? false,
  }
}

export function toUpdateApartmentRequest(values: ApartmentFormValues): UpdateApartmentRequest {
  return {
    ...toCreateApartmentRequest(values),
  }
}

/** Search/filter bar above the catalog. All fields optional — an empty form matches everything. */
const optionalSearchBoolean = z.preprocess(
  value => value === '' ? undefined : value === 'true' ? true : value === 'false' ? false : value,
  z.boolean().optional(),
)

export const apartmentSearchSchema = z
  .object({
    city: z.string().trim().optional(),
    area: z.string().trim().optional(),
    minPrice: emptyToUndefined(z.coerce.number().nonnegative()),
    maxPrice: emptyToUndefined(z.coerce.number().nonnegative()),
    minRooms: emptyToUndefined(z.coerce.number().nonnegative()),
    maxRooms: emptyToUndefined(z.coerce.number().nonnegative()),
    propertyType: emptyToUndefined(z.enum(PROPERTY_TYPES)),
    parking: optionalSearchBoolean,
    elevator: optionalSearchBoolean,
    sortBy: emptyToUndefined(z.enum(SORT_OPTIONS)),
  })
  .refine((data) => data.minPrice == null || data.maxPrice == null || data.minPrice <= data.maxPrice, {
    message: 'validation.priceRange',
    path: ['maxPrice'],
  })
  .refine((data) => data.minRooms == null || data.maxRooms == null || data.minRooms <= data.maxRooms, {
    message: 'validation.roomsRange',
    path: ['maxRooms'],
  })

export type ApartmentSearchFormValues = z.output<typeof apartmentSearchSchema>
export type ApartmentSearchFormInput = z.input<typeof apartmentSearchSchema>

export const APARTMENT_SEARCH_DEFAULTS: ApartmentSearchFormValues = {
  city: '',
  area: '',
  minPrice: undefined,
  maxPrice: undefined,
  minRooms: undefined,
  maxRooms: undefined,
  propertyType: undefined,
  parking: undefined,
  elevator: undefined,
  sortBy: undefined,
}
