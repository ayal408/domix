import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as imagesApi from '@/api/images.api'
import { queryKeys } from '@/api/queryKeys'
import type { UploadImageRequest } from '@/types/api'

/**
 * Uploads one apartment image. Invalidates the apartments list (which embeds
 * `apartmentImages`) rather than the images list, since every consumer of
 * this mutation renders images through an `Apartment`, not standalone.
 */
export function useUploadApartmentImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ request, onProgress }: { request: UploadImageRequest; onProgress?: (percent: number) => void }) =>
      imagesApi.uploadImage(request, onProgress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.apartments.all }),
  })
}
