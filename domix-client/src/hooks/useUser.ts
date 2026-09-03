import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/** Manager/Admin only — the admin user list. */
export function useAllUsers() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: ({ signal }) => usersApi.getAllUsers(signal),
  })
}

function useSetUserBlocked() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, blocked }: { userId: Guid; blocked: boolean }) =>
      blocked ? usersApi.blockUser(userId) : usersApi.unblockUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  })
}

/** Admin only. */
export function useBlockUser() {
  const mutation = useSetUserBlocked()
  return { ...mutation, mutate: (userId: Guid) => mutation.mutate({ userId, blocked: true }), mutateAsync: (userId: Guid) => mutation.mutateAsync({ userId, blocked: true }) }
}

/** Self or Admin — server enforces (403 otherwise). */
export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: Guid) => usersApi.deleteAccount(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  })
}

/** Admin only. */
export function useUnblockUser() {
  const mutation = useSetUserBlocked()
  return { ...mutation, mutate: (userId: Guid) => mutation.mutate({ userId, blocked: false }), mutateAsync: (userId: Guid) => mutation.mutateAsync({ userId, blocked: false }) }
}
