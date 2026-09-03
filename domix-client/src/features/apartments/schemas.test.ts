import { describe, expect, it } from 'vitest'
import { apartmentFormSchema, apartmentSearchSchema } from '@/features/apartments/schemas'

describe('apartmentFormSchema', () => {
  const valid = {
    city: 'Tel Aviv',
    address: 'Dizengoff 1',
    area: 'Center',
    price: 5000,
    description: '',
    squareMeters: '',
    sumOfRooms: '',
    sumOfBeds: '',
    floor: '',
    elevator: false,
    isAnonymous: false,
  }

  it('accepts a fully valid submission', () => {
    const result = apartmentFormSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('treats empty-string optional numeric fields as undefined rather than 0', () => {
    const result = apartmentFormSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.squareMeters).toBeUndefined()
      expect(result.data.sumOfRooms).toBeUndefined()
    }
  })

  it('rejects a non-positive price', () => {
    const result = apartmentFormSchema.safeParse({ ...valid, price: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects a blank required field', () => {
    const result = apartmentFormSchema.safeParse({ ...valid, city: '   ' })
    expect(result.success).toBe(false)
  })

  it('coerces numeric-string inputs', () => {
    const result = apartmentFormSchema.safeParse({ ...valid, squareMeters: '80' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.squareMeters).toBe(80)
  })

  it('accepts a valid propertyType and rejects an unknown one', () => {
    expect(apartmentFormSchema.safeParse({ ...valid, propertyType: 'Studio' }).success).toBe(true)
    expect(apartmentFormSchema.safeParse({ ...valid, propertyType: 'Castle' }).success).toBe(false)
  })
})

describe('apartmentSearchSchema', () => {
  it('accepts an entirely empty search (matches everything)', () => {
    const result = apartmentSearchSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects minPrice greater than maxPrice', () => {
    const result = apartmentSearchSchema.safeParse({ minPrice: '2000', maxPrice: '1000' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['maxPrice'])
    }
  })

  it('rejects minRooms greater than maxRooms', () => {
    const result = apartmentSearchSchema.safeParse({ minRooms: '4', maxRooms: '2' })
    expect(result.success).toBe(false)
  })

  it('accepts equal min/max bounds', () => {
    const result = apartmentSearchSchema.safeParse({ minPrice: '1000', maxPrice: '1000' })
    expect(result.success).toBe(true)
  })

  it('accepts a valid sortBy and rejects an unknown one', () => {
    expect(apartmentSearchSchema.safeParse({ sortBy: 'price_asc' }).success).toBe(true)
    expect(apartmentSearchSchema.safeParse({ sortBy: 'cheapest_first' }).success).toBe(false)
  })

  it('accepts a valid propertyType and rejects an unknown one', () => {
    expect(apartmentSearchSchema.safeParse({ propertyType: 'Penthouse' }).success).toBe(true)
    expect(apartmentSearchSchema.safeParse({ propertyType: 'Castle' }).success).toBe(false)
  })
})
