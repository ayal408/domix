import type { Guid } from '@/types/api'

/**
 * Every backend route the client is allowed to call, in one place.
 * Paths are relative to the corresponding axios instance's `baseURL`
 * (`dataClient` -> VITE_API_URL, `authClient` -> VITE_AUTH_URL).
 *
 * Path segments are encoded here so callers cannot accidentally build a
 * malformed or injectable URL from user input.
 */

const seg = (value: string): string => encodeURIComponent(value)

/** Express auth service — auth-server/src/routes/authRoutes.js */
export const authEndpoints = {
  login: () => '/login',
  register: () => '/register',
  google: () => '/google',
  refresh: () => '/refresh',
  logout: () => '/logout',
  me: () => '/me',
  verifyEmail: () => '/verify-email',
  resendVerification: () => '/resend-verification',
  forgotPassword: () => '/forgot-password',
  resetPassword: () => '/reset-password',
} as const

/** .NET data API — domix-server/ApartmentAPI/Controllers */
export const apiEndpoints = {
  users: {
    byId: (userId: Guid) => `/User/by-id/${seg(userId)}`,
    byEmail: (email: string) => `/User/by-email/${seg(email)}`,
    byUsername: (username: string) => `/User/by-username/${seg(username)}`,
    byGoogleId: (googleId: string) => `/User/by-google-id/${seg(googleId)}`,
    lookup: () => '/User/lookup',
    create: () => '/User',
    linkGoogle: () => '/User/link-google',
    linkPassword: () => '/User/link-password',
    profileImage: () => '/User/profile-image',
    all: () => '/User/all',
    block: (userId: Guid) => `/User/${seg(userId)}/block`,
    unblock: (userId: Guid) => `/User/${seg(userId)}/unblock`,
    theme: () => '/User/theme',
    remove: (userId: Guid) => `/User/${seg(userId)}`,
  },
  apartments: {
    all: () => '/Apartment/all',
    cities: () => '/Apartment/cities',
    search: () => '/Apartment/Search',
    create: () => '/Apartment',
    update: (apartmentId: Guid) => `/Apartment/${seg(apartmentId)}`,
    remove: (apartmentId: Guid) => `/Apartment/${seg(apartmentId)}`,
    rate: (apartmentId: Guid) => `/Apartment/${seg(apartmentId)}/rate`,
    setStatus: (apartmentId: Guid) => `/Apartment/${seg(apartmentId)}/status`,
  },
  address: {
    cities: () => '/Address/cities',
    streets: () => '/Address/streets',
  },
  favorites: {
    list: () => '/Favorite',
    add: (apartmentId: Guid) => `/Favorite/${seg(apartmentId)}`,
    remove: (apartmentId: Guid) => `/Favorite/${seg(apartmentId)}`,
  },
  savedSearches: {
    list: () => '/SavedSearch',
    create: () => '/SavedSearch',
    remove: (savedSearchId: Guid) => `/SavedSearch/${seg(savedSearchId)}`,
  },
  apartmentImages: {
    all: () => '/ApartmentImage',
    create: () => '/ApartmentImage',
    upload: () => '/ApartmentImage/upload',
  },
  messages: {
    send: () => '/Message',
    inbox: (ownerId: Guid) => `/Message/owner/${seg(ownerId)}`,
    archived: (ownerId: Guid) => `/Message/owner/${seg(ownerId)}/archived`,
    archive: (messageId: Guid) => `/Message/archive/${seg(messageId)}`,
    markRead: (messageId: Guid) => `/Message/read/${seg(messageId)}`,
    remove: (messageId: Guid) => `/Message/${seg(messageId)}`,
  },
  chat: {
    stream: () => '/Chat/stream',
  },
  support: {
    create: () => '/Support',
    list: () => '/Support',
    resolve: (ticketId: Guid) => `/Support/${seg(ticketId)}/resolve`,
  },
  notifications: {
    feed: () => '/Notification',
    markSeen: () => '/Notification/mark-seen',
    create: () => '/Notification',
  },
  analytics: {
    summary: () => '/Analytics/summary',
  },
  health: {
    dbQuery: () => '/health/db-query',
  },
  email: {
    sendTest: () => '/email/send-test',
  },
} as const
