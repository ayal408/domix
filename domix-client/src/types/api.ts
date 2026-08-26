/**
 * Transport types mirroring the backend contracts 1:1.
 *
 * Source of truth:
 *  - domix-server/ApartmentAPI/DTOs/*.cs   (.NET data API)
 *  - auth-server/src/utils/mapper.js       (Express auth service)
 *
 * ASP.NET Core serialises with the camelCase naming policy by default, so a C#
 * `public Guid ApartmentId` arrives as `apartmentId`. Properties that are
 * already declared lowercase in C# (`city`, `price`, `floor`, ...) are
 * unchanged. Model binding on the way back is case-insensitive, so the same
 * camelCase shape is valid for request bodies.
 */

export type Guid = string
/** ISO-8601 string produced by System.Text.Json for `DateTime`. */
export type IsoDateTime = string

// ---------------------------------------------------------------------------
// Roles & authorization
// ---------------------------------------------------------------------------

/** `User.Role` on the server; defaults to "User" for every created account. */
export const ROLES = ['User', 'Manager', 'Admin'] as const
export type Role = (typeof ROLES)[number]

/**
 * Client mirrors of the server-side authorization policies.
 * `AdminOnly` is applied to EmailController; `ManagerOrAdmin` covers the
 * elevated management surfaces.
 */
export const POLICY_ROLES = {
  AdminOnly: ['Admin'],
  ManagerOrAdmin: ['Manager', 'Admin'],
  Authenticated: ['User', 'Manager', 'Admin'],
} as const satisfies Record<string, readonly Role[]>

export type PolicyName = keyof typeof POLICY_ROLES

/** `User.RegistrationMethod` — set by the server, never chosen by the client. */
export type RegistrationMethod = 'Password' | 'Google' | 'Password+Google' | 'Facebook' | 'OTP'

// ---------------------------------------------------------------------------
// Users — DTOs/UserDto.cs
// ---------------------------------------------------------------------------

/** `UserResponseDto` — the canonical user projection from the data API. */
export interface UserResponse {
  userId: Guid
  userName: string
  registrationMethod: RegistrationMethod
  googleId?: string | null
  emailAddress?: string | null
  phoneNumber?: string | null
  /** Authoritative role. The JWT carries no role claim — see docs/INTEGRATION.md. */
  role: Role
  joiningDate: IsoDateTime
  profileColor?: string | null
  /** Raw base64 PNG bytes, without a `data:` prefix. */
  profileImageBase64?: string | null
}

/** `UserDto` — request body for `POST /api/User` and `POST /api/auth`. */
export interface CreateUserRequest {
  userName: string
  registrationMethod: RegistrationMethod
  passwordHash?: string | null
  emailAddress?: string | null
  phoneNumber?: string | null
  profileImageBase64?: string | null
}

/** `UpdateProfileImageDto` — `PUT /api/User/profile-image`. */
export interface UpdateProfileImageRequest {
  /** Base64 payload; a `data:image/...;base64,` prefix is accepted and stripped server-side. */
  profileImage: string
}

/** `LinkGoogleDto` — `PUT /api/User/link-google`. */
export interface LinkGoogleRequest {
  userId: Guid
  googleId: string
}

/** `LinkPasswordDto` — `PUT /api/User/link-password`. */
export interface LinkPasswordRequest {
  userId: Guid
  passwordHash: string
  userName?: string | null
}

/** Query for `GET /api/User/lookup`. At least one field must be supplied. */
export interface UserLookupQuery {
  email?: string
  username?: string
  googleId?: string
}

// ---------------------------------------------------------------------------
// Auth service — auth-server/src/utils/mapper.js
// ---------------------------------------------------------------------------

/**
 * `mapUser()` output. Deliberately narrower than `UserResponse`: the auth
 * service never returns `role`, which is why the session hydrates the full
 * profile from the data API immediately after a successful sign-in.
 */
