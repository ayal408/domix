import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 * Without `twMerge`, a caller passing `p-2` could not override a base `p-4`
 * because both classes would survive and CSS order would decide.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
