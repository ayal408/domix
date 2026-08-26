import { z } from 'zod'

/** `CreateMessageDto.content` — mirrors the backend's contact-owner message body. */
export const contactOwnerSchema = z.object({
  content: z.string().trim().min(1, 'Message is required').max(2000, 'Message is too long'),
})

export type ContactOwnerFormValues = z.output<typeof contactOwnerSchema>
