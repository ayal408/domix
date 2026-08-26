import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import type {
  CreateUserRequest,
  Guid,
  LinkGoogleRequest,
  LinkPasswordRequest,
  UpdateProfileImageRequest,
  UserLookupQuery,
  UserResponse,
} from '@/types/api'

/** .NET UserController — the authority for profile data and, crucially, `role`. */

export async function getUserById(userId: Guid): Promise<UserResponse> {
  const { data } = await dataClient.get<UserResponse>(apiEndpoints.users.byId(userId))
  return data
}

export async function getUserByEmail(email: string): Promise<UserResponse> {
  const { data } = await dataClient.get<UserResponse>(apiEndpoints.users.byEmail(email))
  return data
}

export async function getUserByUsername(username: string): Promise<UserResponse> {
  const { data } = await dataClient.get<UserResponse>(apiEndpoints.users.byUsername(username))
  return data
}

export async function getUserByGoogleId(googleId: string): Promise<UserResponse> {
  const { data } = await dataClient.get<UserResponse>(apiEndpoints.users.byGoogleId(googleId))
  return data
}

/**
 * Unified lookup. Resolves to `null` on 404 so callers can use it as an
 * availability probe (e.g. "is this username free?") without try/catch.
 */
export async function lookupUser(query: UserLookupQuery): Promise<UserResponse | null> {
  try {
    const { data } = await dataClient.get<UserResponse>(apiEndpoints.users.lookup(), {
      params: query,
    })
    return data
  } catch (error) {
    if (toApiError(error).isNotFound) return null
    throw error
  }
}

export async function createUser(payload: CreateUserRequest): Promise<UserResponse> {
  const { data } = await dataClient.post<UserResponse>(apiEndpoints.users.create(), payload)
  return data
}

export async function linkGoogle(payload: LinkGoogleRequest): Promise<UserResponse> {
  const { data } = await dataClient.put<UserResponse>(apiEndpoints.users.linkGoogle(), payload)
  return data
}

export async function linkPassword(payload: LinkPasswordRequest): Promise<UserResponse> {
  const { data } = await dataClient.put<UserResponse>(apiEndpoints.users.linkPassword(), payload)
  return data
}

/**
 * Replaces the caller's avatar. The server takes the owning user from the JWT
 * `userId` claim, so no id is sent. It answers 400 when the bytes are identical
 * to the stored image — the mutation hook translates that into a no-op notice.
 */
export async function updateProfileImage(payload: UpdateProfileImageRequest): Promise<UserResponse> {
  const { data } = await dataClient.put<UserResponse>(
    apiEndpoints.users.profileImage(),
    payload,
  )
  return data
}
