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
  city: z.string().trim().min(1, 'City is required').max(100, 'City is too long'),
  address: z.string().trim().min(1, 'Address is required').max(200, 'Address is too long'),
  area: z.string().trim().min(1, 'Area / neighbourhood is required').max(100, 'Area is too long'),
  price: z.coerce
    .number({ error: 'Enter a valid price' })
    .positive('Price must be greater than 0')
    .max(1_000_000_000, 'Price is unrealistically high'),
  description: emptyToUndefined(z.string().trim().max(2000, 'Description is too long')),
  squareMeters: emptyToUndefined(
    z.coerce.number().int('Whole numbers only').positive('Must be greater than 0').max(100_000),
  ),
  sumOfRooms: emptyToUndefined(z.coerce.number().positive('Must be greater than 0').max(100)),
  sumOfBeds: emptyToUndefined(z.coerce.number().int('Whole numbers only').nonnegative().max(100)),
  floor: emptyToUndefined(z.coerce.number().int('Whole numbers only').min(-5).max(300)),
  elevator: z.boolean().optional(),
  parking: z.boolean().optional(),
  propertyType: emptyToUndefined(z.enum(PROPERTY_TYPES)),
  isAnonymous: z.boolean().optional(),
})

/** Parsed/coerced shape — what `onSubmit` receives and what the API mappers below consume. */
export type ApartmentFormValues = z.output<typeof apartmentFormSchema>
/** Raw shape RHF's `register()` fields hold before Zod coercion runs (numbers arrive as `unknown` pre-parse). */
export type ApartmentFormInput = z.input<typeof apartmentFormSchema>

export const APARTMENT_FORM_DEFAULTS: ApartmentFormValues = {
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
    city: apartment.city,
    address: apartment.address,
    area: apartment.area,
    price: apartment.price,
    description: apartment.description ?? '',
    squareMeters: apartment.squareMeters ?? undefined,
    sumOfRooms: apartment.sumOfRooms ?? undefined,
    sumOfBeds: apartment.sumOfBeds ?? undefined,
    floor: apartment.floor ?? undefined,
    elevator: apartment.elevator ?? false,
    parking: apartment.parking ?? false,
    propertyType: (apartment.propertyType as ApartmentFormValues['propertyType']) ?? undefined,
    isAnonymous: apartment.isAnonymous,
  }
}

export function toCreateApartmentRequest(values: ApartmentFormValues): CreateApartmentRequest {
  return {
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
export const apartmentSearchSchema = z
  .object({
    city: z.string().trim().optional(),
    area: z.string().trim().optional(),
    minPrice: emptyToUndefined(z.coerce.number().nonnegative()),
    maxPrice: emptyToUndefined(z.coerce.number().nonnegative()),
    minRooms: emptyToUndefined(z.coerce.number().nonnegative()),
    maxRooms: emptyToUndefined(z.coerce.number().nonnegative()),
    propertyType: emptyToUndefined(z.enum(PROPERTY_TYPES)),
    parking: z.boolean().optional(),
    elevator: z.boolean().optional(),
    sortBy: emptyToUndefined(z.enum(SORT_OPTIONS)),
  })
  .refine((data) => data.minPrice == null || data.maxPrice == null || data.minPrice <= data.maxPrice, {
    message: 'Minimum price must not exceed maximum price',
    path: ['maxPrice'],
  })
  .refine((data) => data.minRooms == null || data.maxRooms == null || data.minRooms <= data.maxRooms, {
    message: 'Minimum rooms must not exceed maximum rooms',
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
  parking: false,
  elevator: false,
  sortBy: undefined,
}
