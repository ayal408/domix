import { useMutation, useQuery } from '@tanstack/react-query'
import * as usersApi from '@/api/users.api'
import { queryKeys } from '@/api/queryKeys'
import { useAuthStore } from '@/stores/auth.store'
import type { Guid, UpdateProfileImageRequest } from '@/types/api'

/** Updates the signed-in user's avatar and refreshes the cached profile on success. */
export function useUpdateProfileImage() {
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: (payload: UpdateProfileImageRequest) => usersApi.updateProfileImage(payload),
    onSuccess: (user) => setUser(user),
  })
}

/** Profile lookup for someone other than the signed-in user (e.g. a listing's owner). */
export function useUserById(userId: Guid | undefined) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId ?? ''),
    queryFn: () => usersApi.getUserById(userId as Guid),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
