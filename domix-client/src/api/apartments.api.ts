import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'
import type {
  Apartment,
  ApartmentSearchQuery,
  CreateApartmentRequest,
  Guid,
  RateApartmentRequest,
  UpdateApartmentRequest,
} from '@/types/api'

/** .NET ApartmentController. The whole controller is `[Authorize]`. */

export async function getAllApartments(signal?: AbortSignal): Promise<Apartment[]> {
  const { data } = await dataClient.get<Apartment[]>(apiEndpoints.apartments.all(), { signal })
  return data
}

/** Distinct cities that currently have at least one listing, alphabetically. */
export async function getCities(signal?: AbortSignal): Promise<string[]> {
  const { data } = await dataClient.get<string[]>(apiEndpoints.apartments.cities(), { signal })
  return data
}

/**
 * Server-side filtering. Undefined members are stripped so we never send
 * `?minPrice=` — an empty string binds as null on the server but pollutes the
 * URL and, more importantly, the React Query cache key.
 */
export async function searchApartments(
  query: ApartmentSearchQuery,
  signal?: AbortSignal,
): Promise<Apartment[]> {
  const params: Record<string, string | number | boolean> = {}

  if (query.city?.trim()) params.city = query.city.trim()
  if (query.area?.trim()) params.area = query.area.trim()
  if (typeof query.minPrice === 'number') params.minPrice = query.minPrice
  if (typeof query.maxPrice === 'number') params.maxPrice = query.maxPrice
  if (typeof query.minRooms === 'number') params.minRooms = query.minRooms
  if (typeof query.maxRooms === 'number') params.maxRooms = query.maxRooms
  if (query.propertyType) params.propertyType = query.propertyType
  if (typeof query.parking === 'boolean') params.parking = query.parking
  if (typeof query.elevator === 'boolean') params.elevator = query.elevator
  if (query.sortBy) params.sortBy = query.sortBy

  const { data } = await dataClient.get<Apartment[]>(apiEndpoints.apartments.search(), {
    params,
    signal,
  })
  return data
}

/**
 * Creates a listing owned by the authenticated user (taken from the `userId`
 * claim). The server geocodes `city` + `address` via Nominatim to populate
 * latitude/longitude, so a create can take a moment longer than a plain insert.
 */
export async function createApartment(payload: CreateApartmentRequest): Promise<Apartment> {
  const { data } = await dataClient.post<Apartment>(apiEndpoints.apartments.create(), payload)
  return data
}

/**
 * Full replace of a listing's editable fields. The server enforces ownership
 * (403 when the caller isn't the listing's owner, 404 when the id doesn't
 * exist) and re-geocodes when `city`/`address` change, same as create.
 */
export async function updateApartment(
  apartmentId: Guid,
  payload: UpdateApartmentRequest,
): Promise<Apartment> {
  const { data } = await dataClient.put<Apartment>(
    apiEndpoints.apartments.update(apartmentId),
    payload,
  )
  return data
}

/**
 * Deletes a listing. The server enforces the same ownership-or-privileged
 * rule as update (403/404), and answers 409 when related records (e.g.
 * appointments) still reference the apartment.
 */
export async function deleteApartment(apartmentId: Guid): Promise<void> {
  await dataClient.delete(apiEndpoints.apartments.remove(apartmentId))
}

/**
 * Folds a 1-5 score into the listing's running average. The server rejects
 * (400) rating a listing you own — there's no way to rate your own apartment.
 */
export async function rateApartment(apartmentId: Guid, payload: RateApartmentRequest): Promise<Apartment> {
  const { data } = await dataClient.post<Apartment>(apiEndpoints.apartments.rate(apartmentId), payload)
  return data
}
