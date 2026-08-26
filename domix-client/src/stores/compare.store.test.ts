import { beforeEach, describe, expect, it } from 'vitest'
import { useCompareStore, MAX_COMPARE } from '@/stores/compare.store'

beforeEach(() => {
  useCompareStore.setState({ apartmentIds: [] })
})

describe('compare.store', () => {
  it('adds an apartment id on toggle', () => {
    useCompareStore.getState().toggle('a1')
    expect(useCompareStore.getState().apartmentIds).toEqual(['a1'])
    expect(useCompareStore.getState().isSelected('a1')).toBe(true)
  })

  it('removes an already-selected id on toggle', () => {
    useCompareStore.getState().toggle('a1')
    useCompareStore.getState().toggle('a1')
    expect(useCompareStore.getState().apartmentIds).toEqual([])
    expect(useCompareStore.getState().isSelected('a1')).toBe(false)
  })

  it('caps selection at MAX_COMPARE and ignores further adds', () => {
    for (let i = 0; i < MAX_COMPARE + 2; i++) {
      useCompareStore.getState().toggle(`a${i}`)
    }
    expect(useCompareStore.getState().apartmentIds).toHaveLength(MAX_COMPARE)
    expect(useCompareStore.getState().isSelected(`a${MAX_COMPARE}`)).toBe(false)
  })

  it('remove() drops a specific id regardless of position', () => {
    useCompareStore.getState().toggle('a1')
    useCompareStore.getState().toggle('a2')
    useCompareStore.getState().remove('a1')
    expect(useCompareStore.getState().apartmentIds).toEqual(['a2'])
  })

  it('clear() empties the selection', () => {
    useCompareStore.getState().toggle('a1')
    useCompareStore.getState().toggle('a2')
    useCompareStore.getState().clear()
    expect(useCompareStore.getState().apartmentIds).toEqual([])
  })
})
