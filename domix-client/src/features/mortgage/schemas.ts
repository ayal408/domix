import { z } from 'zod'

export const mortgageCalculatorSchema = z
  .object({
    homePrice: z.coerce
      .number({ error: 'Enter a valid amount' })
      .positive('Must be greater than 0')
      .max(1_000_000_000, 'Amount is unrealistically high'),
    downPayment: z.coerce
      .number({ error: 'Enter a valid amount' })
      .nonnegative('Cannot be negative')
      .max(1_000_000_000, 'Amount is unrealistically high'),
    interestRate: z.coerce
      .number({ error: 'Enter a valid rate' })
      .nonnegative('Cannot be negative')
      .max(30, 'Rate seems unrealistically high'),
    termYears: z.coerce
      .number({ error: 'Enter a valid term' })
      .int('Whole years only')
      .positive('Must be greater than 0')
      .max(50, 'Term is unrealistically long'),
  })
  .refine((data) => data.downPayment < data.homePrice, {
    message: 'Down payment must be less than the home price',
    path: ['downPayment'],
  })

/** Parsed/coerced shape produced after Zod runs. */
export type MortgageCalculatorFormValues = z.output<typeof mortgageCalculatorSchema>
/** Raw shape RHF's `register()` fields hold before Zod coercion runs (numbers arrive as `unknown` pre-parse). */
export type MortgageCalculatorFormInput = z.input<typeof mortgageCalculatorSchema>

export const MORTGAGE_CALCULATOR_DEFAULTS: MortgageCalculatorFormValues = {
  homePrice: 1_500_000,
  downPayment: 300_000,
  interestRate: 4.5,
  termYears: 30,
}
