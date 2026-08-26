import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'
import type {
  ApartmentImage,
  CreateApartmentImageRequest,
  UploadImageRequest,
} from '@/types/api'

/** .NET ApartmentImageController. `[Authorize]` on every action. */

export async function getAllImages(signal?: AbortSignal): Promise<ApartmentImage[]> {
  const { data } = await dataClient.get<ApartmentImage[]>(apiEndpoints.apartmentImages.all(), {
    signal,
  })
  return data
}

/** Registers an image that is already hosted elsewhere, by URL. */
export async function createImage(
  payload: CreateApartmentImageRequest,
): Promise<ApartmentImage> {
  const { data } = await dataClient.post<ApartmentImage>(
    apiEndpoints.apartmentImages.create(),
    payload,
  )
  return data
}

/**
 * Uploads a file as `multipart/form-data`.
 *
 * The form field names must match `UploadImageDto` exactly (`ApartmentId`,
 * `Image`); ASP.NET Core form binding is case-insensitive, so camelCase is
 * accepted. The Content-Type header is intentionally left unset — the request
 * interceptor removes it for FormData so the browser can add the boundary.
 */
export async function uploadImage(
  { apartmentId, image }: UploadImageRequest,
  onProgress?: (percent: number) => void,
): Promise<ApartmentImage> {
  const form = new FormData()
  form.append('apartmentId', apartmentId)
  form.append('image', image)

  const { data } = await dataClient.post<ApartmentImage>(
    apiEndpoints.apartmentImages.upload(),
    form,
    {
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return
        onProgress(Math.round((event.loaded * 100) / event.total))
      },
    },
  )
  return data
}
