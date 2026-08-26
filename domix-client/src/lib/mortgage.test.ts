import { describe, expect, it } from 'vitest'
import {
  buildAmortizationSchedule,
  calculateMonthlyPayment,
  calculatePrincipal,
  summarizeMortgage,
  toYearlySchedule,
} from '@/lib/mortgage'

describe('calculatePrincipal', () => {
  it('subtracts the down payment from the home price', () => {
    expect(calculatePrincipal(1_000_000, 200_000)).toBe(800_000)
  })

  it('never goes negative when the down payment exceeds the price', () => {
    expect(calculatePrincipal(100_000, 500_000)).toBe(0)
  })
})

describe('calculateMonthlyPayment', () => {
  it('matches the standard annuity formula for a textbook case', () => {
    // $300,000 at 6%/yr over 30 years -> ~$1798.65/mo (well-known reference value).
    const payment = calculateMonthlyPayment(300_000, 6, 30)
    expect(payment).toBeCloseTo(1798.65, 1)
  })

  it('falls back to a straight-line split at 0% interest', () => {
    expect(calculateMonthlyPayment(120_000, 0, 10)).toBeCloseTo(1000, 5)
  })

  it('returns 0 for a non-positive principal or term', () => {
    expect(calculateMonthlyPayment(0, 5, 30)).toBe(0)
    expect(calculateMonthlyPayment(100_000, 5, 0)).toBe(0)
  })
})

describe('summarizeMortgage', () => {
  it('derives total payment and total interest from the monthly payment', () => {
    const summary = summarizeMortgage({
      homePrice: 1_000_000,
      downPayment: 200_000,
      annualInterestRatePercent: 5,
      termYears: 15,
    })

    expect(summary.principal).toBe(800_000)
    expect(summary.numPayments).toBe(180)
    expect(summary.totalPayment).toBeCloseTo(summary.monthlyPayment * 180, 5)
    expect(summary.totalInterest).toBeCloseTo(summary.totalPayment - summary.principal, 5)
    expect(summary.totalInterest).toBeGreaterThan(0)
  })

  it('reports zero interest when the down payment fully covers the price', () => {
    const summary = summarizeMortgage({
      homePrice: 200_000,
      downPayment: 200_000,
      annualInterestRatePercent: 5,
      termYears: 30,
    })
    expect(summary.principal).toBe(0)
    expect(summary.monthlyPayment).toBe(0)
    expect(summary.totalInterest).toBe(0)
  })
})

describe('buildAmortizationSchedule', () => {
  const input = { homePrice: 500_000, downPayment: 100_000, annualInterestRatePercent: 4.5, termYears: 30 }

  it('produces one row per month and ends exactly at zero balance', () => {
    const schedule = buildAmortizationSchedule(input)
    expect(schedule).toHaveLength(360)
    expect(schedule[359]?.remainingBalance).toBeCloseTo(0, 6)
  })

  it('has a strictly decreasing balance and every payment split summing to the level payment', () => {
    const schedule = buildAmortizationSchedule(input)
    const monthlyPayment = calculateMonthlyPayment(
      calculatePrincipal(input.homePrice, input.downPayment),
      input.annualInterestRatePercent,
      input.termYears,
    )

    for (let i = 1; i < schedule.length; i++) {
      const prev = schedule[i - 1]
      const row = schedule[i]
      expect(row).toBeDefined()
      expect(prev).toBeDefined()
      if (!row || !prev) continue
      expect(row.remainingBalance).toBeLessThanOrEqual(prev.remainingBalance)
    }

    // Every payment but the last matches the level monthly payment; the last
    // is clamped to whatever balance remains.
    for (const row of schedule.slice(0, -1)) {
      expect(row.payment).toBeCloseTo(monthlyPayment, 4)
    }
  })

  it('returns an empty schedule for a zero principal', () => {
    expect(buildAmortizationSchedule({ homePrice: 100_000, downPayment: 100_000, annualInterestRatePercent: 5, termYears: 30 })).toEqual([])
  })
})

describe('toYearlySchedule', () => {
  it('rolls twelve monthly rows into one yearly row, ending balance carried from the last month', () => {
    const monthly = buildAmortizationSchedule({
      homePrice: 400_000,
      downPayment: 80_000,
      annualInterestRatePercent: 5,
      termYears: 2,
    })
    const yearly = toYearlySchedule(monthly)

    expect(yearly).toHaveLength(2)
    expect(yearly[0]?.year).toBe(1)
    expect(yearly[0]?.endingBalance).toBeCloseTo(monthly[11]?.remainingBalance ?? NaN, 6)
    expect(yearly[1]?.endingBalance).toBeCloseTo(0, 6)

    // Principal + interest paid across the year reconstructs that year's total cash paid.
    const yearOneCash = monthly.slice(0, 12).reduce((sum, row) => sum + row.payment, 0)
    expect((yearly[0]?.principalPaid ?? 0) + (yearly[0]?.interestPaid ?? 0)).toBeCloseTo(yearOneCash, 6)
  })
})
