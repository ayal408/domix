/**
 * Fixed-rate amortizing-loan math. Framework-free by design (mirrors
 * `lib/format.ts` and `lib/sanitize.ts`) so the numeric core is unit-testable
 * without mounting a component, and `MortgageCalculatorPage` only wires it to
 * form state and presentation.
 */

export interface MortgageInput {
  homePrice: number
  downPayment: number
  /** Nominal annual rate, e.g. `4.5` for 4.5%, compounded monthly. */
  annualInterestRatePercent: number
  termYears: number
}

export interface MortgageSummary {
  principal: number
  monthlyPayment: number
  totalPayment: number
  totalInterest: number
  numPayments: number
}

export interface MonthlyAmortizationRow {
  month: number
  payment: number
  principalPortion: number
  interestPortion: number
  remainingBalance: number
}

export interface YearlyAmortizationRow {
  year: number
  principalPaid: number
  interestPaid: number
  endingBalance: number
}

export function calculatePrincipal(homePrice: number, downPayment: number): number {
  return Math.max(0, homePrice - downPayment)
}

/** Standard annuity formula; falls back to a straight-line split at 0% interest. */
export function calculateMonthlyPayment(
  principal: number,
  annualInterestRatePercent: number,
  termYears: number,
): number {
  const numPayments = Math.round(termYears * 12)
  if (numPayments <= 0 || principal <= 0) return 0

  const monthlyRate = annualInterestRatePercent / 100 / 12
  if (monthlyRate === 0) return principal / numPayments

  const factor = Math.pow(1 + monthlyRate, numPayments)
  return (principal * monthlyRate * factor) / (factor - 1)
}

export function summarizeMortgage(input: MortgageInput): MortgageSummary {
  const principal = calculatePrincipal(input.homePrice, input.downPayment)
  const numPayments = Math.round(input.termYears * 12)
  const monthlyPayment = calculateMonthlyPayment(principal, input.annualInterestRatePercent, input.termYears)
  const totalPayment = monthlyPayment * numPayments
  const totalInterest = Math.max(0, totalPayment - principal)
  return { principal, monthlyPayment, totalPayment, totalInterest, numPayments }
}

/**
 * Month-by-month schedule. The final payment is clamped to whatever balance
 * remains (rather than the level payment amount) so accumulated floating-point
 * drift can never leave a residual balance or go negative.
 */
export function buildAmortizationSchedule(input: MortgageInput): MonthlyAmortizationRow[] {
  const principal = calculatePrincipal(input.homePrice, input.downPayment)
  const numPayments = Math.round(input.termYears * 12)
  if (numPayments <= 0 || principal <= 0) return []

  const monthlyRate = input.annualInterestRatePercent / 100 / 12
  const payment = calculateMonthlyPayment(principal, input.annualInterestRatePercent, input.termYears)

  const rows: MonthlyAmortizationRow[] = []
  let balance = principal

  for (let month = 1; month <= numPayments; month++) {
    const interestPortion = balance * monthlyRate
    let principalPortion = payment - interestPortion
    if (month === numPayments || principalPortion > balance) {
      principalPortion = balance
    }
    balance = Math.max(0, balance - principalPortion)
    rows.push({ month, payment: principalPortion + interestPortion, principalPortion, interestPortion, remainingBalance: balance })
  }

  return rows
}

/** Rolls the monthly schedule up into one row per 12 payments, for display. */
export function toYearlySchedule(monthly: MonthlyAmortizationRow[]): YearlyAmortizationRow[] {
  const years: YearlyAmortizationRow[] = []

  for (let i = 0; i < monthly.length; i += 12) {
    const chunk = monthly.slice(i, i + 12)
    const last = chunk[chunk.length - 1]
    if (!last) continue
    years.push({
      year: years.length + 1,
      principalPaid: chunk.reduce((sum, row) => sum + row.principalPortion, 0),
      interestPaid: chunk.reduce((sum, row) => sum + row.interestPortion, 0),
      endingBalance: last.remainingBalance,
    })
  }

  return years
}
