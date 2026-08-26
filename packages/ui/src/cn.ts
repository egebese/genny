import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges class lists and lets a later utility win over an earlier one. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