export interface AuthUser {
  userId: Guid
  userName: string
  email: string | null
  phone: string | null
  googleId: string | null
  registrationMethod: RegistrationMethod
  profileImageBase64: string | null
  token?: string | null
}

export interface AuthSessionResponse {
  user: AuthUser
  accessToken: string
}

export interface RefreshResponse {
  accessToken: string
}

export interface LoginRequest {
  userName: string
  password: string
}

export interface RegisterRequest {
  userName: string
  email: string
  password: string
  phone?: string
}

export interface GoogleLoginRequest {
  idToken: string
}

/** Claims minted by auth-server/src/utils/jwt.js `createAccessToken`. */
export interface AccessTokenClaims {
  userId: Guid
  userName: string
  email?: string | null
  googleId?: string | null
  aud: string
  iss: string
  /** Expiry, seconds since epoch. */
  exp: number
  iat: number
}

// ---------------------------------------------------------------------------
// Apartments — DTOs/ApartmentDTO.cs
// ---------------------------------------------------------------------------

/** `ApartmentImageDTO`. */
export interface ApartmentImage {
  imageId: Guid
  apartmentId: Guid
  imageUrl: string
  createdAt: IsoDateTime
}

/** `Apartment.PropertyType` on the server — a plain string column, constrained client-side to this fixed set. */
export const PROPERTY_TYPES = ['Apartment', 'House', 'Studio', 'Penthouse', 'Garden', 'Duplex', 'Other'] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

/** `ApartmentDTO`. */
export interface Apartment {
  apartmentId: Guid
  userId: Guid
  /** `true` while the listing is live. */
  status: boolean
  price: number
  date: IsoDateTime
  city: string
  area: string
  address: string
  description?: string | null
  squareMeters?: number | null
  sumOfRooms?: number | null
  sumOfBeds?: number | null
  floor?: number | null
  elevator?: boolean | null
  parking?: boolean | null
  propertyType?: string | null
  dateInsert: IsoDateTime
  latitude?: number | null
  longitude?: number | null
  /** Running average, 0-5. 0 with `ratingCount` 0 means unrated. */
  rating: number
  ratingCount: number
  apartmentImages?: ApartmentImage[] | null
}

/**
 * `CreateApartmentDTO` — `POST /api/Apartment`.
 *
 * The controller rejects the request unless `city`, `address` and `area` are
 * non-blank and `price > 0`; `area` is optional on the DTO but required by that
 * guard, so it is required here too.
 */
export interface CreateApartmentRequest {
  city: string
  address: string
  area: string
  price: number
  description?: string | null
  squareMeters?: number | null
  sumOfRooms?: number | null
  sumOfBeds?: number | null
  floor?: number | null
  elevator?: boolean | null
  parking?: boolean | null
  propertyType?: string | null
}

/**
 * `UpdateApartmentDTO` — `PUT /api/Apartment/{id}`.
 *
 * A full replace of the editable fields (mirrors `CreateApartmentRequest`),
 * plus `status` to let the owner take a listing on/off the market. The
 * controller re-geocodes when `city`/`address` change, same as on create, so
 * an edit that only moves the listing can take a moment longer.
 */
export interface UpdateApartmentRequest {
  city: string
  address: string
  area: string
  price: number
  description?: string | null
  squareMeters?: number | null
  sumOfRooms?: number | null
  sumOfBeds?: number | null
  floor?: number | null
  elevator?: boolean | null
  parking?: boolean | null
  propertyType?: string | null
  /** Omit to leave the current live/inactive state unchanged. */
  status?: boolean
}

/** `RateApartmentDTO` — `POST /api/Apartment/{id}/rate`. The controller rejects the owner's own listing. */
export interface RateApartmentRequest {
  score: number
}

export const SORT_OPTIONS = ['newest', 'price_asc', 'price_desc', 'rating'] as const
export type SortOption = (typeof SORT_OPTIONS)[number]

