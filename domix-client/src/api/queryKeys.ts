import type { ApartmentSearchQuery, Guid, InboxQuery } from '@/types/api'

/**
 * Centralised React Query keys.
 *
 * Hierarchical by design: invalidating `queryKeys.apartments.all` also
 * invalidates every list and search variant beneath it, which is what mutations
 * rely on after a create or an image upload.
 */
export const queryKeys = {
  session: ['session'] as const,

  users: {
    all: ['users'] as const,
    detail: (userId: Guid) => ['users', 'detail', userId] as const,
    lookup: (query: Record<string, string | undefined>) => ['users', 'lookup', query] as const,
  },

  apartments: {
    all: ['apartments'] as const,
    list: () => ['apartments', 'list'] as const,
    search: (query: ApartmentSearchQuery) => ['apartments', 'search', query] as const,
    cities: () => ['apartments', 'cities'] as const,
    detail: (apartmentId: Guid) => ['apartments', 'detail', apartmentId] as const,
  },

  images: {
    all: ['images'] as const,
    list: () => ['images', 'list'] as const,
  },

  messages: {
    all: ['messages'] as const,
    inbox: (ownerId: Guid, query: InboxQuery) =>
      ['messages', 'inbox', ownerId, query] as const,
    archived: (ownerId: Guid) => ['messages', 'archived', ownerId] as const,
  },

  favorites: {
    all: ['favorites'] as const,
    list: () => ['favorites', 'list'] as const,
  },

  savedSearches: {
    all: ['savedSearches'] as const,
    list: () => ['savedSearches', 'list'] as const,
  },

  ops: {
    health: ['ops', 'health'] as const,
  },
} as const
