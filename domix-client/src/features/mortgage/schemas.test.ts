import { describe, expect, it } from 'vitest'
import { mortgageCalculatorSchema } from '@/features/mortgage/schemas'

const valid = { homePrice: '1500000', downPayment: '300000', interestRate: '4.5', termYears: '30' }

describe('mortgageCalculatorSchema', () => {
  it('accepts a valid submission and coerces numeric strings', () => {
    const result = mortgageCalculatorSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ homePrice: 1_500_000, downPayment: 300_000, interestRate: 4.5, termYears: 30 })
    }
  })

  it('rejects a down payment that meets or exceeds the home price', () => {
    const result = mortgageCalculatorSchema.safeParse({ ...valid, downPayment: '1500000' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['downPayment'])
  })

  it('rejects a non-positive home price', () => {
    expect(mortgageCalculatorSchema.safeParse({ ...valid, homePrice: '0' }).success).toBe(false)
  })

  it('rejects a negative down payment', () => {
    expect(mortgageCalculatorSchema.safeParse({ ...valid, downPayment: '-1' }).success).toBe(false)
  })

  it('rejects a non-integer term', () => {
    expect(mortgageCalculatorSchema.safeParse({ ...valid, termYears: '15.5' }).success).toBe(false)
  })

  it('rejects an unrealistic interest rate', () => {
    expect(mortgageCalculatorSchema.safeParse({ ...valid, interestRate: '45' }).success).toBe(false)
  })

  it('allows a 0% interest rate', () => {
    expect(mortgageCalculatorSchema.safeParse({ ...valid, interestRate: '0' }).success).toBe(true)
  })
})
