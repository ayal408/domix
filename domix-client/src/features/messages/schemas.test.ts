import { describe, expect, it } from 'vitest'
import { contactOwnerSchema } from '@/features/messages/schemas'

describe('contactOwnerSchema', () => {
  it('accepts a non-empty message', () => {
    expect(contactOwnerSchema.safeParse({ content: 'Is this still available?' }).success).toBe(true)
  })

  it('rejects an empty message', () => {
    expect(contactOwnerSchema.safeParse({ content: '' }).success).toBe(false)
  })

  it('rejects a whitespace-only message', () => {
    expect(contactOwnerSchema.safeParse({ content: '   ' }).success).toBe(false)
  })

  it('rejects a message over 2000 characters', () => {
    const result = contactOwnerSchema.safeParse({ content: 'a'.repeat(2001) })
    expect(result.success).toBe(false)
  })

  it('trims surrounding whitespace', () => {
    const result = contactOwnerSchema.safeParse({ content: '  hello  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.content).toBe('hello')
  })
})