/** Query string accepted by `GET /api/Apartment/Search`. */
export interface ApartmentSearchQuery {
  city?: string
  area?: string
  minPrice?: number
  maxPrice?: number
  minRooms?: number
  maxRooms?: number
  propertyType?: string
  parking?: boolean
  elevator?: boolean
  sortBy?: SortOption
}

/** `UploadImageDto` — multipart body for `POST /api/ApartmentImage/upload`. */
export interface UploadImageRequest {
  apartmentId: Guid
  image: File
}

/** `ApartmentImageDTO` body for `POST /api/ApartmentImage`. */
export interface CreateApartmentImageRequest {
  apartmentId: Guid
  imageUrl: string
}

// ---------------------------------------------------------------------------
// Favorites — DTOs/FavoriteDTO.cs
// ---------------------------------------------------------------------------

/** `FavoriteDTO`. */
export interface Favorite {
  favoriteId: Guid
  apartmentId: Guid
  createdAt: IsoDateTime
  apartment?: Apartment | null
}

// ---------------------------------------------------------------------------
// Saved searches — DTOs/SavedSearchDTO.cs
// ---------------------------------------------------------------------------

/** `SavedSearchDTO`. */
export interface SavedSearch {
  savedSearchId: Guid
  name: string
  city?: string | null
  area?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  minRooms?: number | null
  maxRooms?: number | null
  propertyType?: string | null
  parking?: boolean | null
  elevator?: boolean | null
  createdAt: IsoDateTime
}

/** `CreateSavedSearchDTO` — `POST /api/SavedSearch`. */
export interface CreateSavedSearchRequest {
  name: string
  city?: string | null
  area?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  minRooms?: number | null
  maxRooms?: number | null
  propertyType?: string | null
  parking?: boolean | null
  elevator?: boolean | null
}

// ---------------------------------------------------------------------------
// Messages — DTOs/MessageDto.cs
// ---------------------------------------------------------------------------

/** `MessageResponseDto`. */
export interface Message {
  messageId: Guid
  senderId: Guid
  senderName?: string | null
  ownerId: Guid
  ownerName?: string | null
  content: string
  createdAt: IsoDateTime
  isRead: boolean
  readAt?: IsoDateTime | null
  senderImageBase64?: string | null
  isDeleted: boolean
  isArchived: boolean
  archivedAt?: IsoDateTime | null
  deletedAt?: IsoDateTime | null
}

/**
 * `CreateMessageDto` — `POST /api/Message`.
 * `senderId` is present on the contract but the controller always overwrites it
 * with the authenticated `userId` claim, so it is informational only.
 */
export interface CreateMessageRequest {
  senderId: Guid
  ownerId: Guid
  content: string
}

export interface InboxQuery {
  page: number
  pageSize: number
}

// ---------------------------------------------------------------------------
// Ops — HealthController / EmailController
// ---------------------------------------------------------------------------

export interface HealthStatus {
  status: 'healthy' | 'error'
  timestamp?: IsoDateTime
  message?: string
}

export interface SendTestEmailResponse {
  message: string
}

// ---------------------------------------------------------------------------
// Errors — Models/ErrorResponse.cs, plus the auth service's `{ code }` shape
// ---------------------------------------------------------------------------

export interface ApiErrorResponse {
  statusCode?: number
  message?: string
  details?: string
  traceId?: string
  timestamp?: IsoDateTime
  /** Auth service error identifier, e.g. `USER_NOT_FOUND`. */
  code?: string
  /** ASP.NET Core model-validation problem details. */
  errors?: Record<string, string[]>
  title?: string
}

/** Error identifiers thrown by auth-server/src/services/authService.js. */
export const AUTH_ERROR_CODES = [
  'USER_NOT_FOUND',
  'NO_PASSWORD_ACCOUNT',
  'INVALID_PASSWORD',
  'EMAIL_EXISTS',
  'INVALID_GOOGLE_TOKEN',
  'NO_TOKEN',
  'INVALID_TOKEN',
] as const
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number]
