import { create } from 'zustand'
import type { Guid } from '@/types/api'

const MAX_COMPARE = 4

interface CompareState {
  apartmentIds: Guid[]
  isSelected: (apartmentId: Guid) => boolean
  toggle: (apartmentId: Guid) => void
  remove: (apartmentId: Guid) => void
  clear: () => void
}

export const useCompareStore = create<CompareState>((set, get) => ({
  apartmentIds: [],

  isSelected: (apartmentId) => get().apartmentIds.includes(apartmentId),

  toggle: (apartmentId) =>
    set((state) => {
      if (state.apartmentIds.includes(apartmentId)) {
        return { apartmentIds: state.apartmentIds.filter((id) => id !== apartmentId) }
      }
      if (state.apartmentIds.length >= MAX_COMPARE) {
        return state
      }
      return { apartmentIds: [...state.apartmentIds, apartmentId] }
    }),

  remove: (apartmentId) =>
    set((state) => ({ apartmentIds: state.apartmentIds.filter((id) => id !== apartmentId) })),

  clear: () => set({ apartmentIds: [] }),
}))

export { MAX_COMPARE }
