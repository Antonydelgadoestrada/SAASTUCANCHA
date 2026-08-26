import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parses any date representation (ISO string, YYYY-MM-DD, Date, timestamp)
 * and returns a valid Date object or null if invalid.
 */
export function parseSafeDate(dateInput: any, timeStr?: string): Date | null {
  if (!dateInput) return null

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null
    if (!timeStr) return dateInput
    const dateOnly = dateInput.toISOString().split("T")[0]
    const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr
    const combined = new Date(`${dateOnly}T${cleanTime}`)
    return isNaN(combined.getTime()) ? dateInput : combined
  }

  if (typeof dateInput === "string") {
    // If it's something like "2025-05-15T00:00:00.000Z" or "2025-05-15"
    const dateOnly = dateInput.includes("T") ? dateInput.split("T")[0] : dateInput.trim()

    if (timeStr) {
      const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr
      const combined = new Date(`${dateOnly}T${cleanTime}`)
      if (!isNaN(combined.getTime())) return combined
    }

    // Try local midnight first
    const localDate = new Date(`${dateOnly}T00:00:00`)
    if (!isNaN(localDate.getTime())) return localDate

    // Try direct parse
    const directDate = new Date(dateInput)
    if (!isNaN(directDate.getTime())) return directDate
  }

  if (typeof dateInput === "number") {
    const numDate = new Date(dateInput)
    if (!isNaN(numDate.getTime())) return numDate
  }

  return null
}

/**
 * Safely formats a date with fallback text if invalid or missing.
 */
export function formatSafeDate(
  dateInput: any,
  formatPattern: string,
  options?: Parameters<typeof format>[2],
  fallbackText: string = "Fecha no disponible"
): string {
  const parsed = parseSafeDate(dateInput)
  if (!parsed || isNaN(parsed.getTime())) {
    return fallbackText
  }
  try {
    return format(parsed, formatPattern, options)
  } catch {
    return fallbackText
  }
}

/**
 * Safely extracts the total price (in Soles) for any booking object,
 * handling jsonb objects, serialized JSON strings, direct price fields, or calculating from court price.
 */
export function getBookingTotalPrice(booking: any): number {
  if (!booking) return 0

  // 1. Si pricing es un objeto con totalPrice numérico
  if (typeof booking.pricing === "object" && booking.pricing !== null) {
    const p = Number(booking.pricing.totalPrice ?? booking.pricing.basePrice)
    if (!isNaN(p) && p > 0) return p
  }

  // 2. Si pricing es un string JSON
  if (typeof booking.pricing === "string") {
    try {
      const parsed = JSON.parse(booking.pricing)
      const p = Number(parsed?.totalPrice ?? parsed?.basePrice)
      if (!isNaN(p) && p > 0) return p
    } catch {}
  }

  // 3. Si booking tiene price directo
  if (booking.price !== undefined && booking.price !== null) {
    const p = Number(booking.price)
    if (!isNaN(p) && p > 0) return p
  }

  // 4. Calcular desde court.priceDay / priceNight y duration
  const courtPrice = Number(booking.court?.priceDay || booking.court?.priceNight || booking.court?.price || 0)
  const dur = Number(booking.duration || 1)
  const calculated = courtPrice * dur * 2
  if (!isNaN(calculated) && calculated > 0) return calculated

  return 0
}

