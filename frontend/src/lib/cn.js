import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Combine des classes conditionnelles et résout les conflits Tailwind (px-2 + px-4 → px-4)
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
