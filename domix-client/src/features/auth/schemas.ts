import { z } from 'zod'

export const loginSchema = z.object({
  userName: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    userName: z.string().trim().min(3, 'At least 3 characters').max(50, 'Too long'),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().trim().max(20, 'Too long').optional().or(z.literal('')),
    password: z.string().min(8, 'At least 8 characters').max(100, 'Too long'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterFormValues = z.infer<typeof registerSchema>
