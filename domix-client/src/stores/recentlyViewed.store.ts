import { create } from 'zustand'
import type { Guid } from '@/types/api'

export const MAX_RECENTLY_VIEWED = 8
interface RecentlyViewedState {
  ownerId: Guid | null
  apartmentIds: Guid[]
  record: (ownerId: Guid, apartmentId: Guid) => void
  remove: (apartmentId: Guid) => void
  clear: () => void
}
/** Tab memory only: no listing snapshots, storage, analytics or server writes. */
export const useRecentlyViewedStore = create<RecentlyViewedState>(set => ({
  ownerId: null,
  apartmentIds: [],
  record: (ownerId, apartmentId) => set(state => ({
    ownerId,
    apartmentIds: [apartmentId, ...(state.ownerId === ownerId ? state.apartmentIds.filter(id => id !== apartmentId) : [])].slice(0, MAX_RECENTLY_VIEWED),
  })),
  remove: apartmentId => set(state => ({apartmentIds: state.apartmentIds.filter(id => id !== apartmentId)})),
  clear: () => set({ownerId: null, apartmentIds: []}),
}))
