import { describe, expect, it } from 'vitest'
import { saveSearchNameSchema } from '@/features/apartments/savedSearch.schemas'

describe('saveSearchNameSchema', () => {
  it('accepts a non-empty trimmed name', () => {
    const result = saveSearchNameSchema.safeParse({ name: '  Tel Aviv 3BR  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Tel Aviv 3BR')
  })

  it('rejects a blank name', () => {
    expect(saveSearchNameSchema.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('rejects a name over 100 characters', () => {
    expect(saveSearchNameSchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false)
  })
})
