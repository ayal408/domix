import { z } from 'zod'

/** Just the "name this search" prompt — the filter criteria come from the already-validated search form. */
export const saveSearchNameSchema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(100, 'Name is too long'),
})

export type SaveSearchNameValues = z.output<typeof saveSearchNameSchema>
